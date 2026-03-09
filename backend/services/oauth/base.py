"""Base OAuth provider interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
import secrets


@dataclass
class OAuthUser:
    """Standardized user info from OAuth providers."""

    provider: str
    provider_user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    email_verified: bool = False
    raw_data: Optional[dict] = None


class OAuthProvider(ABC):
    """Abstract base class for OAuth providers."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        scopes: Optional[list[str]] = None,
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes or self.default_scopes

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the provider name (e.g., 'google', 'okta')."""
        pass

    @property
    @abstractmethod
    def default_scopes(self) -> list[str]:
        """Return default OAuth scopes for this provider."""
        pass

    @property
    @abstractmethod
    def authorization_endpoint(self) -> str:
        """Return the OAuth authorization URL."""
        pass

    @property
    @abstractmethod
    def token_endpoint(self) -> str:
        """Return the OAuth token URL."""
        pass

    @property
    @abstractmethod
    def userinfo_endpoint(self) -> str:
        """Return the userinfo URL."""
        pass

    def generate_state(self) -> str:
        """Generate a random state parameter for CSRF protection."""
        return secrets.token_urlsafe(32)

    @abstractmethod
    def get_authorization_url(self, state: str) -> str:
        """Generate the authorization URL for redirecting the user."""
        pass

    @abstractmethod
    async def exchange_code(self, code: str) -> dict:
        """Exchange authorization code for tokens."""
        pass

    @abstractmethod
    async def get_user_info(self, access_token: str) -> OAuthUser:
        """Fetch user information using the access token."""
        pass

    async def authenticate(self, code: str) -> OAuthUser:
        """Complete the OAuth flow: exchange code and get user info."""
        tokens = await self.exchange_code(code)
        access_token = tokens.get("access_token")
        if not access_token:
            raise ValueError("No access token received")
        return await self.get_user_info(access_token)
