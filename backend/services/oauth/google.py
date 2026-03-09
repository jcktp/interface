"""Google OAuth provider implementation."""

from typing import Optional
from urllib.parse import urlencode
import httpx

from .base import OAuthProvider, OAuthUser


class GoogleOAuth(OAuthProvider):
    """Google OAuth 2.0 provider."""

    @property
    def provider_name(self) -> str:
        return "google"

    @property
    def default_scopes(self) -> list[str]:
        return [
            "openid",
            "email",
            "profile",
        ]

    @property
    def authorization_endpoint(self) -> str:
        return "https://accounts.google.com/o/oauth2/v2/auth"

    @property
    def token_endpoint(self) -> str:
        return "https://oauth2.googleapis.com/token"

    @property
    def userinfo_endpoint(self) -> str:
        return "https://www.googleapis.com/oauth2/v3/userinfo"

    def get_authorization_url(self, state: str) -> str:
        """Generate Google OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        return f"{self.authorization_endpoint}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> dict:
        """Exchange authorization code for tokens."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_endpoint,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                },
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str) -> OAuthUser:
        """Fetch user information from Google."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        return OAuthUser(
            provider=self.provider_name,
            provider_user_id=data["sub"],
            email=data["email"],
            name=data.get("name", data["email"].split("@")[0]),
            picture=data.get("picture"),
            email_verified=data.get("email_verified", False),
            raw_data=data,
        )


class GoogleWorkspaceOAuth(GoogleOAuth):
    """Google Workspace (formerly G Suite) OAuth with domain restriction."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        hosted_domain: Optional[str] = None,
        scopes: Optional[list[str]] = None,
    ):
        super().__init__(client_id, client_secret, redirect_uri, scopes)
        self.hosted_domain = hosted_domain

    def get_authorization_url(self, state: str) -> str:
        """Generate Google OAuth authorization URL with domain restriction."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        if self.hosted_domain:
            params["hd"] = self.hosted_domain

        return f"{self.authorization_endpoint}?{urlencode(params)}"

    async def get_user_info(self, access_token: str) -> OAuthUser:
        """Fetch user info and validate domain if restricted."""
        user = await super().get_user_info(access_token)

        # Validate hosted domain if configured
        if self.hosted_domain:
            email_domain = user.email.split("@")[1] if "@" in user.email else ""
            if email_domain.lower() != self.hosted_domain.lower():
                raise ValueError(
                    f"Email domain must be {self.hosted_domain}"
                )

        return user
