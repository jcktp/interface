"""SSO Service - handles OAuth/SAML authentication flows."""

from datetime import datetime, timedelta
from typing import Optional
import secrets
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select

from database.models import (
    SSOConfiguration,
    UserSSOLink,
    SSOOAuthState,
    SSOAuditLog,
    User,
    Organization,
    UserRole,
)
from services.oauth import GoogleOAuth, OktaOAuth, AzureOAuth, OAuthUser
from services.oauth.saml import SAMLService, SAMLConfig, SAMLIdPConfig
from utils.jwt import create_access_token, create_refresh_token


class SSOService:
    """Service for managing SSO authentication."""

    def __init__(self, db: Session):
        self.db = db

    def get_sso_config(self, config_id: str) -> Optional[SSOConfiguration]:
        """Get SSO configuration by ID."""
        return self.db.query(SSOConfiguration).filter(
            SSOConfiguration.id == config_id,
            SSOConfiguration.is_enabled == True,
        ).first()

    def get_org_sso_configs(self, organization_id: str) -> list[SSOConfiguration]:
        """Get all enabled SSO configurations for an organization."""
        return self.db.query(SSOConfiguration).filter(
            SSOConfiguration.organization_id == organization_id,
            SSOConfiguration.is_enabled == True,
        ).all()

    def get_sso_config_by_provider(
        self, organization_id: str, provider: str
    ) -> Optional[SSOConfiguration]:
        """Get SSO configuration by organization and provider."""
        return self.db.query(SSOConfiguration).filter(
            SSOConfiguration.organization_id == organization_id,
            SSOConfiguration.provider == provider,
            SSOConfiguration.is_enabled == True,
        ).first()

    def _get_oauth_provider(self, config: SSOConfiguration):
        """Create OAuth provider instance from configuration."""
        redirect_uri = config.redirect_uri or f"/api/auth/oauth/{config.provider}/callback"
        scopes = config.scopes.split() if config.scopes else None

        if config.provider == "google":
            return GoogleOAuth(
                client_id=config.client_id,
                client_secret=self._decrypt_secret(config.client_secret_encrypted),
                redirect_uri=redirect_uri,
                scopes=scopes,
            )
        elif config.provider == "okta":
            if not config.okta_domain:
                raise ValueError("Okta domain is required")
            return OktaOAuth(
                client_id=config.client_id,
                client_secret=self._decrypt_secret(config.client_secret_encrypted),
                redirect_uri=redirect_uri,
                okta_domain=config.okta_domain,
                scopes=scopes,
            )
        elif config.provider == "azure":
            return AzureOAuth(
                client_id=config.client_id,
                client_secret=self._decrypt_secret(config.client_secret_encrypted),
                redirect_uri=redirect_uri,
                tenant_id=config.azure_tenant_id or "common",
                scopes=scopes,
            )
        else:
            raise ValueError(f"Unsupported OAuth provider: {config.provider}")

    def _get_saml_service(self, config: SSOConfiguration) -> SAMLService:
        """Create SAML service instance from configuration."""
        sp_config = SAMLConfig(
            entity_id=f"https://interface.app/saml/{config.organization_id}",
            acs_url=f"/api/auth/saml/acs/{config.id}",
            name_id_format=config.saml_name_id_format or "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
        )
        idp_config = SAMLIdPConfig(
            entity_id=config.saml_entity_id,
            sso_url=config.saml_sso_url,
            slo_url=config.saml_slo_url,
            x509_cert=config.saml_x509_cert,
        )
        return SAMLService(sp_config, idp_config)

    def _decrypt_secret(self, encrypted: Optional[str]) -> str:
        """Decrypt a stored secret. In production, use proper encryption."""
        # TODO: Implement proper encryption/decryption
        return encrypted or ""

    def _encrypt_secret(self, plaintext: str) -> str:
        """Encrypt a secret for storage. In production, use proper encryption."""
        # TODO: Implement proper encryption
        return plaintext

    def create_oauth_state(
        self,
        config: SSOConfiguration,
        redirect_after: Optional[str] = None,
    ) -> tuple[str, str]:
        """Create OAuth state for CSRF protection."""
        state = secrets.token_urlsafe(32)
        nonce = secrets.token_urlsafe(32)

        oauth_state = SSOOAuthState(
            id=uuid.uuid4(),
            state=state,
            sso_config_id=config.id,
            redirect_after=redirect_after,
            nonce=nonce,
            expires_at=datetime.utcnow() + timedelta(minutes=10),
        )
        self.db.add(oauth_state)
        self.db.commit()

        return state, nonce

    def validate_oauth_state(self, state: str) -> Optional[SSOOAuthState]:
        """Validate and consume OAuth state."""
        oauth_state = self.db.query(SSOOAuthState).filter(
            SSOOAuthState.state == state,
            SSOOAuthState.expires_at > datetime.utcnow(),
        ).first()

        if oauth_state:
            # Delete the state after validation (one-time use)
            self.db.delete(oauth_state)
            self.db.commit()

        return oauth_state

    def get_authorization_url(
        self,
        config: SSOConfiguration,
        redirect_after: Optional[str] = None,
    ) -> str:
        """Generate OAuth authorization URL."""
        state, nonce = self.create_oauth_state(config, redirect_after)
        provider = self._get_oauth_provider(config)

        if hasattr(provider, 'get_authorization_url'):
            # For Okta/Azure that support nonce
            if config.provider in ("okta", "azure"):
                return provider.get_authorization_url(state, nonce=nonce)
            return provider.get_authorization_url(state)

        raise ValueError("Provider does not support authorization URL generation")

    async def handle_oauth_callback(
        self,
        config: SSOConfiguration,
        code: str,
        state: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> dict:
        """Handle OAuth callback and authenticate user."""
        # Validate state
        oauth_state = self.validate_oauth_state(state)
        if not oauth_state:
            self._log_event(
                config=config,
                event_type="login_failure",
                error_message="Invalid or expired OAuth state",
                ip_address=ip_address,
                user_agent=user_agent,
            )
            raise ValueError("Invalid or expired OAuth state")

        # Exchange code for user info
        provider = self._get_oauth_provider(config)
        try:
            oauth_user = await provider.authenticate(code)
        except Exception as e:
            self._log_event(
                config=config,
                event_type="login_failure",
                error_message=str(e),
                ip_address=ip_address,
                user_agent=user_agent,
            )
            raise

        # Find or create user
        return await self._authenticate_user(
            config=config,
            oauth_user=oauth_user,
            redirect_after=oauth_state.redirect_after,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def _authenticate_user(
        self,
        config: SSOConfiguration,
        oauth_user: OAuthUser,
        redirect_after: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> dict:
        """Authenticate or provision user based on OAuth user info."""
        # Check allowed email domains
        if config.allowed_email_domains:
            allowed_domains = [d.strip().lower() for d in config.allowed_email_domains.split(",")]
            email_domain = oauth_user.email.split("@")[1].lower() if "@" in oauth_user.email else ""
            if email_domain not in allowed_domains:
                self._log_event(
                    config=config,
                    event_type="login_failure",
                    provider_user_id=oauth_user.provider_user_id,
                    provider_email=oauth_user.email,
                    error_message=f"Email domain not allowed: {email_domain}",
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                raise ValueError(f"Email domain {email_domain} is not allowed for this organization")

        # Check if user already exists by SSO link
        sso_link = self.db.query(UserSSOLink).filter(
            UserSSOLink.sso_config_id == config.id,
            UserSSOLink.provider_user_id == oauth_user.provider_user_id,
        ).first()

        if sso_link:
            # Update SSO link with latest info
            sso_link.provider_email = oauth_user.email
            sso_link.provider_name = oauth_user.name
            sso_link.provider_picture_url = oauth_user.picture
            sso_link.provider_raw_data = oauth_user.raw_data
            sso_link.last_login_at = datetime.utcnow()

            user = self.db.query(User).filter(User.id == sso_link.user_id).first()
        else:
            # Check if user exists by email
            user = self.db.query(User).filter(
                User.email == oauth_user.email,
                User.organization_id == config.organization_id,
            ).first()

            if user:
                # Link existing user to SSO
                sso_link = UserSSOLink(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    sso_config_id=config.id,
                    provider_user_id=oauth_user.provider_user_id,
                    provider_email=oauth_user.email,
                    provider_name=oauth_user.name,
                    provider_picture_url=oauth_user.picture,
                    provider_raw_data=oauth_user.raw_data,
                    last_login_at=datetime.utcnow(),
                )
                self.db.add(sso_link)
                self._log_event(
                    config=config,
                    event_type="user_linked",
                    user=user,
                    provider_user_id=oauth_user.provider_user_id,
                    provider_email=oauth_user.email,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
            elif config.auto_provision_users:
                # Create new user
                user = User(
                    id=uuid.uuid4(),
                    email=oauth_user.email,
                    name=oauth_user.name,
                    password_hash="",  # SSO users don't have passwords
                    role=UserRole(config.default_role),
                    avatar_url=oauth_user.picture,
                    organization_id=config.organization_id,
                    is_active=True,
                )
                self.db.add(user)
                self.db.flush()  # Get user ID

                # Create SSO link
                sso_link = UserSSOLink(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    sso_config_id=config.id,
                    provider_user_id=oauth_user.provider_user_id,
                    provider_email=oauth_user.email,
                    provider_name=oauth_user.name,
                    provider_picture_url=oauth_user.picture,
                    provider_raw_data=oauth_user.raw_data,
                    last_login_at=datetime.utcnow(),
                )
                self.db.add(sso_link)
                self._log_event(
                    config=config,
                    event_type="user_provisioned",
                    user=user,
                    provider_user_id=oauth_user.provider_user_id,
                    provider_email=oauth_user.email,
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
            else:
                self._log_event(
                    config=config,
                    event_type="login_failure",
                    provider_user_id=oauth_user.provider_user_id,
                    provider_email=oauth_user.email,
                    error_message="User does not exist and auto-provisioning is disabled",
                    ip_address=ip_address,
                    user_agent=user_agent,
                )
                raise ValueError("User not found. Please contact your administrator.")

        # Update user last login
        user.last_login = datetime.utcnow()
        self.db.commit()

        # Generate tokens
        access_token = create_access_token({"sub": str(user.id), "email": user.email})
        refresh_token = create_refresh_token({"sub": str(user.id)})

        self._log_event(
            config=config,
            event_type="login_success",
            user=user,
            provider_user_id=oauth_user.provider_user_id,
            provider_email=oauth_user.email,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role.value,
                "avatar_url": user.avatar_url,
            },
            "redirect_to": redirect_after or "/app/dashboard",
        }

    def _log_event(
        self,
        config: Optional[SSOConfiguration],
        event_type: str,
        user: Optional[User] = None,
        provider_user_id: Optional[str] = None,
        provider_email: Optional[str] = None,
        error_message: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        """Log an SSO event."""
        log = SSOAuditLog(
            id=uuid.uuid4(),
            organization_id=config.organization_id if config else None,
            sso_config_id=config.id if config else None,
            user_id=user.id if user else None,
            event_type=event_type,
            provider_user_id=provider_user_id,
            provider_email=provider_email,
            ip_address=ip_address,
            user_agent=user_agent,
            error_message=error_message,
            metadata=metadata,
        )
        self.db.add(log)
        self.db.commit()

    # Admin methods for managing SSO configs

    def create_sso_config(
        self,
        organization_id: str,
        provider: str,
        name: str,
        client_id: str,
        client_secret: str,
        created_by: Optional[str] = None,
        **kwargs,
    ) -> SSOConfiguration:
        """Create a new SSO configuration."""
        config = SSOConfiguration(
            id=uuid.uuid4(),
            organization_id=organization_id,
            provider=provider,
            name=name,
            client_id=client_id,
            client_secret_encrypted=self._encrypt_secret(client_secret),
            created_by=created_by,
            **kwargs,
        )
        self.db.add(config)

        self._log_event(
            config=config,
            event_type="config_created",
            metadata={"provider": provider, "name": name},
        )

        self.db.commit()
        return config

    def update_sso_config(
        self,
        config_id: str,
        **updates,
    ) -> SSOConfiguration:
        """Update an SSO configuration."""
        config = self.db.query(SSOConfiguration).filter(
            SSOConfiguration.id == config_id
        ).first()

        if not config:
            raise ValueError("SSO configuration not found")

        # Handle secret encryption
        if "client_secret" in updates:
            updates["client_secret_encrypted"] = self._encrypt_secret(updates.pop("client_secret"))

        for key, value in updates.items():
            if hasattr(config, key):
                setattr(config, key, value)

        self._log_event(
            config=config,
            event_type="config_updated",
            metadata={"updated_fields": list(updates.keys())},
        )

        self.db.commit()
        return config

    def delete_sso_config(self, config_id: str):
        """Delete an SSO configuration."""
        config = self.db.query(SSOConfiguration).filter(
            SSOConfiguration.id == config_id
        ).first()

        if not config:
            raise ValueError("SSO configuration not found")

        self._log_event(
            config=config,
            event_type="config_deleted",
        )

        self.db.delete(config)
        self.db.commit()
