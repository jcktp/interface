"""Add auth tokens tables for refresh tokens and email verifications

Revision ID: 003
Revises: 002
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '003'
down_revision: Union[str, None] = '002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Refresh tokens table
    op.create_table(
        'refresh_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('device_info', sa.String(255)),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('is_revoked', sa.Boolean, default=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('last_used_at', sa.DateTime),
    )
    op.create_index('ix_refresh_tokens_user_id', 'refresh_tokens', ['user_id'])
    op.create_index('ix_refresh_tokens_token_hash', 'refresh_tokens', ['token_hash'])

    # Email verifications table
    op.create_table(
        'email_verifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
    )
    op.create_index('ix_email_verifications_token_hash', 'email_verifications', ['token_hash'])

    # Password resets table
    op.create_table(
        'password_resets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('used_at', sa.DateTime),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
    )
    op.create_index('ix_password_resets_token_hash', 'password_resets', ['token_hash'])

    # Team invitations table
    op.create_table(
        'team_invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', postgresql.ENUM('admin', 'hr_manager', 'analyst', 'viewer', name='userrole', create_type=False), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('invited_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('accepted_at', sa.DateTime),
        sa.Column('accepted_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
    )
    op.create_index('ix_team_invitations_email', 'team_invitations', ['email'])
    op.create_index('ix_team_invitations_token_hash', 'team_invitations', ['token_hash'])
    op.create_index('ix_team_invitations_organization_id', 'team_invitations', ['organization_id'])

    # Add email_verified field to users
    op.add_column('users', sa.Column('email_verified_at', sa.DateTime))


def downgrade() -> None:
    op.drop_column('users', 'email_verified_at')

    op.drop_index('ix_team_invitations_organization_id', 'team_invitations')
    op.drop_index('ix_team_invitations_token_hash', 'team_invitations')
    op.drop_index('ix_team_invitations_email', 'team_invitations')
    op.drop_table('team_invitations')

    op.drop_index('ix_password_resets_token_hash', 'password_resets')
    op.drop_table('password_resets')

    op.drop_index('ix_email_verifications_token_hash', 'email_verifications')
    op.drop_table('email_verifications')

    op.drop_index('ix_refresh_tokens_token_hash', 'refresh_tokens')
    op.drop_index('ix_refresh_tokens_user_id', 'refresh_tokens')
    op.drop_table('refresh_tokens')
