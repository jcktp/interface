"""Add Organization model for multi-tenancy

Revision ID: 002
Revises: 001
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '002'
down_revision: Union[str, None] = '001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(100), unique=True, nullable=False),
        sa.Column('domain', sa.String(255)),
        sa.Column('logo_url', sa.String(500)),
        sa.Column('industry', sa.String(100)),
        sa.Column('company_size', sa.String(50)),  # 1-10, 11-50, 51-200, etc.
        sa.Column('country', sa.String(100)),
        sa.Column('timezone', sa.String(50), default='UTC'),
        sa.Column('currency', sa.String(3), default='USD'),
        sa.Column('fiscal_year_start', sa.Integer, default=1),  # Month (1-12)

        # Subscription/billing
        sa.Column('plan', sa.String(50), default='trial'),  # trial, starter, professional, enterprise
        sa.Column('plan_started_at', sa.DateTime),
        sa.Column('plan_expires_at', sa.DateTime),
        sa.Column('billing_email', sa.String(255)),
        sa.Column('stripe_customer_id', sa.String(255)),

        # Feature flags
        sa.Column('features', postgresql.JSON, default={}),

        # Settings
        sa.Column('settings', postgresql.JSON, default={}),

        # Audit
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_organizations_slug', 'organizations', ['slug'])
    op.create_index('ix_organizations_domain', 'organizations', ['domain'])

    # Add organization_id to users
    op.add_column('users', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_users_organization',
        'users', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_users_organization_id', 'users', ['organization_id'])

    # Add organization_id to employees
    op.add_column('employees', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_employees_organization',
        'employees', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_employees_organization_id', 'employees', ['organization_id'])

    # Add organization_id to candidates
    op.add_column('candidates', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_candidates_organization',
        'candidates', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_candidates_organization_id', 'candidates', ['organization_id'])

    # Add organization_id to job_requisitions
    op.add_column('job_requisitions', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_job_requisitions_organization',
        'job_requisitions', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_job_requisitions_organization_id', 'job_requisitions', ['organization_id'])

    # Add organization_id to api_connections
    op.add_column('api_connections', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_api_connections_organization',
        'api_connections', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('ix_api_connections_organization_id', 'api_connections', ['organization_id'])

    # Add organization_id to data_uploads
    op.add_column('data_uploads', sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_data_uploads_organization',
        'data_uploads', 'organizations',
        ['organization_id'], ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    # Remove foreign keys and columns in reverse order
    op.drop_constraint('fk_data_uploads_organization', 'data_uploads', type_='foreignkey')
    op.drop_column('data_uploads', 'organization_id')

    op.drop_index('ix_api_connections_organization_id', 'api_connections')
    op.drop_constraint('fk_api_connections_organization', 'api_connections', type_='foreignkey')
    op.drop_column('api_connections', 'organization_id')

    op.drop_index('ix_job_requisitions_organization_id', 'job_requisitions')
    op.drop_constraint('fk_job_requisitions_organization', 'job_requisitions', type_='foreignkey')
    op.drop_column('job_requisitions', 'organization_id')

    op.drop_index('ix_candidates_organization_id', 'candidates')
    op.drop_constraint('fk_candidates_organization', 'candidates', type_='foreignkey')
    op.drop_column('candidates', 'organization_id')

    op.drop_index('ix_employees_organization_id', 'employees')
    op.drop_constraint('fk_employees_organization', 'employees', type_='foreignkey')
    op.drop_column('employees', 'organization_id')

    op.drop_index('ix_users_organization_id', 'users')
    op.drop_constraint('fk_users_organization', 'users', type_='foreignkey')
    op.drop_column('users', 'organization_id')

    op.drop_index('ix_organizations_domain', 'organizations')
    op.drop_index('ix_organizations_slug', 'organizations')
    op.drop_table('organizations')
