from dataclasses import dataclass
from typing import Protocol
from urllib.parse import urlparse, parse_qs
import httpx

from ..policy import DomainError


@dataclass(frozen=True)
class ProviderSpec:
    id: str
    name: str
    description: str
    capabilities: tuple[str, ...]


class ProviderAdapter(Protocol):
    spec: ProviderSpec
    def test(self, secret: str) -> str: ...


class SlackAdapter:
    spec = ProviderSpec('slack', 'Slack', 'Verify a Slack token and workspace. Messaging and workflow notifications are not implemented yet.', ('connection verification',))

    def __init__(self, client):
        self.client = client

    def test(self, secret):
        response = self.client.post('https://slack.com/api/auth.test', headers={'Authorization': f'Bearer {secret}'})
        response.raise_for_status()
        body = response.json()
        if not body.get('ok'):
            raise DomainError(422, 'Slack rejected the token; check its validity and workspace')
        return 'Verified Slack workspace: ' + str(body.get('team', 'workspace'))[:120]


class GreenhouseAdapter:
    spec = ProviderSpec('greenhouse', 'Greenhouse', 'Import candidate names and email addresses from Harvest, one resumable page at a time. Candidates stay separate from employees.', ('connection verification', 'candidate sync'))

    def __init__(self, client):
        self.client = client

    def request(self, secret, page, per_page):
        response = self.client.get('https://harvest.greenhouse.io/v1/candidates', params={'page':page,'per_page':per_page}, auth=httpx.BasicAuth(secret, ''))
        response.raise_for_status()
        return response

    def test(self, secret):
        response = self.request(secret, 1, 1)
        if not isinstance(response.json(), list):
            raise DomainError(502, 'Unexpected Greenhouse response')
        return 'Verified access to Harvest candidates'

    def sync(self, secret, page, cursor=""):
        response = self.request(secret, page, 100)
        body = response.json()
        if not isinstance(body, list) or len(body) > 100:
            raise DomainError(502, 'Unexpected Greenhouse candidate page')
        records=[]
        for item in body:
            if not isinstance(item, dict) or not item.get('id'):
                raise DomainError(502, 'Candidate page contains an invalid record')
            emails=item.get('email_addresses') or []
            records.append({'external_id':str(item['id']), 'name':f"{item.get('first_name') or ''} {item.get('last_name') or ''}".strip()[:240], 'email':str(emails[0].get('value') or '')[:254] if emails else ''})
        next_link=response.links.get('next',{}).get('url')
        next_page=0
        if next_link:
            url=urlparse(next_link)
            values=parse_qs(url.query).get('page', [])
            if url.scheme!='https' or url.netloc!='harvest.greenhouse.io' or url.path.rstrip('/')!='/v1/candidates' or not values or not values[0].isdigit() or int(values[0])<=page:
                raise DomainError(502, 'Provider returned an invalid pagination link')
            next_page=int(values[0])
        return records,next_page,""


class ProviderRegistry:
    def __init__(self, client=None):
        self.client=client or httpx.Client(timeout=15, follow_redirects=False, trust_env=False)
        from .ashby import AshbyAdapter
        from .workspace import WorkspaceAdapter
        self.adapters={adapter.spec.id:adapter for adapter in [SlackAdapter(self.client),GreenhouseAdapter(self.client),AshbyAdapter(self.client),WorkspaceAdapter(self.client)]}

    def get(self, provider):
        if provider not in self.adapters:
            raise DomainError(422, 'Provider is not implemented')
        return self.adapters[provider]
