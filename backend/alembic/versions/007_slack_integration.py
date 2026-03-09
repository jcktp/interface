"""Slack integration tables

Revision ID: 007
Revises: 006
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Slack workspace connections
    op.create_table(
        'slack_workspaces',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('team_id', sa.String(50), unique=True, nullable=False),
        sa.Column('team_name', sa.String(255)),
        sa.Column('access_token_encrypted', sa.Text),
        sa.Column('bot_user_id', sa.String(50)),
        sa.Column('bot_access_token_encrypted', sa.Text),
        sa.Column('app_id', sa.String(50)),
        sa.Column('scope', sa.Text),
        sa.Column('installed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_slack_workspaces_org', 'slack_workspaces', ['organization_id'])
    op.create_index('ix_slack_workspaces_team', 'slack_workspaces', ['team_id'])

    # User mapping (Slack user <-> Interface user)
    op.create_table(
        'slack_user_mappings',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('slack_user_id', sa.String(50), nullable=False),
        sa.Column('slack_workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('slack_workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE')),
        sa.Column('slack_username', sa.String(255)),
        sa.Column('slack_email', sa.String(255)),
        sa.Column('slack_display_name', sa.String(255)),
        sa.Column('is_verified', sa.Boolean, default=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('slack_user_id', 'slack_workspace_id', name='uq_slack_user_workspace'),
    )
    op.create_index('ix_slack_user_mappings_slack_user', 'slack_user_mappings', ['slack_user_id', 'slack_workspace_id'])
    op.create_index('ix_slack_user_mappings_user', 'slack_user_mappings', ['user_id'])

    # Query/interaction history
    op.create_table(
        'slack_interactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('slack_workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('slack_workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('slack_user_id', sa.String(50), nullable=False),
        sa.Column('channel_id', sa.String(50)),
        sa.Column('interaction_type', sa.String(50), nullable=False),  # command, mention, modal, shortcut
        sa.Column('command', sa.String(100)),  # /hr, etc.
        sa.Column('query_text', sa.Text),
        sa.Column('response_summary', sa.Text),
        sa.Column('response_time_ms', sa.Integer),
        sa.Column('success', sa.Boolean, default=True),
        sa.Column('error_message', sa.Text),
        sa.Column('metadata', postgresql.JSONB),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('ix_slack_interactions_workspace', 'slack_interactions', ['slack_workspace_id'])
    op.create_index('ix_slack_interactions_user', 'slack_interactions', ['slack_user_id'])
    op.create_index('ix_slack_interactions_created', 'slack_interactions', ['created_at'])

    # Scheduled reports / notifications
    op.create_table(
        'slack_scheduled_reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('slack_workspace_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('slack_workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('channel_id', sa.String(50), nullable=False),
        sa.Column('report_type', sa.String(50), nullable=False),  # daily_metrics, weekly_summary, attrition_alert
        sa.Column('schedule', sa.String(50), nullable=False),  # cron expression or preset
        sa.Column('config', postgresql.JSONB),  # Report configuration
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('last_run_at', sa.DateTime),
        sa.Column('next_run_at', sa.DateTime),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_slack_scheduled_reports_workspace', 'slack_scheduled_reports', ['slack_workspace_id'])
    op.create_index('ix_slack_scheduled_reports_next_run', 'slack_scheduled_reports', ['next_run_at'])


def downgrade() -> None:
    op.drop_table('slack_scheduled_reports')
    op.drop_table('slack_interactions')
    op.drop_table('slack_user_mappings')
    op.drop_table('slack_workspaces')
