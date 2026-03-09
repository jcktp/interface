"""SSO configuration tables

Revision ID: 004
Revises: 003
Create Date: 2024-01-15 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # SSO Configurations table - per-organization SSO settings
    op.create_table(
        "sso_configurations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "provider",
            sa.String(50),
            nullable=False,
            comment="OAuth provider: google, okta, azure, saml",
        ),
        sa.Column("name", sa.String(100), nullable=False, comment="Display name for this SSO config"),
        sa.Column("is_enabled", sa.Boolean, default=False, nullable=False),
        sa.Column("is_primary", sa.Boolean, default=False, nullable=False),

        # OAuth configuration
        sa.Column("client_id", sa.String(255), nullable=True),
        sa.Column(
            "client_secret_encrypted",
            sa.Text,
            nullable=True,
            comment="Encrypted client secret",
        ),
        sa.Column("redirect_uri", sa.String(500), nullable=True),
        sa.Column("scopes", sa.Text, nullable=True, comment="Space-separated scopes"),

        # Provider-specific configuration
        sa.Column("okta_domain", sa.String(255), nullable=True),
        sa.Column("azure_tenant_id", sa.String(100), nullable=True),
        sa.Column("google_hosted_domain", sa.String(255), nullable=True),

        # SAML configuration
        sa.Column("saml_entity_id", sa.String(500), nullable=True),
        sa.Column("saml_sso_url", sa.String(500), nullable=True),
        sa.Column("saml_slo_url", sa.String(500), nullable=True),
        sa.Column("saml_x509_cert", sa.Text, nullable=True),
        sa.Column("saml_name_id_format", sa.String(255), nullable=True),

        # Settings
        sa.Column(
            "auto_provision_users",
            sa.Boolean,
            default=True,
            nullable=False,
            comment="Auto-create users on first SSO login",
        ),
        sa.Column(
            "default_role",
            sa.String(50),
            default="viewer",
            nullable=False,
            comment="Default role for auto-provisioned users",
        ),
        sa.Column(
            "allowed_email_domains",
            sa.Text,
            nullable=True,
            comment="Comma-separated list of allowed email domains",
        ),

        # Metadata
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
    )

    # Unique constraint: one config per provider per organization
    op.create_unique_constraint(
        "uq_sso_config_org_provider",
        "sso_configurations",
        ["organization_id", "provider"],
    )

    # Index for lookups
    op.create_index(
        "ix_sso_configurations_org_enabled",
        "sso_configurations",
        ["organization_id", "is_enabled"],
    )

    # User SSO Links table - maps users to their SSO identities
    op.create_table(
        "user_sso_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sso_config_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sso_configurations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "provider_user_id",
            sa.String(255),
            nullable=False,
            comment="User ID from the OAuth provider",
        ),
        sa.Column("provider_email", sa.String(255), nullable=True),
        sa.Column("provider_name", sa.String(255), nullable=True),
        sa.Column("provider_picture_url", sa.String(500), nullable=True),
        sa.Column("provider_raw_data", postgresql.JSONB, nullable=True),

        # Tokens (encrypted)
        sa.Column("access_token_encrypted", sa.Text, nullable=True),
        sa.Column("refresh_token_encrypted", sa.Text, nullable=True),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=True),

        # Metadata
        sa.Column(
            "linked_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Unique constraint: one link per user per SSO config
    op.create_unique_constraint(
        "uq_user_sso_link_user_config",
        "user_sso_links",
        ["user_id", "sso_config_id"],
    )

    # Unique constraint: provider user ID must be unique within a config
    op.create_unique_constraint(
        "uq_user_sso_link_provider_user",
        "user_sso_links",
        ["sso_config_id", "provider_user_id"],
    )

    # Index for lookups by provider user ID
    op.create_index(
        "ix_user_sso_links_provider_user",
        "user_sso_links",
        ["sso_config_id", "provider_user_id"],
    )

    # SSO OAuth State table - for CSRF protection during OAuth flow
    op.create_table(
        "sso_oauth_states",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("state", sa.String(64), unique=True, nullable=False, index=True),
        sa.Column(
            "sso_config_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sso_configurations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("redirect_after", sa.String(500), nullable=True),
        sa.Column("nonce", sa.String(64), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "expires_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
    )

    # SSO Audit Log table - track SSO events
    op.create_table(
        "sso_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "sso_config_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sso_configurations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "event_type",
            sa.String(50),
            nullable=False,
            comment="login_success, login_failure, config_created, config_updated, user_linked, etc.",
        ),
        sa.Column("provider_user_id", sa.String(255), nullable=True),
        sa.Column("provider_email", sa.String(255), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Index for audit log queries
    op.create_index(
        "ix_sso_audit_logs_org_created",
        "sso_audit_logs",
        ["organization_id", "created_at"],
    )
    op.create_index(
        "ix_sso_audit_logs_user_created",
        "sso_audit_logs",
        ["user_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("sso_audit_logs")
    op.drop_table("sso_oauth_states")
    op.drop_table("user_sso_links")
    op.drop_table("sso_configurations")
