"""Compensation and budget planning tables

Revision ID: 006
Revises: 005
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Exchange rates table for multi-currency support
    op.create_table(
        'exchange_rates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('from_currency', sa.String(3), nullable=False),
        sa.Column('to_currency', sa.String(3), nullable=False),
        sa.Column('rate', sa.Numeric(12, 6), nullable=False),
        sa.Column('effective_date', sa.Date, nullable=False),
        sa.Column('source', sa.String(50)),  # manual, api
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.UniqueConstraint('from_currency', 'to_currency', 'effective_date', name='uq_exchange_rate')
    )
    op.create_index('ix_exchange_rates_currencies', 'exchange_rates', ['from_currency', 'to_currency'])
    op.create_index('ix_exchange_rates_date', 'exchange_rates', ['effective_date'])

    # Compensation plans table
    op.create_table(
        'compensation_plans',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('period_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('planning_periods.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('department', sa.String(100)),
        sa.Column('job_level', sa.String(50)),
        sa.Column('location', sa.String(100)),
        sa.Column('currency', sa.String(3), default='USD'),

        # Current state
        sa.Column('current_headcount', sa.Integer),
        sa.Column('current_total_salary', sa.Numeric(15, 2)),
        sa.Column('current_avg_salary', sa.Numeric(12, 2)),

        # Planned changes
        sa.Column('merit_increase_pct', sa.Numeric(5, 2), default=0),
        sa.Column('promotion_budget', sa.Numeric(15, 2), default=0),
        sa.Column('market_adjustment_budget', sa.Numeric(15, 2), default=0),
        sa.Column('new_hire_budget', sa.Numeric(15, 2), default=0),

        # Calculated totals
        sa.Column('planned_total_budget', sa.Numeric(15, 2)),
        sa.Column('planned_avg_salary', sa.Numeric(12, 2)),

        # Actuals
        sa.Column('actual_total_spend', sa.Numeric(15, 2)),
        sa.Column('actual_avg_salary', sa.Numeric(12, 2)),

        # Normalized to base currency (for roll-ups)
        sa.Column('base_currency', sa.String(3), default='USD'),
        sa.Column('planned_budget_base_currency', sa.Numeric(15, 2)),
        sa.Column('actual_spend_base_currency', sa.Numeric(15, 2)),
        sa.Column('exchange_rate_used', sa.Numeric(12, 6)),
        sa.Column('exchange_rate_date', sa.Date),

        sa.Column('notes', sa.Text),
        sa.Column('last_synced_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_compensation_plans_period', 'compensation_plans', ['period_id'])
    op.create_index('ix_compensation_plans_org', 'compensation_plans', ['organization_id'])
    op.create_index('ix_compensation_plans_dept', 'compensation_plans', ['department'])

    # Compensation changes table (individual salary changes)
    op.create_table(
        'compensation_changes',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('employees.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('compensation_plans.id', ondelete='CASCADE')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('change_type', sa.String(50), nullable=False),  # merit, promotion, market, equity_refresh, new_hire
        sa.Column('current_salary', sa.Numeric(12, 2)),
        sa.Column('new_salary', sa.Numeric(12, 2)),
        sa.Column('change_amount', sa.Numeric(12, 2)),
        sa.Column('change_pct', sa.Numeric(5, 2)),
        sa.Column('currency', sa.String(3), default='USD'),
        sa.Column('effective_date', sa.Date),
        sa.Column('reason', sa.Text),
        sa.Column('status', sa.String(20), default='proposed'),  # proposed, approved, rejected, applied
        sa.Column('proposed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('approved_at', sa.DateTime),
        sa.Column('applied_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_compensation_changes_employee', 'compensation_changes', ['employee_id'])
    op.create_index('ix_compensation_changes_plan', 'compensation_changes', ['plan_id'])
    op.create_index('ix_compensation_changes_status', 'compensation_changes', ['status'])
    op.create_index('ix_compensation_changes_type', 'compensation_changes', ['change_type'])

    # Compensation bands/ranges table
    op.create_table(
        'compensation_bands',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('job_family', sa.String(100)),
        sa.Column('job_level', sa.String(50)),
        sa.Column('location', sa.String(100)),
        sa.Column('currency', sa.String(3), default='USD'),
        sa.Column('min_salary', sa.Numeric(12, 2)),
        sa.Column('mid_salary', sa.Numeric(12, 2)),
        sa.Column('max_salary', sa.Numeric(12, 2)),
        sa.Column('effective_date', sa.Date),
        sa.Column('end_date', sa.Date),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_compensation_bands_org', 'compensation_bands', ['organization_id'])
    op.create_index('ix_compensation_bands_level', 'compensation_bands', ['job_level'])

    # Compensation plan history (audit trail)
    op.create_table(
        'compensation_plan_history',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('plan_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('compensation_plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('change_type', sa.String(50)),
        sa.Column('old_values', postgresql.JSONB),
        sa.Column('new_values', postgresql.JSONB),
        sa.Column('reason', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('ix_comp_plan_history_plan', 'compensation_plan_history', ['plan_id'])


def downgrade() -> None:
    op.drop_table('compensation_plan_history')
    op.drop_table('compensation_bands')
    op.drop_table('compensation_changes')
    op.drop_table('compensation_plans')
    op.drop_table('exchange_rates')
