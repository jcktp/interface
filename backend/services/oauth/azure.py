"""Azure AD (Entra ID) OAuth provider implementation."""

from typing import Optional
from urllib.parse import urlencode
import httpx

from .base import OAuthProvider, OAuthUser


class AzureOAuth(OAuthProvider):
    """Microsoft Azure AD / Entra ID OAuth 2.0 provider."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        tenant_id: str = "common",
        scopes: Optional[list[str]] = None,
    ):
        super().__init__(client_id, client_secret, redirect_uri, scopes)
        self.tenant_id = tenant_id
        self._base_url = f"https://login.microsoftonline.com/{tenant_id}"

    @property
    def provider_name(self) -> str:
        return "azure"

    @property
    def default_scopes(self) -> list[str]:
        return [
            "openid",
            "email",
            "profile",
            "User.Read",
        ]

    @property
    def authorization_endpoint(self) -> str:
        return f"{self._base_url}/oauth2/v2.0/authorize"

    @property
    def token_endpoint(self) -> str:
        return f"{self._base_url}/oauth2/v2.0/token"

    @property
    def userinfo_endpoint(self) -> str:
        return "https://graph.microsoft.com/v1.0/me"

    def get_authorization_url(self, state: str, nonce: Optional[str] = None) -> str:
        """Generate Azure AD OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
            "response_mode": "query",
        }
        if nonce:
            params["nonce"] = nonce

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
                    "scope": " ".join(self.scopes),
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str) -> OAuthUser:
        """Fetch user information from Microsoft Graph."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.userinfo_endpoint,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            data = response.json()

        # Azure returns slightly different field names
        email = (
            data.get("mail")
            or data.get("userPrincipalName")
            or ""
        )
        name = data.get("displayName") or data.get("givenName", "")

        return OAuthUser(
            provider=self.provider_name,
            provider_user_id=data["id"],
            email=email,
            name=name,
            picture=None,  # Azure requires separate call for photo
            email_verified=True,  # Azure AD emails are verified by organization
            raw_data=data,
        )

    async def get_user_photo(self, access_token: str) -> Optional[bytes]:
        """Fetch user's profile photo from Microsoft Graph."""
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(
                    "https://graph.microsoft.com/v1.0/me/photo/$value",
                    headers={"Authorization": f"Bearer {access_token}"},
                )
                response.raise_for_status()
                return response.content
            except httpx.HTTPStatusError:
                # Photo may not exist
                return None

    async def refresh_access_token(self, refresh_token: str) -> dict:
        """Refresh an access token using a refresh token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.token_endpoint,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                    "scope": " ".join(self.scopes),
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()
