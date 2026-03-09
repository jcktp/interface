"""Dashboard builder tables

Revision ID: 008
Revises: 007
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Dashboards table
    op.create_table(
        'dashboards',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('is_default', sa.Boolean, default=False),
        sa.Column('is_public', sa.Boolean, default=False),

        # Layout configuration (react-grid-layout format)
        sa.Column('layout', postgresql.JSONB, default=[]),

        # Widget configurations
        sa.Column('widgets', postgresql.JSONB, default=[]),

        # Filters that apply to all widgets
        sa.Column('global_filters', postgresql.JSONB, default={}),

        # Theme/styling
        sa.Column('theme', sa.String(50), default='light'),
        sa.Column('refresh_interval', sa.Integer),  # seconds, null = manual refresh

        # Ownership
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),

        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_dashboards_org', 'dashboards', ['organization_id'])
    op.create_index('ix_dashboards_created_by', 'dashboards', ['created_by'])

    # Dashboard shares table
    op.create_table(
        'dashboard_shares',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('dashboard_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('dashboards.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shared_with_user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE')),
        sa.Column('shared_with_role', sa.String(50)),  # Alternative: share with role
        sa.Column('permission', sa.String(20), default='view'),  # view, edit
        sa.Column('shared_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint('dashboard_id', 'shared_with_user_id', name='uq_dashboard_share_user'),
    )
    op.create_index('ix_dashboard_shares_dashboard', 'dashboard_shares', ['dashboard_id'])
    op.create_index('ix_dashboard_shares_user', 'dashboard_shares', ['shared_with_user_id'])

    # Widget templates (reusable widget configurations)
    op.create_table(
        'widget_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE')),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('widget_type', sa.String(50), nullable=False),
        sa.Column('config', postgresql.JSONB, nullable=False),
        sa.Column('is_system', sa.Boolean, default=False),  # Built-in templates
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('ix_widget_templates_org', 'widget_templates', ['organization_id'])


def downgrade() -> None:
    op.drop_table('widget_templates')
    op.drop_table('dashboard_shares')
    op.drop_table('dashboards')
