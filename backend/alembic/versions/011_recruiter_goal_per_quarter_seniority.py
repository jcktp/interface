"""Add per-quarter seniority to recruiter goals

Revision ID: 011_recruiter_goal_per_quarter_seniority
Revises: 010
Create Date: 2026-03-06

"""
from alembic import op
import sqlalchemy as sa

revision = '011'
down_revision = '010'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('recruiter_goals', sa.Column('q1_seniority', sa.String(50), nullable=True))
    op.add_column('recruiter_goals', sa.Column('q2_seniority', sa.String(50), nullable=True))
    op.add_column('recruiter_goals', sa.Column('q3_seniority', sa.String(50), nullable=True))
    op.add_column('recruiter_goals', sa.Column('q4_seniority', sa.String(50), nullable=True))


def downgrade():
    op.drop_column('recruiter_goals', 'q4_seniority')
    op.drop_column('recruiter_goals', 'q3_seniority')
    op.drop_column('recruiter_goals', 'q2_seniority')
    op.drop_column('recruiter_goals', 'q1_seniority')
