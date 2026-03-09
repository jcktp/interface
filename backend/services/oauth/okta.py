"""Okta OAuth provider implementation."""

from typing import Optional
from urllib.parse import urlencode
import httpx

from .base import OAuthProvider, OAuthUser


class OktaOAuth(OAuthProvider):
    """Okta OAuth 2.0 / OIDC provider."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        okta_domain: str,
        scopes: Optional[list[str]] = None,
        authorization_server_id: str = "default",
    ):
        super().__init__(client_id, client_secret, redirect_uri, scopes)
        # Normalize domain (remove https:// if present)
        self.okta_domain = okta_domain.replace("https://", "").rstrip("/")
        self.authorization_server_id = authorization_server_id
        self._base_url = f"https://{self.okta_domain}/oauth2/{authorization_server_id}"

    @property
    def provider_name(self) -> str:
        return "okta"

    @property
    def default_scopes(self) -> list[str]:
        return [
            "openid",
            "email",
            "profile",
        ]

    @property
    def authorization_endpoint(self) -> str:
        return f"{self._base_url}/v1/authorize"

    @property
    def token_endpoint(self) -> str:
        return f"{self._base_url}/v1/token"

    @property
    def userinfo_endpoint(self) -> str:
        return f"{self._base_url}/v1/userinfo"

    def get_authorization_url(self, state: str, nonce: Optional[str] = None) -> str:
        """Generate Okta OAuth authorization URL."""
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
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
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str) -> OAuthUser:
        """Fetch user information from Okta."""
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
            email=data.get("email", ""),
            name=data.get("name", data.get("preferred_username", "")),
            picture=data.get("picture"),
            email_verified=data.get("email_verified", False),
            raw_data=data,
        )

    async def introspect_token(self, token: str, token_type: str = "access_token") -> dict:
        """Introspect a token to verify it's valid."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/v1/introspect",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "token": token,
                    "token_type_hint": token_type,
                },
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()

    async def revoke_token(self, token: str, token_type: str = "access_token") -> None:
        """Revoke a token."""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self._base_url}/v1/revoke",
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "token": token,
                    "token_type_hint": token_type,
                },
            )
            response.raise_for_status()
