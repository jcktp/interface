"""Workforce planning tables

Revision ID: 005
Revises: 004
Create Date: 2024-01-20 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Planning Periods table (Q1 2024, FY 2025, etc.)
    op.create_table(
        "planning_periods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column("end_date", sa.Date, nullable=False),
        sa.Column(
            "status",
            sa.String(20),
            default="draft",
            nullable=False,
            comment="draft, active, closed",
        ),
        sa.Column(
            "period_type",
            sa.String(20),
            default="quarter",
            comment="month, quarter, half_year, year",
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
        ),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
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
    )

    # Index for period lookups
    op.create_index(
        "ix_planning_periods_org_status",
        "planning_periods",
        ["organization_id", "status"],
    )
    op.create_index(
        "ix_planning_periods_org_dates",
        "planning_periods",
        ["organization_id", "start_date", "end_date"],
    )

    # Workforce Plans table (the actual plan numbers by segment)
    op.create_table(
        "workforce_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "period_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("planning_periods.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        # Segmentation dimensions
        sa.Column("department", sa.String(100), index=True),
        sa.Column("job_family", sa.String(100)),
        sa.Column("job_level", sa.String(50)),
        sa.Column("location", sa.String(100)),
        sa.Column("cost_center", sa.String(50)),
        # Plan numbers (targets)
        sa.Column("starting_headcount", sa.Integer, default=0),
        sa.Column("planned_hires", sa.Integer, default=0),
        sa.Column("planned_attrition", sa.Integer, default=0),
        sa.Column("planned_transfers_in", sa.Integer, default=0),
        sa.Column("planned_transfers_out", sa.Integer, default=0),
        sa.Column("planned_ending_headcount", sa.Integer, default=0),
        # Budget
        sa.Column("avg_salary", sa.Numeric(12, 2)),
        sa.Column("total_compensation_budget", sa.Numeric(15, 2)),
        sa.Column("currency", sa.String(3), default="USD"),
        # Actual numbers (updated by sync from HRIS)
        sa.Column("actual_headcount", sa.Integer),
        sa.Column("actual_hires", sa.Integer, default=0),
        sa.Column("actual_attrition", sa.Integer, default=0),
        sa.Column("actual_transfers_in", sa.Integer, default=0),
        sa.Column("actual_transfers_out", sa.Integer, default=0),
        # Variance (calculated)
        sa.Column("headcount_variance", sa.Integer),
        sa.Column("hires_variance", sa.Integer),
        sa.Column("attrition_variance", sa.Integer),
        # Notes
        sa.Column("notes", sa.Text),
        # Metadata
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
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
    )

    # Unique constraint for plan segments
    op.create_unique_constraint(
        "uq_workforce_plan_segment",
        "workforce_plans",
        ["period_id", "department", "job_family", "job_level", "location"],
    )

    # Index for variance queries
    op.create_index(
        "ix_workforce_plans_period_dept",
        "workforce_plans",
        ["period_id", "department"],
    )

    # Workforce Plan History (audit trail)
    op.create_table(
        "workforce_plan_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workforce_plans.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "changed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "change_type",
            sa.String(50),
            nullable=False,
            comment="created, updated, approved, sync_updated",
        ),
        sa.Column("old_values", postgresql.JSONB),
        sa.Column("new_values", postgresql.JSONB),
        sa.Column("reason", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Index for history queries
    op.create_index(
        "ix_workforce_plan_history_plan_date",
        "workforce_plan_history",
        ["plan_id", "created_at"],
    )

    # Requisition Plan Links (link requisitions to plan)
    op.create_table(
        "requisition_plan_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "requisition_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("job_requisitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workforce_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(20),
            default="pending",
            comment="pending, approved, rejected",
        ),
        sa.Column(
            "approved_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
        ),
        sa.Column("approved_at", sa.DateTime(timezone=True)),
        sa.Column("rejection_reason", sa.Text),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Unique constraint
    op.create_unique_constraint(
        "uq_requisition_plan_link",
        "requisition_plan_links",
        ["requisition_id", "plan_id"],
    )

    # Planning Scenarios (for what-if modeling)
    op.create_table(
        "planning_scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "period_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("planning_periods.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "organization_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("is_baseline", sa.Boolean, default=False),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # Scenario plan adjustments
    op.create_table(
        "scenario_adjustments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "scenario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("planning_scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "plan_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("workforce_plans.id", ondelete="CASCADE"),
            nullable=False,
        ),
        # Adjustments to base plan
        sa.Column("hires_adjustment", sa.Integer, default=0),
        sa.Column("attrition_adjustment", sa.Integer, default=0),
        sa.Column("transfers_in_adjustment", sa.Integer, default=0),
        sa.Column("transfers_out_adjustment", sa.Integer, default=0),
        sa.Column("budget_adjustment", sa.Numeric(15, 2), default=0),
        sa.Column("notes", sa.Text),
    )


def downgrade() -> None:
    op.drop_table("scenario_adjustments")
    op.drop_table("planning_scenarios")
    op.drop_table("requisition_plan_links")
    op.drop_table("workforce_plan_history")
    op.drop_table("workforce_plans")
    op.drop_table("planning_periods")
