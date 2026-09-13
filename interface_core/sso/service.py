import base64
import hashlib
import secrets
import time
from typing import Protocol
from urllib.parse import urlencode
import httpx
from ..policy import DirectoryPolicy, DomainError


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


class SSORepository(Protocol):
    def list_links(self): ...
    def link(self, actor, issuer, subject, user_id): ...
    def unlink(self, actor, issuer, user_id): ...
    def begin(self, state_hash, browser_hash, provider, nonce, verifier, now): ...
    def consume(self, state_hash, browser_hash, provider, now): ...
    def handoff(self, issuer, subject, token_hash, now): ...
    def exchange(self, handoff_hash, session_hash, now): ...


class OIDCTokenVerifier:
    def __init__(self, client):
        self.client = client

    def verify(self, provider, token, nonce):
        import jwt
        try:
            header = jwt.get_unverified_header(token)
            if header.get('alg') != 'RS256' or not isinstance(header.get('kid'), str):
                raise ValueError('Invalid algorithm or key identifier')
            response = self.client.get(provider.jwks_url)
            response.raise_for_status()
            keys = jwt.PyJWKSet.from_dict(response.json())
            key = keys[header['kid']]
            if key.key_type != 'RSA' or key.public_key_use not in (None,'sig'):
                raise ValueError('Invalid signing key')
            claims = jwt.decode(token, key.key, algorithms=['RS256'], audience=provider.client_id,
                issuer=provider.issuer, leeway=30, options={'require':['exp','iat','iss','aud','sub','nonce']})
            if not isinstance(claims['sub'], str) or not claims['sub'] or len(claims['sub']) > 255:
                raise ValueError('Invalid subject')
            if claims.get('azp', provider.client_id) != provider.client_id or (isinstance(claims['aud'],list) and len(claims['aud'])>1 and 'azp' not in claims):
                raise ValueError('Invalid authorized party')
            if not isinstance(claims['nonce'],str) or not secrets.compare_digest(claims['nonce'].encode(),nonce.encode()):
                raise ValueError('Invalid nonce')
            return claims['sub']
        except (jwt.PyJWTError, ValueError, KeyError, TypeError):
            raise DomainError(401, 'The identity token could not be verified. Start sign-in again.') from None


class SSOService:
    def __init__(self, repository: SSORepository, config, client=None):
        self.repository, self.config = repository, config
        self.client = client or httpx.Client(timeout=15, follow_redirects=False, trust_env=False)
        self.verifier = OIDCTokenVerifier(self.client)
        self.policy = DirectoryPolicy()
        if config.providers:
            try:
                import jwt
                import cryptography
            except ImportError:
                raise ValueError('Install Interface with the integrations extra to enable SSO') from None

    def providers(self):
        return [{'id':p.id, 'name':p.label} for p in self.config.providers.values()]

    def provider(self, name):
        if name not in self.config.providers:
            raise DomainError(404, 'SSO provider is not configured')
        return self.config.providers[name]

    def settings(self, actor):
        self.policy.authorize(actor, write=True)
        return {'providers':[{'id':p.id,'name':p.label,'issuer':p.issuer,'callback_url':self.callback(p)} for p in self.config.providers.values()], 'links':self.repository.list_links()}

    def link(self, actor, provider, subject, user_id):
        self.policy.authorize(actor, write=True)
        return self.repository.link(actor,self.provider(provider).issuer,subject,user_id)

    def unlink(self, actor, provider, user_id):
        self.policy.authorize(actor, write=True)
        self.repository.unlink(actor,self.provider(provider).issuer,user_id)

    def callback(self, provider):
        return self.config.origin + '/api/v1/auth/sso/' + provider.id + '/callback'

    def begin(self, name):
        provider = self.provider(name)
        state, browser, nonce, verifier = [secrets.token_urlsafe(32) for _ in range(4)]
        self.repository.begin(digest(state),digest(browser),name,nonce,verifier,int(time.time()))
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b'=').decode()
        params = {'client_id':provider.client_id,'redirect_uri':self.callback(provider),'response_type':'code',
            'scope':'openid email profile','state':state,'nonce':nonce,'code_challenge':challenge,'code_challenge_method':'S256'}
        return provider.authorize_url + '?' + urlencode(params), browser

    def complete(self, name, state, browser, code):
        provider = self.provider(name)
        attempt = self.repository.consume(digest(state),digest(browser),name,int(time.time()))
        try:
            response = self.client.post(provider.token_url, data={'grant_type':'authorization_code',
                'code':code,'redirect_uri':self.callback(provider),'client_id':provider.client_id,
                'client_secret':provider.client_secret,'code_verifier':attempt['verifier']})
            response.raise_for_status()
            subject = self.verifier.verify(provider,response.json()['id_token'],attempt['nonce'])
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise DomainError(401, 'SSO provider could not complete sign-in. Check the application configuration and try again.') from None
        token = secrets.token_urlsafe(32)
        self.repository.handoff(provider.issuer,subject,digest(token),int(time.time()))
        return token

    def exchange(self, handoff):
        token = secrets.token_urlsafe(32)
        self.repository.exchange(digest(handoff),digest(token),int(time.time()))
        return {'access_token':token, 'token_type':'bearer', 'expires_in':12*3600}
