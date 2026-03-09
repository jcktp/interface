"""SAML 2.0 authentication service."""

from dataclasses import dataclass
from typing import Optional
import os


@dataclass
class SAMLUser:
    """User information extracted from SAML assertion."""

    name_id: str
    email: str
    name: str
    attributes: dict
    session_index: Optional[str] = None


@dataclass
class SAMLConfig:
    """SAML Service Provider configuration."""

    entity_id: str
    acs_url: str  # Assertion Consumer Service URL
    sls_url: Optional[str] = None  # Single Logout Service URL
    name_id_format: str = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
    cert_path: Optional[str] = None
    key_path: Optional[str] = None


@dataclass
class SAMLIdPConfig:
    """SAML Identity Provider configuration."""

    entity_id: str
    sso_url: str  # Single Sign-On URL
    slo_url: Optional[str] = None  # Single Logout URL
    x509_cert: str  # IdP's public certificate


class SAMLService:
    """SAML 2.0 Service Provider implementation."""

    def __init__(self, sp_config: SAMLConfig, idp_config: SAMLIdPConfig):
        self.sp_config = sp_config
        self.idp_config = idp_config
        self._auth = None

    def _get_settings(self) -> dict:
        """Build OneLogin SAML settings dictionary."""
        settings = {
            "strict": True,
            "debug": os.getenv("DEBUG", "false").lower() == "true",
            "sp": {
                "entityId": self.sp_config.entity_id,
                "assertionConsumerService": {
                    "url": self.sp_config.acs_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST",
                },
                "NameIDFormat": self.sp_config.name_id_format,
            },
            "idp": {
                "entityId": self.idp_config.entity_id,
                "singleSignOnService": {
                    "url": self.idp_config.sso_url,
                    "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
                },
                "x509cert": self.idp_config.x509_cert,
            },
            "security": {
                "nameIdEncrypted": False,
                "authnRequestsSigned": False,
                "logoutRequestSigned": False,
                "logoutResponseSigned": False,
                "signMetadata": False,
                "wantMessagesSigned": True,
                "wantAssertionsSigned": True,
                "wantAssertionsEncrypted": False,
                "wantNameId": True,
                "wantNameIdEncrypted": False,
            },
        }

        # Add SLO if configured
        if self.sp_config.sls_url:
            settings["sp"]["singleLogoutService"] = {
                "url": self.sp_config.sls_url,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            }

        if self.idp_config.slo_url:
            settings["idp"]["singleLogoutService"] = {
                "url": self.idp_config.slo_url,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect",
            }

        # Add SP certificate/key if configured
        if self.sp_config.cert_path and self.sp_config.key_path:
            with open(self.sp_config.cert_path) as f:
                settings["sp"]["x509cert"] = f.read()
            with open(self.sp_config.key_path) as f:
                settings["sp"]["privateKey"] = f.read()

        return settings

    def create_auth_request(self, request_data: dict) -> tuple[str, str]:
        """
        Create a SAML authentication request.

        Args:
            request_data: Dict with 'https', 'http_host', 'script_name', 'get_data', 'post_data'

        Returns:
            Tuple of (redirect_url, request_id)
        """
        try:
            from onelogin.saml2.auth import OneLogin_Saml2_Auth
        except ImportError:
            raise RuntimeError("python3-saml is required for SAML support")

        auth = OneLogin_Saml2_Auth(request_data, self._get_settings())
        redirect_url = auth.login()
        request_id = auth.get_last_request_id()
        return redirect_url, request_id

    def process_response(
        self,
        request_data: dict,
        expected_request_id: Optional[str] = None,
    ) -> SAMLUser:
        """
        Process a SAML response (assertion).

        Args:
            request_data: Dict with SAML response data
            expected_request_id: Optional request ID for validation

        Returns:
            SAMLUser with extracted user information

        Raises:
            ValueError: If SAML response is invalid
        """
        try:
            from onelogin.saml2.auth import OneLogin_Saml2_Auth
        except ImportError:
            raise RuntimeError("python3-saml is required for SAML support")

        auth = OneLogin_Saml2_Auth(request_data, self._get_settings())
        auth.process_response()

        errors = auth.get_errors()
        if errors:
            raise ValueError(f"SAML response error: {', '.join(errors)}")

        if not auth.is_authenticated():
            raise ValueError("SAML authentication failed")

        # Validate request ID if provided
        if expected_request_id:
            response_request_id = auth.get_last_response_in_response_to()
            if response_request_id != expected_request_id:
                raise ValueError("SAML response request ID mismatch")

        # Extract user information
        name_id = auth.get_nameid()
        attributes = auth.get_attributes()
        session_index = auth.get_session_index()

        # Common attribute mappings (varies by IdP)
        email = (
            attributes.get("email", [None])[0]
            or attributes.get("mail", [None])[0]
            or attributes.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", [None])[0]
            or name_id
        )

        name = (
            attributes.get("displayName", [None])[0]
            or attributes.get("cn", [None])[0]
            or attributes.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name", [None])[0]
            or email.split("@")[0] if email else "Unknown"
        )

        return SAMLUser(
            name_id=name_id,
            email=email,
            name=name,
            attributes=attributes,
            session_index=session_index,
        )

    def create_logout_request(
        self,
        request_data: dict,
        name_id: str,
        session_index: Optional[str] = None,
    ) -> str:
        """
        Create a SAML logout request.

        Returns:
            Redirect URL for logout
        """
        try:
            from onelogin.saml2.auth import OneLogin_Saml2_Auth
        except ImportError:
            raise RuntimeError("python3-saml is required for SAML support")

        auth = OneLogin_Saml2_Auth(request_data, self._get_settings())
        return auth.logout(
            name_id=name_id,
            session_index=session_index,
        )

    def get_metadata(self) -> str:
        """Generate SP metadata XML."""
        try:
            from onelogin.saml2.metadata import OneLogin_Saml2_Metadata
        except ImportError:
            raise RuntimeError("python3-saml is required for SAML support")

        settings = self._get_settings()
        metadata = OneLogin_Saml2_Metadata.builder(settings)
        return metadata
