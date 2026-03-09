"""Initial schema for Interface

Revision ID: 001
Revises:
Create Date: 2026-01-25

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types
    op.execute("CREATE TYPE userrole AS ENUM ('admin', 'hr_manager', 'analyst', 'viewer')")
    op.execute("CREATE TYPE employeestatus AS ENUM ('active', 'terminated', 'on_leave')")
    op.execute("CREATE TYPE candidatestatus AS ENUM ('new', 'screening', 'interview', 'offer', 'hired', 'rejected')")
    op.execute("CREATE TYPE requisitionstatus AS ENUM ('open', 'filled', 'closed', 'on_hold')")
    op.execute("CREATE TYPE connectionstatus AS ENUM ('connected', 'disconnected', 'error', 'syncing')")

    # Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('role', postgresql.ENUM('admin', 'hr_manager', 'analyst', 'viewer', name='userrole', create_type=False), nullable=False),
        sa.Column('department', sa.String(100)),
        sa.Column('avatar_url', sa.String(500)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('last_login', sa.DateTime),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # Employees table
    op.create_table(
        'employees',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', sa.String(50), unique=True, nullable=False),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('phone', sa.String(50)),
        sa.Column('department', sa.String(100), nullable=False),
        sa.Column('job_title', sa.String(200), nullable=False),
        sa.Column('job_level', sa.String(50)),
        sa.Column('manager_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id')),
        sa.Column('location', sa.String(100)),
        sa.Column('work_type', sa.String(50)),
        sa.Column('status', postgresql.ENUM('active', 'terminated', 'on_leave', name='employeestatus', create_type=False)),
        sa.Column('hire_date', sa.Date, nullable=False),
        sa.Column('termination_date', sa.Date),
        sa.Column('termination_reason', sa.String(200)),
        sa.Column('salary', sa.Float),
        sa.Column('currency', sa.String(3), default='USD'),
        sa.Column('bonus_target', sa.Float),
        sa.Column('equity_grants', sa.Integer, default=0),
        sa.Column('age', sa.Integer),
        sa.Column('gender', sa.String(50)),
        sa.Column('ethnicity', sa.String(100)),
        sa.Column('date_of_birth', sa.Date),
        sa.Column('performance_rating', sa.Float),
        sa.Column('engagement_score', sa.Float),
        sa.Column('last_review_date', sa.Date),
        sa.Column('last_promotion_date', sa.Date),
        sa.Column('training_hours', sa.Float, default=0),
        sa.Column('tenure', sa.Float),
        sa.Column('flight_risk', sa.String(20)),
        sa.Column('source_system', sa.String(50)),
        sa.Column('external_id', sa.String(100)),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('raw_data', postgresql.JSON),
    )
    op.create_index('ix_employees_employee_id', 'employees', ['employee_id'])
    op.create_index('ix_employees_email', 'employees', ['email'])
    op.create_index('ix_employees_department', 'employees', ['department'])
    op.create_index('ix_employees_status', 'employees', ['status'])
    op.create_index('ix_employees_location', 'employees', ['location'])
    op.create_index('ix_employees_department_status', 'employees', ['department', 'status'])
    op.create_index('ix_employees_hire_date', 'employees', ['hire_date'])

    # Job Requisitions table
    op.create_table(
        'job_requisitions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('department', sa.String(100), nullable=False),
        sa.Column('location', sa.String(100)),
        sa.Column('job_level', sa.String(50)),
        sa.Column('status', postgresql.ENUM('open', 'filled', 'closed', 'on_hold', name='requisitionstatus', create_type=False)),
        sa.Column('open_date', sa.Date, nullable=False),
        sa.Column('target_fill_date', sa.Date),
        sa.Column('filled_date', sa.Date),
        sa.Column('closed_date', sa.Date),
        sa.Column('hiring_manager_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id')),
        sa.Column('recruiter_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('salary_min', sa.Float),
        sa.Column('salary_max', sa.Float),
        sa.Column('currency', sa.String(3), default='USD'),
        sa.Column('urgency', sa.String(20), default='medium'),
        sa.Column('headcount', sa.Integer, default=1),
        sa.Column('description', sa.Text),
        sa.Column('requirements', sa.Text),
        sa.Column('benefits', sa.Text),
        sa.Column('applicant_count', sa.Integer, default=0),
        sa.Column('interview_count', sa.Integer, default=0),
        sa.Column('offer_count', sa.Integer, default=0),
        sa.Column('source_system', sa.String(50)),
        sa.Column('external_id', sa.String(100)),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('raw_data', postgresql.JSON),
    )
    op.create_index('ix_job_requisitions_department', 'job_requisitions', ['department'])
    op.create_index('ix_job_requisitions_status', 'job_requisitions', ['status'])

    # Candidates table
    op.create_table(
        'candidates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(50)),
        sa.Column('applied_position', sa.String(200), nullable=False),
        sa.Column('requisition_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('job_requisitions.id')),
        sa.Column('department', sa.String(100)),
        sa.Column('application_date', sa.Date, nullable=False),
        sa.Column('source', sa.String(100)),
        sa.Column('status', postgresql.ENUM('new', 'screening', 'interview', 'offer', 'hired', 'rejected', name='candidatestatus', create_type=False)),
        sa.Column('stage', sa.String(100)),
        sa.Column('stage_entered_date', sa.DateTime),
        sa.Column('recruiter_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('hiring_manager_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id')),
        sa.Column('expected_salary', sa.Float),
        sa.Column('offered_salary', sa.Float),
        sa.Column('offer_date', sa.Date),
        sa.Column('offer_accepted_date', sa.Date),
        sa.Column('start_date', sa.Date),
        sa.Column('rejection_reason', sa.String(200)),
        sa.Column('rejection_date', sa.Date),
        sa.Column('resume_score', sa.Float),
        sa.Column('interview_score', sa.Float),
        sa.Column('assessment_score', sa.Float),
        sa.Column('overall_rating', sa.Float),
        sa.Column('notes', sa.Text),
        sa.Column('resume_url', sa.String(500)),
        sa.Column('source_system', sa.String(50)),
        sa.Column('external_id', sa.String(100)),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('raw_data', postgresql.JSON),
    )
    op.create_index('ix_candidates_email', 'candidates', ['email'])
    op.create_index('ix_candidates_status', 'candidates', ['status'])
    op.create_index('ix_candidates_department', 'candidates', ['department'])
    op.create_index('ix_candidates_source', 'candidates', ['source'])
    op.create_index('ix_candidates_status_date', 'candidates', ['status', 'application_date'])

    # API Connections table
    op.create_table(
        'api_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('connection_type', sa.String(20), nullable=False),
        sa.Column('status', postgresql.ENUM('connected', 'disconnected', 'error', 'syncing', name='connectionstatus', create_type=False)),
        sa.Column('last_sync', sa.DateTime),
        sa.Column('last_sync_status', sa.String(50)),
        sa.Column('last_error', sa.Text),
        sa.Column('api_key_encrypted', sa.Text),
        sa.Column('client_id', sa.String(255)),
        sa.Column('client_secret_encrypted', sa.Text),
        sa.Column('access_token_encrypted', sa.Text),
        sa.Column('refresh_token_encrypted', sa.Text),
        sa.Column('token_expires_at', sa.DateTime),
        sa.Column('endpoint_url', sa.String(500)),
        sa.Column('webhook_url', sa.String(500)),
        sa.Column('sync_frequency', sa.String(50)),
        sa.Column('data_types', postgresql.JSON),
        sa.Column('field_mappings', postgresql.JSON),
        sa.Column('records_synced', sa.Integer, default=0),
        sa.Column('records_failed', sa.Integer, default=0),
        sa.Column('sync_duration_seconds', sa.Float),
        sa.Column('created_by_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_api_connections_provider', 'api_connections', ['provider'])
    op.create_unique_constraint('uq_connection_provider_endpoint', 'api_connections', ['provider', 'endpoint_url'])

    # Data Uploads table
    op.create_table(
        'data_uploads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('file_type', sa.String(10), nullable=False),
        sa.Column('file_size', sa.Integer),
        sa.Column('data_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('progress', sa.Integer, default=0),
        sa.Column('total_records', sa.Integer),
        sa.Column('records_processed', sa.Integer, default=0),
        sa.Column('records_created', sa.Integer, default=0),
        sa.Column('records_updated', sa.Integer, default=0),
        sa.Column('records_failed', sa.Integer, default=0),
        sa.Column('errors', postgresql.JSON),
        sa.Column('quality_score', sa.Float),
        sa.Column('quality_issues', postgresql.JSON),
        sa.Column('cleaning_rules_applied', postgresql.JSON),
        sa.Column('file_path', sa.String(500)),
        sa.Column('preview_data', postgresql.JSON),
        sa.Column('column_mappings', postgresql.JSON),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime),
    )

    # Sync Logs table
    op.create_table(
        'sync_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('connection_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('api_connections.id'), nullable=False),
        sa.Column('sync_type', sa.String(50)),
        sa.Column('started_at', sa.DateTime, nullable=False),
        sa.Column('completed_at', sa.DateTime),
        sa.Column('status', sa.String(20)),
        sa.Column('records_fetched', sa.Integer, default=0),
        sa.Column('records_created', sa.Integer, default=0),
        sa.Column('records_updated', sa.Integer, default=0),
        sa.Column('records_deleted', sa.Integer, default=0),
        sa.Column('records_failed', sa.Integer, default=0),
        sa.Column('error_message', sa.Text),
        sa.Column('error_details', postgresql.JSON),
        sa.Column('duration_seconds', sa.Float),
        sa.Column('api_calls_made', sa.Integer, default=0),
    )
    op.create_index('ix_sync_logs_connection_date', 'sync_logs', ['connection_id', 'started_at'])


def downgrade() -> None:
    op.drop_table('sync_logs')
    op.drop_table('data_uploads')
    op.drop_table('api_connections')
    op.drop_table('candidates')
    op.drop_table('job_requisitions')
    op.drop_table('employees')
    op.drop_table('users')

    op.execute("DROP TYPE connectionstatus")
    op.execute("DROP TYPE requisitionstatus")
    op.execute("DROP TYPE candidatestatus")
    op.execute("DROP TYPE employeestatus")
    op.execute("DROP TYPE userrole")
