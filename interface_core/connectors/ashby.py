from .adapters import ProviderSpec
from ..policy import DomainError
import httpx


class AshbyAdapter:
    spec = ProviderSpec('ashby', 'Ashby', 'Import candidate names and emails with resumable pagination. Refresh updates existing records; employees are never created automatically.', ('connection verification', 'candidate sync'))

    def __init__(self, client):
        self.client = client

    def request(self, secret, cursor, limit):
        response = self.client.post('https://api.ashbyhq.com/candidate.list',
            auth=httpx.BasicAuth(secret, ''), json={'cursor': cursor or 'start', 'limit': limit})
        response.raise_for_status()
        body = response.json()
        if not isinstance(body, dict) or body.get('success') is not True:
            raise DomainError(422, 'Ashby rejected the request; check the API key and candidatesRead permission.')
        if not isinstance(body.get('results'), list) or len(body['results']) > limit:
            raise DomainError(502, 'Unexpected Ashby candidate page')
        return body

    def test(self, secret):
        self.request(secret, '', 1)
        return 'Verified Ashby candidate access'

    def sync(self, secret, page, cursor=''):
        body = self.request(secret, cursor, 100)
        records = []
        for item in body['results']:
            if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not item['id']:
                raise DomainError(502, 'Ashby returned an invalid candidate')
            emails = item.get('emailAddresses') or []
            records.append({'external_id': item['id'], 'name': str(item.get('name') or '')[:240],
                'email': str(emails[0].get('value') or '')[:254] if emails else ''})
        more = body.get('moreDataAvailable')
        if not isinstance(more, bool):
            raise DomainError(502, 'Ashby returned invalid pagination')
        next_cursor = body.get('nextCursor') if more else ''
        if not isinstance(next_cursor, str) or len(next_cursor) > 4096 or (more and (not next_cursor or next_cursor == cursor)):
            raise DomainError(502, 'Ashby returned invalid pagination')
        return records, page + 1 if more else 0, next_cursor
