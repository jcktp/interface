"""Explicit server configuration; no discovery URLs supplied by browser users."""
from dataclasses import dataclass, field
import os
import re
from urllib.parse import urlsplit


@dataclass(frozen=True)
class OIDCProvider:
    id: str
    label: str
    issuer: str
    client_id: str
    client_secret: str = field(repr=False)
    authorize_url: str
    token_url: str
    jwks_url: str


@dataclass(frozen=True)
class SSOConfig:
    origin: str
    providers: dict[str, OIDCProvider]

    @property
    def secure(self):
        return self.origin.startswith('https://')

    @classmethod
    def from_environment(cls, environment=None):
        env = os.environ if environment is None else environment
        origin = env.get('INTERFACE_PUBLIC_URL', '').rstrip('/')
        providers = {}
        for name, label in [('google','Google'), ('okta','Okta')]:
            prefix = 'INTERFACE_SSO_' + name.upper()
            client_id, secret = env.get(prefix + '_CLIENT_ID'), env.get(prefix + '_CLIENT_SECRET')
            if not client_id and not secret:
                continue
            if not client_id or not secret:
                raise ValueError(f'{prefix} requires both client ID and client secret')
            if name == 'google':
                issuer = 'https://accounts.google.com'
                authorize = 'https://accounts.google.com/o/oauth2/v2/auth'
                token = 'https://oauth2.googleapis.com/token'
                jwks = 'https://www.googleapis.com/oauth2/v3/certs'
            else:
                issuer = env.get(prefix + '_ISSUER','').rstrip('/')
                parsed = urlsplit(issuer)
                # Custom Okta domains can be added as a separate reviewed adapter.
                if parsed.scheme != 'https' or not re.fullmatch(r'[a-zA-Z0-9-]+\.(okta\.com|oktapreview\.com|okta-emea\.com)', parsed.netloc) or not re.fullmatch(r'(/oauth2/[a-zA-Z0-9_-]+)?', parsed.path) or parsed.query or parsed.fragment:
                    raise ValueError('Set INTERFACE_SSO_OKTA_ISSUER to your HTTPS Okta organization or authorization-server URL')
                base = issuer + ('/v1' if parsed.path else '/oauth2/v1')
                authorize, token, jwks = base + '/authorize', base + '/token', base + '/keys'
            providers[name] = OIDCProvider(name,label,issuer,client_id,secret,authorize,token,jwks)
        if providers:
            parsed = urlsplit(origin)
            if not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment or not (parsed.scheme == 'https' or (parsed.scheme == 'http' and parsed.hostname in ('localhost','127.0.0.1'))):
                raise ValueError('SSO requires INTERFACE_PUBLIC_URL with an HTTPS origin (HTTP allowed only on localhost)')
        return cls(origin, providers)
