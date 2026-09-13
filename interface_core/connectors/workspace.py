import json
from threading import Lock
from .adapters import ProviderSpec
from ..policy import DomainError

SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly'


class GoogleCredentialSource:
    """Refresh delegated service-account tokens using Google's signing implementation."""
    def __init__(self, client):
        self.client = client
        self.cached = None
        self.secret = None
        self.lock = Lock()

    def request(self, url, method='GET', body=None, headers=None, timeout=15, **kwargs):
        if url != 'https://oauth2.googleapis.com/token':
            raise DomainError(422, 'Unsupported Google token endpoint')
        response = self.client.request(method, url, content=body, headers=headers, timeout=15)
        class Result:
            status = response.status_code
            data = response.content
            headers = response.headers
        return Result()

    def token(self, secret):
        try:
            from google.oauth2 import service_account
            from google.auth.exceptions import GoogleAuthError
        except ImportError:
            raise DomainError(422, 'Install Interface with the integrations extra to enable Workspace authentication.')
        try:
            with self.lock:
                if self.secret != secret:
                    config = json.loads(secret)
                    info = config['service_account']
                    subject = config['delegated_subject']
                    if not isinstance(subject, str) or '@' not in subject or info.get('type') != 'service_account' or info.get('token_uri') != 'https://oauth2.googleapis.com/token':
                        raise ValueError('Invalid service account configuration')
                    self.cached = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE], subject=subject)
                    self.secret = secret
                if not self.cached.valid:
                    self.cached.refresh(self.request)
                return self.cached.token
        except (GoogleAuthError, ValueError, KeyError, TypeError):
            raise DomainError(422, 'Google authentication failed. Check service-account JSON, delegated administrator and read-only Directory scope.') from None


class WorkspaceAdapter:
    spec = ProviderSpec('google_workspace', 'Google Workspace', 'Import directory names, email addresses and suspended status. Review these separately from HR records; this does not provision accounts or grant access.', ('connection verification', 'directory sync'))

    def __init__(self, client, credentials=None):
        self.client = client
        self.credentials = credentials or GoogleCredentialSource(client)

    def request(self, secret, cursor, limit):
        params = {'customer':'my_customer', 'maxResults':limit, 'projection':'basic', 'viewType':'admin_view'}
        if cursor:
            params['pageToken'] = cursor
        response = self.client.get('https://admin.googleapis.com/admin/directory/v1/users',
            headers={'Authorization': 'Bearer ' + self.credentials.token(secret)}, params=params)
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, dict) or not isinstance(body.get('users', []), list) or len(body.get('users', [])) > limit:
            raise DomainError(502, 'Unexpected Google directory page')
        return body

    def test(self, secret):
        self.request(secret, '', 1)
        return 'Verified read-only Workspace directory access'

    def sync(self, secret, page, cursor=''):
        body = self.request(secret, cursor, 100)
        records = []
        for item in body.get('users', []):
            if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not item['id'] or not isinstance(item.get('suspended'), bool):
                raise DomainError(502, 'Google returned an invalid directory user')
            records.append({'external_id':item['id'], 'name':str((item.get('name') or {}).get('fullName') or '')[:240],
                'email':str(item.get('primaryEmail') or '')[:254], 'suspended':item['suspended']})
        next_cursor = body.get('nextPageToken', '')
        if not isinstance(next_cursor, str) or len(next_cursor) > 4096 or (next_cursor and next_cursor == cursor):
            raise DomainError(502, 'Google returned invalid pagination')
        return records, page + 1 if next_cursor else 0, next_cursor
