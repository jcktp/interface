"""Saved queries and query execution tables

Revision ID: 009
Revises: 008
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Saved queries table
    op.create_table(
        'saved_queries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('sql_query', sa.Text, nullable=False),
        sa.Column('is_public', sa.Boolean, default=False),
        sa.Column('tags', postgresql.ARRAY(sa.String(50))),

        # Metadata
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_saved_queries_org', 'saved_queries', ['organization_id'])
    op.create_index('ix_saved_queries_created_by', 'saved_queries', ['created_by'])

    # Query executions (audit log)
    op.create_table(
        'query_executions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('saved_query_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('saved_queries.id', ondelete='SET NULL')),
        sa.Column('sql_query', sa.Text, nullable=False),
        sa.Column('executed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),

        # Execution details
        sa.Column('status', sa.String(20), nullable=False),  # running, completed, failed, cancelled
        sa.Column('rows_returned', sa.Integer),
        sa.Column('execution_time_ms', sa.Integer),
        sa.Column('error_message', sa.Text),

        # Result caching (optional)
        sa.Column('result_hash', sa.String(64)),
        sa.Column('result_expires_at', sa.DateTime),

        sa.Column('started_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime),
    )
    op.create_index('ix_query_executions_org', 'query_executions', ['organization_id'])
    op.create_index('ix_query_executions_user', 'query_executions', ['executed_by'])
    op.create_index('ix_query_executions_started', 'query_executions', ['started_at'])


def downgrade() -> None:
    op.drop_table('query_executions')
    op.drop_table('saved_queries')
