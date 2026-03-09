"""ML models and training tables

Revision ID: 010
Revises: 009
Create Date: 2025-01-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ML Models - stored model configurations and metadata
    op.create_table(
        'ml_models',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('model_type', sa.String(50), nullable=False),  # attrition, headcount_forecast, etc.
        sa.Column('algorithm', sa.String(50)),  # xgboost, random_forest, ensemble

        # Status
        sa.Column('status', sa.String(20), default='draft'),  # draft, training, trained, active, archived
        sa.Column('is_active', sa.Boolean, default=False),

        # Configuration
        sa.Column('hyperparameters', postgresql.JSONB),  # model-specific params
        sa.Column('feature_config', postgresql.JSONB),  # which features to use
        sa.Column('target_column', sa.String(100)),

        # Training results
        sa.Column('metrics', postgresql.JSONB),  # accuracy, precision, recall, f1, auc, etc.
        sa.Column('feature_importance', postgresql.JSONB),  # feature name -> importance score
        sa.Column('confusion_matrix', postgresql.JSONB),
        sa.Column('training_samples', sa.Integer),
        sa.Column('test_samples', sa.Integer),

        # Model storage
        sa.Column('model_path', sa.String(500)),  # S3 path or local path
        sa.Column('model_size_bytes', sa.BigInteger),
        sa.Column('model_version', sa.Integer, default=1),

        # Metadata
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('trained_at', sa.DateTime),
        sa.Column('activated_at', sa.DateTime),
    )
    op.create_index('ix_ml_models_org', 'ml_models', ['organization_id'])
    op.create_index('ix_ml_models_type', 'ml_models', ['model_type'])
    op.create_index('ix_ml_models_status', 'ml_models', ['status'])

    # ML Training Jobs - track training runs
    op.create_table(
        'ml_training_jobs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_models.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),

        # Job status
        sa.Column('status', sa.String(20), nullable=False),  # queued, running, completed, failed, cancelled
        sa.Column('progress', sa.Float, default=0),  # 0-100
        sa.Column('current_step', sa.String(100)),  # data_loading, preprocessing, training, evaluation

        # Configuration snapshot (at time of training)
        sa.Column('hyperparameters', postgresql.JSONB),
        sa.Column('feature_config', postgresql.JSONB),

        # Training data info
        sa.Column('training_data_id', postgresql.UUID(as_uuid=True)),
        sa.Column('total_samples', sa.Integer),
        sa.Column('train_samples', sa.Integer),
        sa.Column('test_samples', sa.Integer),
        sa.Column('validation_samples', sa.Integer),

        # Results
        sa.Column('metrics', postgresql.JSONB),
        sa.Column('feature_importance', postgresql.JSONB),
        sa.Column('confusion_matrix', postgresql.JSONB),
        sa.Column('training_logs', postgresql.JSONB),  # epoch-by-epoch metrics
        sa.Column('error_message', sa.Text),

        # Timing
        sa.Column('started_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime),
        sa.Column('completed_at', sa.DateTime),
        sa.Column('duration_seconds', sa.Integer),
    )
    op.create_index('ix_ml_training_jobs_model', 'ml_training_jobs', ['model_id'])
    op.create_index('ix_ml_training_jobs_status', 'ml_training_jobs', ['status'])

    # ML Training Data Uploads - custom training data
    op.create_table(
        'ml_training_data_uploads',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_models.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),

        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('file_path', sa.String(500)),  # storage path
        sa.Column('file_size_bytes', sa.BigInteger),
        sa.Column('file_type', sa.String(20)),  # csv, xlsx

        # Data stats
        sa.Column('row_count', sa.Integer),
        sa.Column('column_count', sa.Integer),
        sa.Column('columns', postgresql.JSONB),  # column names and types
        sa.Column('data_preview', postgresql.JSONB),  # first few rows
        sa.Column('column_stats', postgresql.JSONB),  # min, max, mean, nulls per column

        # Processing status
        sa.Column('status', sa.String(20), default='uploaded'),  # uploaded, validated, processed, error
        sa.Column('validation_errors', postgresql.JSONB),

        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('ix_ml_training_data_model', 'ml_training_data_uploads', ['model_id'])

    # ML Model Predictions Log - track predictions made
    op.create_table(
        'ml_predictions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('model_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('ml_models.id', ondelete='CASCADE'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),

        # Prediction info
        sa.Column('prediction_type', sa.String(50)),  # batch, single, scheduled
        sa.Column('input_count', sa.Integer),
        sa.Column('input_hash', sa.String(64)),  # for deduplication

        # Results summary
        sa.Column('results_summary', postgresql.JSONB),  # aggregated stats
        sa.Column('high_risk_count', sa.Integer),  # for attrition: count of high risk
        sa.Column('medium_risk_count', sa.Integer),
        sa.Column('low_risk_count', sa.Integer),

        sa.Column('requested_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id')),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('duration_ms', sa.Integer),
    )
    op.create_index('ix_ml_predictions_model', 'ml_predictions', ['model_id'])
    op.create_index('ix_ml_predictions_created', 'ml_predictions', ['created_at'])


def downgrade() -> None:
    op.drop_table('ml_predictions')
    op.drop_table('ml_training_data_uploads')
    op.drop_table('ml_training_jobs')
    op.drop_table('ml_models')
