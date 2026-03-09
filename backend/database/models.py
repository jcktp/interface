"""
SQLAlchemy models for Interface
"""

from datetime import datetime, date
from typing import Optional
from sqlalchemy import (
    Column, String, Integer, BigInteger, Float, Boolean, DateTime, Date,
    Text, JSON, ForeignKey, Enum, Index, UniqueConstraint, func,
)
from uuid import uuid4
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
import enum

from .connection import Base


class UserRole(enum.Enum):
    super_admin = "super_admin"  # Full access to everything, can manage all users and settings
    admin = "admin"              # Full access to data and features, can manage team users
    hr_manager = "hr_manager"    # Access to HR data and reports
    analyst = "analyst"          # Read-only access to analytics and reports
    viewer = "viewer"            # Limited read-only access


class EmployeeStatus(enum.Enum):
    active = "active"
    terminated = "terminated"
    on_leave = "on_leave"


class CandidateStatus(enum.Enum):
    new = "new"
    screening = "screening"
    interview = "interview"
    offer = "offer"
    hired = "hired"
    rejected = "rejected"


class RequisitionStatus(enum.Enum):
    open = "open"
    filled = "filled"
    closed = "closed"
    on_hold = "on_hold"


class ConnectionStatus(enum.Enum):
    connected = "connected"
    disconnected = "disconnected"
    error = "error"
    syncing = "syncing"


# ============== Organization Model ==============

class Organization(Base):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    domain = Column(String(255), index=True)
    logo_url = Column(String(500))
    industry = Column(String(100))
    company_size = Column(String(50))  # 1-10, 11-50, 51-200, etc.
    country = Column(String(100))
    timezone = Column(String(50), default='UTC')
    currency = Column(String(3), default='USD')
    display_currency = Column(String(3), default='USD')  # Currency for financial display / reporting
    fiscal_year_start = Column(Integer, default=1)  # Month (1-12)

    # Subscription/billing
    plan = Column(String(50), default='trial')  # trial, starter, professional, enterprise
    plan_started_at = Column(DateTime)
    plan_expires_at = Column(DateTime)
    billing_email = Column(String(255))
    stripe_customer_id = Column(String(255))

    # Equity Management
    equity_pool_total = Column(Float, default=0.0)
    equity_pool_remaining = Column(Float, default=0.0)

    # Feature flags
    features = Column(JSON, default={})

    # Settings
    settings = Column(JSON, default={})

    # Audit
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="organization")
    employees = relationship("Employee", back_populates="organization")
    candidates = relationship("Candidate", back_populates="organization")
    requisitions = relationship("JobRequisition", back_populates="organization")
    recruiter_goals = relationship("RecruiterGoal", back_populates="organization")
    financials = relationship("OrganizationFinancial", back_populates="organization", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Organization {self.name}>"


# ============== Organization Financials Model ==============

class OrganizationFinancial(Base):
    __tablename__ = "organization_financials"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    
    annual_revenue = Column(Float, default=0.0)
    annual_profit = Column(Float, default=0.0)
    equity_pool_total = Column(Float, default=0.0)
    equity_pool_remaining = Column(Float, default=0.0)
    
    currency = Column(String(3), default='USD')
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="financials")

    __table_args__ = (
        UniqueConstraint("organization_id", "year", name="uq_org_financial_year"),
        Index("ix_org_financials_org_year", "organization_id", "year"),
    )

    def __repr__(self):
        return f"<OrganizationFinancial {self.organization_id} Year {self.year}>"


# ============== User Model ==============

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.admin, nullable=False)  # Default to admin access
    department = Column(String(100))
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime)
    custom_permissions = Column(JSON, nullable=True)  # Override role-based permissions
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Organization (multi-tenancy)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    # Relationships
    organization = relationship("Organization", back_populates="users")
    data_uploads = relationship("DataUpload", back_populates="uploaded_by_user")

    def __repr__(self):
        return f"<User {self.email}>"


# ============== Employee Model ==============

class Employee(Base):
    __tablename__ = "employees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    phone = Column(String(50))

    # Job Information
    department = Column(String(100), nullable=False, index=True)
    team = Column(String(100), nullable=True)
    cost_center = Column(String(50), nullable=True)
    job_title = Column(String(200), nullable=False)
    job_level = Column(String(50))
    manager_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"))
    hired_by_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"))
    location = Column(String(100), index=True)
    work_type = Column(String(50))  # remote, hybrid, onsite

    # Employment Status
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.active, index=True)
    hire_date = Column(Date, nullable=False)
    termination_date = Column(Date)
    termination_reason = Column(String(200))

    # Compensation
    salary = Column(Float)
    currency = Column(String(3), default="USD")
    bonus_target = Column(Float)
    equity_grants = Column(Integer, default=0)
    equity_type = Column(String(50))  # RSU, Options, etc.
    equity_value = Column(Float, default=0.0)  # Estimated monetary value
    equity_shares = Column(Float, default=0.0)  # Number of shares/units

    # Demographics
    age = Column(Integer)
    gender = Column(String(50))
    ethnicity = Column(String(100))
    date_of_birth = Column(Date)

    # Performance & Engagement
    performance_rating = Column(Float)
    engagement_score = Column(Float)
    last_review_date = Column(Date)
    last_promotion_date = Column(Date)
    training_hours = Column(Float, default=0)

    # Source & Hiring Data
    previous_company = Column(String(200), nullable=True)
    reason_for_leaving = Column(Text, nullable=True)  # More detailed than termination_reason
    quality_of_hire_score = Column(Float, nullable=True)  # 0-100 score
    cost_per_hire = Column(Float, nullable=True)  # Dollar amount
    nationality = Column(String(100), nullable=True)  # e.g. "American", "British"
    employment_type = Column(String(50), nullable=True)  # Full-time, Part-time, Contract, Intern
    source = Column(String(100), nullable=True)  # LinkedIn, Referral, Indeed, Agency, etc.

    # PTO & Leave tracking
    total_pto_days = Column(Float, default=25.0)
    used_pto_days = Column(Float, default=0.0)
    total_bank_holidays = Column(Float, default=8.0)
    used_bank_holidays = Column(Float, default=0.0)

    # Calculated Fields
    tenure = Column(Float)  # Years
    flight_risk = Column(String(20))  # low, medium, high

    # Organization (multi-tenancy)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    # Metadata
    source_system = Column(String(50))  # workday, bamboohr, manual, etc.
    external_id = Column(String(100))  # ID from source system
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    raw_data = Column(JSON)  # Store original data from integrations

    # Relationships
    organization = relationship("Organization", back_populates="employees")
    # Self-referential relationship for manager
    manager = relationship("Employee", remote_side=[id], backref="direct_reports", foreign_keys=[manager_id])
    # Relationship for recruiter who hired this employee
    recruiter = relationship("Employee", remote_side=[id], backref="hires", foreign_keys=[hired_by_id])

    # Indexes for common queries
    __table_args__ = (
        Index("ix_employees_org_dept_status", "organization_id", "department", "status"),
        Index("ix_employees_org_loc_dept", "organization_id", "location", "department"),
        Index("ix_employees_org_hire_date", "organization_id", "hire_date"),
        Index("ix_employees_department_status", "department", "status"),
        Index("ix_employees_hire_date", "hire_date"),
        Index("ix_employees_location_department", "location", "department"),
    )

    def __repr__(self):
        return f"<Employee {self.employee_id}: {self.first_name} {self.last_name}>"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


# ============== Candidate Model ==============

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    phone = Column(String(50))

    # Application Details
    applied_position = Column(String(200), nullable=False)
    requisition_id = Column(UUID(as_uuid=True), ForeignKey("job_requisitions.id"))
    department = Column(String(100), index=True)
    application_date = Column(Date, nullable=False)
    source = Column(String(100), index=True)  # LinkedIn, Referral, Job Board, etc.

    # Status Tracking
    status = Column(Enum(CandidateStatus), default=CandidateStatus.new, index=True)
    stage = Column(String(100))  # More granular than status
    stage_entered_date = Column(DateTime)

    # Assignment
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    hiring_manager_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"))

    # Offer Details
    expected_salary = Column(Float)
    offered_salary = Column(Float)
    offer_date = Column(Date)
    offer_accepted_date = Column(Date)
    start_date = Column(Date)

    # Rejection
    rejection_reason = Column(String(200))
    rejection_date = Column(Date)

    # Assessment Scores
    resume_score = Column(Float)
    interview_score = Column(Float)
    assessment_score = Column(Float)
    overall_rating = Column(Float)

    # Notes & Documents
    notes = Column(Text)
    resume_url = Column(String(500))

    # Organization (multi-tenancy)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    # Metadata
    source_system = Column(String(50))  # greenhouse, lever, manual, etc.
    external_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    raw_data = Column(JSON)

    # Relationships
    organization = relationship("Organization", back_populates="candidates")
    requisition = relationship("JobRequisition", back_populates="candidates")
    interviews = relationship("Interview", back_populates="candidate", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_candidates_org_dept", "organization_id", "department"),
        Index("ix_candidates_org_status_date", "organization_id", "status", "application_date"),
        Index("ix_candidates_status_date", "status", "application_date"),
    )

    def __repr__(self):
        return f"<Candidate {self.email} for {self.applied_position}>"


# ============== Interview Model ==============

class Interview(Base):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    interviewer_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    
    interview_date = Column(DateTime, nullable=False, index=True)
    interview_type = Column(String(50))  # Screening, Technical, Behavioral, Culture Fit, Final
    score = Column(Float)  # 1-5 or 0-100
    recommendation = Column(String(50))  # hire, no_hire, strong_hire, weak_hire
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    candidate = relationship("Candidate", back_populates="interviews")
    interviewer = relationship("Employee", backref="interviews_conducted")
    organization = relationship("Organization")

    def __repr__(self):
        return f"<Interview {self.interview_type} for candidate {self.candidate_id}>"


# ============== Job Requisition Model ==============

class JobRequisition(Base):
    __tablename__ = "job_requisitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(200), nullable=False)
    department = Column(String(100), nullable=False, index=True)
    location = Column(String(100))
    job_level = Column(String(50))

    # Status & Dates
    status = Column(Enum(RequisitionStatus), default=RequisitionStatus.open, index=True)
    open_date = Column(Date, nullable=False)
    target_fill_date = Column(Date)
    filled_date = Column(Date)
    closed_date = Column(Date)

    # Assignment
    hiring_manager_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"))
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Compensation Range
    salary_min = Column(Float)
    salary_max = Column(Float)
    currency = Column(String(3), default="USD")

    # Priority & Metrics
    urgency = Column(String(20), default="medium")  # low, medium, high, critical
    headcount = Column(Integer, default=1)  # Number of positions

    # Job Details
    description = Column(Text)
    requirements = Column(Text)
    benefits = Column(Text)

    # Counts (denormalized for performance)
    applicant_count = Column(Integer, default=0)
    interview_count = Column(Integer, default=0)
    offer_count = Column(Integer, default=0)

    # Organization (multi-tenancy)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    # Metadata
    source_system = Column(String(50))
    external_id = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    raw_data = Column(JSON)

    # Relationships
    organization = relationship("Organization", back_populates="requisitions")
    candidates = relationship("Candidate", back_populates="requisition")

    __table_args__ = (
        Index("ix_requisitions_org_dept_status", "organization_id", "department", "status"),
    )

    def __repr__(self):
        return f"<JobRequisition {self.title} in {self.department}>"


# ============== API Connection Model ==============

class ApiConnection(Base):
    __tablename__ = "api_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    provider = Column(String(50), nullable=False, index=True)  # workday, bamboohr, etc.
    connection_type = Column(String(20), nullable=False)  # hris, ats, payroll

    # Connection Status
    status = Column(Enum(ConnectionStatus), default=ConnectionStatus.disconnected)
    last_sync = Column(DateTime)
    last_sync_status = Column(String(50))
    last_error = Column(Text)

    # Credentials (encrypted in production)
    api_key_encrypted = Column(Text)
    client_id = Column(String(255))
    client_secret_encrypted = Column(Text)
    access_token_encrypted = Column(Text)
    refresh_token_encrypted = Column(Text)
    token_expires_at = Column(DateTime)

    # Configuration
    endpoint_url = Column(String(500))
    webhook_url = Column(String(500))
    sync_frequency = Column(String(50))  # realtime, hourly, daily, weekly
    data_types = Column(JSON)  # List of data types to sync
    field_mappings = Column(JSON)  # Custom field mappings

    # Sync Statistics
    records_synced = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    sync_duration_seconds = Column(Float)

    # Metadata
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("provider", "endpoint_url", name="uq_connection_provider_endpoint"),
    )

    def __repr__(self):
        return f"<ApiConnection {self.provider}: {self.name}>"


# ============== Data Upload Model ==============

class DataUpload(Base):
    __tablename__ = "data_uploads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(10), nullable=False)  # csv, xlsx
    file_size = Column(Integer)  # bytes
    data_type = Column(String(50), nullable=False)  # employees, candidates, etc.

    # Processing Status
    status = Column(String(20), default="pending")  # pending, processing, completed, error
    progress = Column(Integer, default=0)  # 0-100

    # Results
    total_records = Column(Integer)
    records_processed = Column(Integer, default=0)
    records_created = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)
    errors = Column(JSON)  # List of error messages

    # Data Quality
    quality_score = Column(Float)
    quality_issues = Column(JSON)
    cleaning_rules_applied = Column(JSON)

    # Storage
    file_path = Column(String(500))
    preview_data = Column(JSON)
    column_mappings = Column(JSON)

    # Metadata
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    # Relationships
    uploaded_by_user = relationship("User", back_populates="data_uploads")

    def __repr__(self):
        return f"<DataUpload {self.filename} ({self.status})>"


# ============== Sync Log Model ==============

class SyncLog(Base):
    __tablename__ = "sync_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("api_connections.id"), nullable=False)
    sync_type = Column(String(50))  # full, incremental, webhook
    started_at = Column(DateTime, nullable=False)
    completed_at = Column(DateTime)
    status = Column(String(20))  # running, completed, failed

    # Statistics
    records_fetched = Column(Integer, default=0)
    records_created = Column(Integer, default=0)
    records_updated = Column(Integer, default=0)
    records_deleted = Column(Integer, default=0)
    records_failed = Column(Integer, default=0)

    # Error Details
    error_message = Column(Text)
    error_details = Column(JSON)

    # Performance
    duration_seconds = Column(Float)
    api_calls_made = Column(Integer, default=0)

    __table_args__ = (
        Index("ix_sync_logs_connection_date", "connection_id", "started_at"),
    )

    def __repr__(self):
        return f"<SyncLog {self.connection_id} at {self.started_at}>"


# ============== SSO Configuration Model ==============

class SSOProvider(enum.Enum):
    google = "google"
    okta = "okta"
    azure = "azure"
    saml = "saml"


class SSOConfiguration(Base):
    __tablename__ = "sso_configurations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    is_enabled = Column(Boolean, default=False, nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)

    # OAuth configuration
    client_id = Column(String(255))
    client_secret_encrypted = Column(Text)
    redirect_uri = Column(String(500))
    scopes = Column(Text)

    # Provider-specific configuration
    okta_domain = Column(String(255))
    azure_tenant_id = Column(String(100))
    google_hosted_domain = Column(String(255))

    # SAML configuration
    saml_entity_id = Column(String(500))
    saml_sso_url = Column(String(500))
    saml_slo_url = Column(String(500))
    saml_x509_cert = Column(Text)
    saml_name_id_format = Column(String(255))

    # Settings
    auto_provision_users = Column(Boolean, default=True, nullable=False)
    default_role = Column(String(50), default="viewer", nullable=False)
    allowed_email_domains = Column(Text)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Relationships
    organization = relationship("Organization")
    user_links = relationship("UserSSOLink", back_populates="sso_config", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "provider", name="uq_sso_config_org_provider"),
        Index("ix_sso_configurations_org_enabled", "organization_id", "is_enabled"),
    )

    def __repr__(self):
        return f"<SSOConfiguration {self.provider} for org {self.organization_id}>"


# ============== User SSO Link Model ==============

class UserSSOLink(Base):
    __tablename__ = "user_sso_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sso_config_id = Column(UUID(as_uuid=True), ForeignKey("sso_configurations.id", ondelete="CASCADE"), nullable=False)
    provider_user_id = Column(String(255), nullable=False)
    provider_email = Column(String(255))
    provider_name = Column(String(255))
    provider_picture_url = Column(String(500))
    provider_raw_data = Column(JSON)

    # Tokens (encrypted)
    access_token_encrypted = Column(Text)
    refresh_token_encrypted = Column(Text)
    token_expires_at = Column(DateTime)

    # Metadata
    linked_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime)

    # Relationships
    user = relationship("User")
    sso_config = relationship("SSOConfiguration", back_populates="user_links")

    __table_args__ = (
        UniqueConstraint("user_id", "sso_config_id", name="uq_user_sso_link_user_config"),
        UniqueConstraint("sso_config_id", "provider_user_id", name="uq_user_sso_link_provider_user"),
        Index("ix_user_sso_links_provider_user", "sso_config_id", "provider_user_id"),
    )

    def __repr__(self):
        return f"<UserSSOLink user={self.user_id} provider={self.sso_config_id}>"


# ============== SSO OAuth State Model ==============

class SSOOAuthState(Base):
    __tablename__ = "sso_oauth_states"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    state = Column(String(64), unique=True, nullable=False, index=True)
    sso_config_id = Column(UUID(as_uuid=True), ForeignKey("sso_configurations.id", ondelete="CASCADE"), nullable=False)
    redirect_after = Column(String(500))
    nonce = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)

    # Relationships
    sso_config = relationship("SSOConfiguration")

    def __repr__(self):
        return f"<SSOOAuthState {self.state[:8]}...>"


# ============== SSO Audit Log Model ==============

class SSOAuditLog(Base):
    __tablename__ = "sso_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="SET NULL"))
    sso_config_id = Column(UUID(as_uuid=True), ForeignKey("sso_configurations.id", ondelete="SET NULL"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    event_type = Column(String(50), nullable=False)
    provider_user_id = Column(String(255))
    provider_email = Column(String(255))
    ip_address = Column(String(45))
    user_agent = Column(String(500))
    error_message = Column(Text)
    event_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_sso_audit_logs_org_created", "organization_id", "created_at"),
        Index("ix_sso_audit_logs_user_created", "user_id", "created_at"),
    )


# ============== Workforce Planning Models ==============

class PlanningPeriodStatus(enum.Enum):
    draft = "draft"
    active = "active"
    closed = "closed"


class PlanningPeriod(Base):
    __tablename__ = "planning_periods"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(20), default="draft", nullable=False)
    period_type = Column(String(20), default="quarter")  # month, quarter, half_year, year

    # Approval
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    workforce_plans = relationship("WorkforcePlan", back_populates="period", cascade="all, delete-orphan")
    scenarios = relationship("PlanningScenario", back_populates="period", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_planning_periods_org_status", "organization_id", "status"),
        Index("ix_planning_periods_org_dates", "organization_id", "start_date", "end_date"),
    )

    def __repr__(self):
        return f"<PlanningPeriod {self.name}>"


class WorkforcePlan(Base):
    __tablename__ = "workforce_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_id = Column(UUID(as_uuid=True), ForeignKey("planning_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Segmentation dimensions
    department = Column(String(100), index=True)
    job_family = Column(String(100))
    job_level = Column(String(50))
    location = Column(String(100))
    cost_center = Column(String(50))

    # Plan numbers (targets)
    starting_headcount = Column(Integer, default=0)
    planned_hires = Column(Integer, default=0)
    planned_attrition = Column(Integer, default=0)
    planned_transfers_in = Column(Integer, default=0)
    planned_transfers_out = Column(Integer, default=0)
    planned_ending_headcount = Column(Integer, default=0)

    # Budget
    avg_salary = Column(Float)
    total_compensation_budget = Column(Float)
    currency = Column(String(3), default="USD")

    # Actual numbers (updated by sync from HRIS)
    actual_headcount = Column(Integer)
    actual_hires = Column(Integer, default=0)
    actual_attrition = Column(Integer, default=0)
    actual_transfers_in = Column(Integer, default=0)
    actual_transfers_out = Column(Integer, default=0)

    # Variance (calculated)
    headcount_variance = Column(Integer)
    hires_variance = Column(Integer)
    attrition_variance = Column(Integer)

    # Notes
    notes = Column(Text)

    # Metadata
    last_synced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    period = relationship("PlanningPeriod", back_populates="workforce_plans")
    organization = relationship("Organization")
    history = relationship("WorkforcePlanHistory", back_populates="plan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_workforce_plans_period_dept", "period_id", "department"),
    )

    def __repr__(self):
        return f"<WorkforcePlan {self.department} - {self.period_id}>"

    def calculate_variance(self):
        """Calculate variance between plan and actual."""
        if self.actual_headcount is not None and self.planned_ending_headcount is not None:
            self.headcount_variance = self.actual_headcount - self.planned_ending_headcount
        if self.actual_hires is not None:
            self.hires_variance = self.actual_hires - self.planned_hires
        if self.actual_attrition is not None:
            self.attrition_variance = self.actual_attrition - self.planned_attrition


class WorkforcePlanHistory(Base):
    __tablename__ = "workforce_plan_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("workforce_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    change_type = Column(String(50), nullable=False)  # created, updated, approved, sync_updated
    old_values = Column(JSON)
    new_values = Column(JSON)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    plan = relationship("WorkforcePlan", back_populates="history")
    user = relationship("User")

    __table_args__ = (
        Index("ix_workforce_plan_history_plan_date", "plan_id", "created_at"),
    )

    def __repr__(self):
        return f"<WorkforcePlanHistory {self.change_type} at {self.created_at}>"


class RequisitionPlanLink(Base):
    __tablename__ = "requisition_plan_links"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    requisition_id = Column(UUID(as_uuid=True), ForeignKey("job_requisitions.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("workforce_plans.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending")  # pending, approved, rejected
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime)
    rejection_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    requisition = relationship("JobRequisition")
    plan = relationship("WorkforcePlan")

    __table_args__ = (
        UniqueConstraint("requisition_id", "plan_id", name="uq_requisition_plan_link"),
    )


class PlanningScenario(Base):
    __tablename__ = "planning_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_id = Column(UUID(as_uuid=True), ForeignKey("planning_periods.id", ondelete="CASCADE"), nullable=False)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    is_baseline = Column(Boolean, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    period = relationship("PlanningPeriod", back_populates="scenarios")
    organization = relationship("Organization")
    adjustments = relationship("ScenarioAdjustment", back_populates="scenario", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<PlanningScenario {self.name}>"


class ScenarioAdjustment(Base):
    __tablename__ = "scenario_adjustments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scenario_id = Column(UUID(as_uuid=True), ForeignKey("planning_scenarios.id", ondelete="CASCADE"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("workforce_plans.id", ondelete="CASCADE"), nullable=False)

    # Adjustments to base plan
    hires_adjustment = Column(Integer, default=0)
    attrition_adjustment = Column(Integer, default=0)
    transfers_in_adjustment = Column(Integer, default=0)
    transfers_out_adjustment = Column(Integer, default=0)
    budget_adjustment = Column(Float, default=0)
    notes = Column(Text)

    # Relationships
    scenario = relationship("PlanningScenario", back_populates="adjustments")
    plan = relationship("WorkforcePlan")


# ============== Compensation Planning Models ==============

class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_currency = Column(String(3), nullable=False)
    to_currency = Column(String(3), nullable=False)
    rate = Column(Float, nullable=False)
    effective_date = Column(Date, nullable=False)
    source = Column(String(50))  # manual, api

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("from_currency", "to_currency", "effective_date", name="uq_exchange_rate"),
        Index("ix_exchange_rates_currencies", "from_currency", "to_currency"),
        Index("ix_exchange_rates_date", "effective_date"),
    )

    def __repr__(self):
        return f"<ExchangeRate {self.from_currency}/{self.to_currency} = {self.rate}>"


class CompensationPlan(Base):
    __tablename__ = "compensation_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    period_id = Column(UUID(as_uuid=True), ForeignKey("planning_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    # Segmentation
    department = Column(String(100), index=True)
    job_level = Column(String(50))
    location = Column(String(100))
    currency = Column(String(3), default="USD")

    # Current state
    current_headcount = Column(Integer)
    current_total_salary = Column(Float)
    current_avg_salary = Column(Float)
    current_total_equity = Column(Float, default=0.0)

    # Planned changes
    merit_increase_pct = Column(Float, default=0)
    promotion_budget = Column(Float, default=0)
    market_adjustment_budget = Column(Float, default=0)
    new_hire_budget = Column(Float, default=0)
    equity_budget = Column(Float, default=0)

    # Calculated totals
    planned_total_budget = Column(Float)
    planned_avg_salary = Column(Float)

    # Actuals
    actual_total_spend = Column(Float)
    actual_avg_salary = Column(Float)

    # Normalized to base currency (for roll-ups)
    base_currency = Column(String(3), default="USD")
    planned_budget_base_currency = Column(Float)
    actual_spend_base_currency = Column(Float)
    exchange_rate_used = Column(Float)
    exchange_rate_date = Column(Date)

    notes = Column(Text)
    last_synced_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    period = relationship("PlanningPeriod")
    organization = relationship("Organization")
    changes = relationship("CompensationChange", back_populates="plan", cascade="all, delete-orphan")
    history = relationship("CompensationPlanHistory", back_populates="plan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_compensation_plans_period_dept", "period_id", "department"),
    )

    def __repr__(self):
        return f"<CompensationPlan {self.department} - {self.period_id}>"

    def calculate_budget(self):
        """Calculate planned total budget from components."""
        if self.current_total_salary is not None:
            merit_amount = (self.current_total_salary * (self.merit_increase_pct or 0)) / 100
            self.planned_total_budget = (
                self.current_total_salary +
                merit_amount +
                (self.promotion_budget or 0) +
                (self.market_adjustment_budget or 0) +
                (self.new_hire_budget or 0)
            )
            if self.current_headcount and self.current_headcount > 0:
                self.planned_avg_salary = self.planned_total_budget / self.current_headcount


class CompensationChangeType(enum.Enum):
    merit = "merit"
    promotion = "promotion"
    market = "market"
    equity_refresh = "equity_refresh"
    new_hire = "new_hire"
    adjustment = "adjustment"


class CompensationChangeStatus(enum.Enum):
    proposed = "proposed"
    approved = "approved"
    rejected = "rejected"
    applied = "applied"


class CompensationChange(Base):
    __tablename__ = "compensation_changes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("compensation_plans.id", ondelete="CASCADE"), index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    change_type = Column(String(50), nullable=False)  # merit, promotion, market, equity_refresh, new_hire
    current_salary = Column(Float)
    new_salary = Column(Float)
    current_equity_shares = Column(Float, default=0.0)
    new_equity_shares = Column(Float, default=0.0)
    current_equity_value = Column(Float, default=0.0)
    new_equity_value = Column(Float, default=0.0)
    change_amount = Column(Float)
    change_pct = Column(Float)
    currency = Column(String(3), default="USD")
    effective_date = Column(Date)
    reason = Column(Text)

    status = Column(String(20), default="proposed")  # proposed, approved, rejected, applied
    proposed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime)
    applied_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    employee = relationship("Employee")
    plan = relationship("CompensationPlan", back_populates="changes")
    organization = relationship("Organization")

    __table_args__ = (
        Index("ix_compensation_changes_status", "status"),
        Index("ix_compensation_changes_type", "change_type"),
    )

    def __repr__(self):
        return f"<CompensationChange {self.change_type} for {self.employee_id}>"

    def calculate_change(self):
        """Calculate change amount and percentage."""
        if self.current_salary and self.new_salary:
            self.change_amount = self.new_salary - self.current_salary
            if self.current_salary > 0:
                self.change_pct = (self.change_amount / self.current_salary) * 100


class CompensationBand(Base):
    __tablename__ = "compensation_bands"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    job_family = Column(String(100))
    job_level = Column(String(50), index=True)
    location = Column(String(100))
    currency = Column(String(3), default="USD")
    min_salary = Column(Float)
    mid_salary = Column(Float)
    max_salary = Column(Float)
    effective_date = Column(Date)
    end_date = Column(Date)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")

    def __repr__(self):
        return f"<CompensationBand {self.job_level} {self.min_salary}-{self.max_salary}>"


class CompensationPlanHistory(Base):
    __tablename__ = "compensation_plan_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("compensation_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    change_type = Column(String(50))
    old_values = Column(JSON)
    new_values = Column(JSON)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    plan = relationship("CompensationPlan", back_populates="history")
    user = relationship("User")

    def __repr__(self):
        return f"<CompensationPlanHistory {self.change_type} at {self.created_at}>"


# ============== Slack Integration Models ==============

class SlackWorkspace(Base):
    __tablename__ = "slack_workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    team_id = Column(String(50), unique=True, nullable=False, index=True)
    team_name = Column(String(255))
    access_token_encrypted = Column(Text)
    bot_user_id = Column(String(50))
    bot_access_token_encrypted = Column(Text)
    app_id = Column(String(50))
    scope = Column(Text)
    installed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    user_mappings = relationship("SlackUserMapping", back_populates="workspace", cascade="all, delete-orphan")
    interactions = relationship("SlackInteraction", back_populates="workspace", cascade="all, delete-orphan")
    scheduled_reports = relationship("SlackScheduledReport", back_populates="workspace", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SlackWorkspace {self.team_name} ({self.team_id})>"


class SlackUserMapping(Base):
    __tablename__ = "slack_user_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slack_user_id = Column(String(50), nullable=False)
    slack_workspace_id = Column(UUID(as_uuid=True), ForeignKey("slack_workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    slack_username = Column(String(255))
    slack_email = Column(String(255))
    slack_display_name = Column(String(255))
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workspace = relationship("SlackWorkspace", back_populates="user_mappings")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("slack_user_id", "slack_workspace_id", name="uq_slack_user_workspace"),
        Index("ix_slack_user_mappings_slack_user", "slack_user_id", "slack_workspace_id"),
    )

    def __repr__(self):
        return f"<SlackUserMapping {self.slack_user_id} -> {self.user_id}>"


class SlackInteraction(Base):
    __tablename__ = "slack_interactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slack_workspace_id = Column(UUID(as_uuid=True), ForeignKey("slack_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    slack_user_id = Column(String(50), nullable=False, index=True)
    channel_id = Column(String(50))
    interaction_type = Column(String(50), nullable=False)  # command, mention, modal, shortcut
    command = Column(String(100))
    query_text = Column(Text)
    response_summary = Column(Text)
    response_time_ms = Column(Integer)
    success = Column(Boolean, default=True)
    error_message = Column(Text)
    interaction_metadata = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    workspace = relationship("SlackWorkspace", back_populates="interactions")

    def __repr__(self):
        return f"<SlackInteraction {self.interaction_type} by {self.slack_user_id}>"


class SlackScheduledReport(Base):
    __tablename__ = "slack_scheduled_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slack_workspace_id = Column(UUID(as_uuid=True), ForeignKey("slack_workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    channel_id = Column(String(50), nullable=False)
    report_type = Column(String(50), nullable=False)  # daily_metrics, weekly_summary, attrition_alert
    schedule = Column(String(50), nullable=False)  # cron expression or preset
    config = Column(JSON)
    is_active = Column(Boolean, default=True)
    last_run_at = Column(DateTime)
    next_run_at = Column(DateTime, index=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    workspace = relationship("SlackWorkspace", back_populates="scheduled_reports")
    creator = relationship("User")

    def __repr__(self):
        return f"<SlackScheduledReport {self.report_type} -> {self.channel_id}>"


# ============== Dashboard Models ==============

class Dashboard(Base):
    __tablename__ = "dashboards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_default = Column(Boolean, default=False)
    is_public = Column(Boolean, default=False)

    # Layout configuration (react-grid-layout format)
    layout = Column(JSON, default=[])

    # Widget configurations
    widgets = Column(JSON, default=[])

    # Global filters
    global_filters = Column(JSON, default={})

    # Theme/styling
    theme = Column(String(50), default="light")
    refresh_interval = Column(Integer)  # seconds

    # Ownership
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    creator = relationship("User", foreign_keys=[created_by])
    shares = relationship("DashboardShare", back_populates="dashboard", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Dashboard {self.name}>"


class DashboardShare(Base):
    __tablename__ = "dashboard_shares"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dashboard_id = Column(UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True)
    shared_with_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    shared_with_role = Column(String(50))
    permission = Column(String(20), default="view")  # view, edit
    shared_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    dashboard = relationship("Dashboard", back_populates="shares")
    user = relationship("User", foreign_keys=[shared_with_user_id])

    __table_args__ = (
        UniqueConstraint("dashboard_id", "shared_with_user_id", name="uq_dashboard_share_user"),
    )

    def __repr__(self):
        return f"<DashboardShare {self.dashboard_id} -> {self.shared_with_user_id}>"


# ============== Report Model ==============

class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    dashboard_id = Column(UUID(as_uuid=True), ForeignKey("dashboards.id", ondelete="SET NULL"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    # Report config
    report_type = Column(String(50), default="dashboard_snapshot")  # dashboard_snapshot, custom
    config = Column(JSON, default={})  # filters, date range, etc.

    # Sharing
    share_token = Column(String(64), unique=True, index=True)  # For public view-only links
    is_public = Column(Boolean, default=False)
    expires_at = Column(DateTime)  # Optional expiry for shared links

    # Scheduling
    schedule = Column(String(50))  # daily, weekly, monthly, or null
    recipients = Column(JSON, default=[])  # email list
    last_sent_at = Column(DateTime)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    organization = relationship("Organization")
    dashboard = relationship("Dashboard")
    creator = relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<Report {self.name}>"


class WidgetTemplate(Base):
    __tablename__ = "widget_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    widget_type = Column(String(50), nullable=False)
    config = Column(JSON, nullable=False)
    is_system = Column(Boolean, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")

    def __repr__(self):
        return f"<WidgetTemplate {self.name} ({self.widget_type})>"


# ============== Query Editor Models ==============

class SavedQuery(Base):
    __tablename__ = "saved_queries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    sql_query = Column(Text, nullable=False)
    is_public = Column(Boolean, default=False)
    tags = Column(JSON)  # Array of strings

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    creator = relationship("User", foreign_keys=[created_by])
    executions = relationship("QueryExecution", back_populates="saved_query", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SavedQuery {self.name}>"


class QueryExecution(Base):
    __tablename__ = "query_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    saved_query_id = Column(UUID(as_uuid=True), ForeignKey("saved_queries.id", ondelete="SET NULL"), index=True)
    sql_query = Column(Text, nullable=False)
    executed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    status = Column(String(20), nullable=False)  # running, completed, failed, cancelled
    rows_returned = Column(Integer)
    execution_time_ms = Column(Integer)
    error_message = Column(Text)

    result_hash = Column(String(64))
    result_expires_at = Column(DateTime)

    started_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime)

    # Relationships
    organization = relationship("Organization")
    saved_query = relationship("SavedQuery", back_populates="executions")
    executor = relationship("User")

    def __repr__(self):
        return f"<QueryExecution {self.status} at {self.started_at}>"


# ==================== ML Models ====================

class MLModel(Base):
    __tablename__ = "ml_models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    model_type = Column(String(50), nullable=False)  # attrition, headcount_forecast, etc.
    algorithm = Column(String(50))  # xgboost, random_forest, ensemble

    # Status
    status = Column(String(20), default='draft', index=True)  # draft, training, trained, active, archived
    is_active = Column(Boolean, default=False)

    # Configuration
    hyperparameters = Column(JSON)
    feature_config = Column(JSON)
    target_column = Column(String(100))

    # Training results
    metrics = Column(JSON)
    feature_importance = Column(JSON)
    confusion_matrix = Column(JSON)
    training_samples = Column(Integer)
    test_samples = Column(Integer)

    # Model storage
    model_path = Column(String(500))
    model_size_bytes = Column(BigInteger)
    model_version = Column(Integer, default=1)

    # Metadata
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    trained_at = Column(DateTime)
    activated_at = Column(DateTime)

    # Relationships
    organization = relationship("Organization")
    creator = relationship("User", foreign_keys=[created_by])
    training_jobs = relationship("MLTrainingJob", back_populates="model", cascade="all, delete-orphan")
    training_data = relationship("MLTrainingDataUpload", back_populates="model", cascade="all, delete-orphan")
    predictions = relationship("MLPrediction", back_populates="model", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MLModel {self.name} ({self.model_type})>"


class MLTrainingJob(Base):
    __tablename__ = "ml_training_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_models.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    # Job status
    status = Column(String(20), nullable=False, index=True)  # queued, running, completed, failed, cancelled
    progress = Column(Float, default=0)
    current_step = Column(String(100))

    # Configuration snapshot
    hyperparameters = Column(JSON)
    feature_config = Column(JSON)

    # Training data info
    training_data_id = Column(UUID(as_uuid=True))
    total_samples = Column(Integer)
    train_samples = Column(Integer)
    test_samples = Column(Integer)
    validation_samples = Column(Integer)

    # Results
    metrics = Column(JSON)
    feature_importance = Column(JSON)
    confusion_matrix = Column(JSON)
    training_logs = Column(JSON)
    error_message = Column(Text)

    # Timing
    started_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    duration_seconds = Column(Integer)

    # Relationships
    model = relationship("MLModel", back_populates="training_jobs")
    organization = relationship("Organization")
    starter = relationship("User", foreign_keys=[started_by])

    def __repr__(self):
        return f"<MLTrainingJob {self.status} for model {self.model_id}>"


class MLTrainingDataUpload(Base):
    __tablename__ = "ml_training_data_uploads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_models.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    filename = Column(String(255), nullable=False)
    file_path = Column(String(500))
    file_size_bytes = Column(BigInteger)
    file_type = Column(String(20))

    # Data stats
    row_count = Column(Integer)
    column_count = Column(Integer)
    columns = Column(JSON)
    data_preview = Column(JSON)
    column_stats = Column(JSON)

    # Processing status
    status = Column(String(20), default='uploaded')  # uploaded, validated, processed, error
    validation_errors = Column(JSON)

    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    model = relationship("MLModel", back_populates="training_data")
    organization = relationship("Organization")
    uploader = relationship("User", foreign_keys=[uploaded_by])

    def __repr__(self):
        return f"<MLTrainingDataUpload {self.filename}>"


class MLPrediction(Base):
    __tablename__ = "ml_predictions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model_id = Column(UUID(as_uuid=True), ForeignKey("ml_models.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)

    # Prediction info
    prediction_type = Column(String(50))  # batch, single, scheduled
    input_count = Column(Integer)
    input_hash = Column(String(64))

    # Results summary
    results_summary = Column(JSON)
    high_risk_count = Column(Integer)
    medium_risk_count = Column(Integer)
    low_risk_count = Column(Integer)

    requested_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    duration_ms = Column(Integer)

    # Relationships
    model = relationship("MLModel", back_populates="predictions")
    organization = relationship("Organization")
    requester = relationship("User", foreign_keys=[requested_by])

    def __repr__(self):
        return f"<MLPrediction {self.prediction_type} at {self.created_at}>"


# ============== Alert Enums ==============

class AlertSeverity(enum.Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class AlertStatus(enum.Enum):
    active = "active"
    acknowledged = "acknowledged"
    resolved = "resolved"
    dismissed = "dismissed"


class AttendanceStatus(enum.Enum):
    in_office = "in_office"
    remote = "remote"
    absent = "absent"
    leave = "leave"
    holiday = "holiday"


# ============== Org Health Alert Model ==============

class OrgHealthAlert(Base):
    __tablename__ = "org_health_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False, index=True)
    severity = Column(Enum(AlertSeverity), nullable=False, index=True)
    status = Column(Enum(AlertStatus), default=AlertStatus.active, nullable=False, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text)

    affected_org_unit = Column(String(100), index=True)
    affected_org_unit_type = Column(String(50))
    metric_name = Column(String(100))
    metric_value = Column(Float)
    threshold_value = Column(Float)

    trend_direction = Column(String(20))
    trend_period_days = Column(Integer)

    contributing_factors = Column(JSON)
    recommendations = Column(JSON)

    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    acknowledged_at = Column(DateTime)
    resolved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    resolved_at = Column(DateTime)
    resolution_notes = Column(Text)

    slack_delivered = Column(Boolean, default=False)
    slack_delivered_at = Column(DateTime)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime)

    # Relationships
    organization = relationship("Organization")

    __table_args__ = (
        Index("ix_org_health_alerts_org_status_severity", "organization_id", "status", "severity"),
        Index("ix_org_health_alerts_org_alert_type", "organization_id", "alert_type"),
    )

    def __repr__(self):
        return f"<OrgHealthAlert {self.alert_type} ({self.severity})>"


# ============== AI Conversation Models ==============

class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(255))

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    user = relationship("User")
    messages = relationship("AIMessage", back_populates="conversation", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<AIConversation {self.title}>"


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("ai_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)

    generated_sql = Column(Text)
    query_result = Column(JSON)
    chart_config = Column(JSON)
    context_data = Column(JSON)

    processing_time_ms = Column(Integer)
    llm_tokens_used = Column(Integer)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    conversation = relationship("AIConversation", back_populates="messages")
    organization = relationship("Organization")

    __table_args__ = (
        Index("ix_ai_messages_conversation_created", "conversation_id", "created_at"),
    )

    def __repr__(self):
        return f"<AIMessage {self.role} in {self.conversation_id}>"


# ============== KPI Models ==============

class KPIDefinition(Base):
    __tablename__ = "kpi_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    category = Column(String(50), index=True)
    metric_key = Column(String(100), nullable=False)
    unit = Column(String(20))

    calculation_sql = Column(Text)
    calculation_method = Column(String(50))

    display_format = Column(String(50))
    higher_is_better = Column(Boolean, default=True)

    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    targets = relationship("KPITarget", back_populates="kpi_definition", cascade="all, delete-orphan")
    measurements = relationship("KPIMeasurement", back_populates="kpi_definition", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("organization_id", "metric_key", name="uq_kpi_definition_org_metric_key"),
    )

    def __repr__(self):
        return f"<KPIDefinition {self.name} ({self.metric_key})>"


class KPITarget(Base):
    __tablename__ = "kpi_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kpi_definition_id = Column(UUID(as_uuid=True), ForeignKey("kpi_definitions.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    org_unit = Column(String(100))
    org_unit_type = Column(String(50))

    target_value = Column(Float, nullable=False)
    warning_threshold = Column(Float)
    critical_threshold = Column(Float)

    effective_from = Column(Date)
    effective_to = Column(Date)

    status = Column(String(20), default="active")
    proposed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    approved_at = Column(DateTime)

    version = Column(Integer, default=1)
    previous_version_id = Column(UUID(as_uuid=True), ForeignKey("kpi_targets.id"))
    change_reason = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    kpi_definition = relationship("KPIDefinition", back_populates="targets")
    organization = relationship("Organization")
    previous_version = relationship("KPITarget", remote_side=[id])

    __table_args__ = (
        Index("ix_kpi_targets_definition_org_unit", "kpi_definition_id", "org_unit"),
        Index("ix_kpi_targets_org_status", "organization_id", "status"),
    )

    def __repr__(self):
        return f"<KPITarget {self.kpi_definition_id} target={self.target_value}>"


class KPIMeasurement(Base):
    __tablename__ = "kpi_measurements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kpi_definition_id = Column(UUID(as_uuid=True), ForeignKey("kpi_definitions.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)

    org_unit = Column(String(100))
    org_unit_type = Column(String(50))

    measured_value = Column(Float, nullable=False)
    measurement_date = Column(Date, nullable=False, index=True)
    period_type = Column(String(20))

    target_value = Column(Float)
    variance = Column(Float)
    variance_pct = Column(Float)

    data_source = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    kpi_definition = relationship("KPIDefinition", back_populates="measurements")
    organization = relationship("Organization")

    __table_args__ = (
        Index("ix_kpi_measurements_definition_date", "kpi_definition_id", "measurement_date"),
        Index("ix_kpi_measurements_org_date", "organization_id", "measurement_date"),
        UniqueConstraint("kpi_definition_id", "org_unit", "measurement_date", "period_type", name="uq_kpi_measurement_unique"),
    )

    def __repr__(self):
        return f"<KPIMeasurement {self.kpi_definition_id} on {self.measurement_date}>"


# ============== Attendance Models ==============

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), nullable=False, index=True)

    record_date = Column(Date, nullable=False, index=True)
    status = Column(Enum(AttendanceStatus), nullable=False)

    location = Column(String(100))
    check_in_time = Column(DateTime)
    check_out_time = Column(DateTime)

    source_system = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    employee = relationship("Employee")

    __table_args__ = (
        UniqueConstraint("employee_id", "record_date", name="uq_attendance_employee_date"),
        Index("ix_attendance_records_org_date", "organization_id", "record_date"),
    )

    def __repr__(self):
        return f"<AttendanceRecord {self.employee_id} on {self.record_date}>"


class AttendanceTarget(Base):
    __tablename__ = "attendance_targets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    org_unit = Column(String(100), nullable=False)
    org_unit_type = Column(String(50))

    target_days_per_week = Column(Float)
    target_pct = Column(Float)

    effective_from = Column(Date)
    effective_to = Column(Date)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")

    __table_args__ = (
        Index("ix_attendance_targets_org_unit", "organization_id", "org_unit"),
    )

    def __repr__(self):
        return f"<AttendanceTarget {self.org_unit}>"


# ============== Attendance Policy Model ==============

class AttendancePolicy(Base):
    __tablename__ = "attendance_policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), unique=True, nullable=False)
    expected_office_days_per_week = Column(Integer, default=3)
    max_remote_days_per_week = Column(Integer, default=2)
    annual_pto_days = Column(Integer, default=25)
    bank_holidays = Column(JSON, default=list)
    country_configs = Column(JSON, default=[])
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    def __repr__(self):
        return f"<AttendancePolicy org={self.organization_id}>"


# ============== Warehouse Connection Model ==============

class WarehouseConnection(Base):
    __tablename__ = "warehouse_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    connection_type = Column(String(50), nullable=False)
    name = Column(String(255), nullable=False)

    status = Column(String(20), default="disconnected")

    config = Column(JSON)
    credentials_encrypted = Column(Text)

    dbt_project_id = Column(String(100))
    dbt_environment_id = Column(String(100))

    fivetran_group_id = Column(String(100))
    fivetran_connector_ids = Column(JSON)

    last_tested_at = Column(DateTime)
    last_sync_at = Column(DateTime)
    last_error = Column(Text)

    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")

    def __repr__(self):
        return f"<WarehouseConnection {self.name} ({self.connection_type})>"


# ============== Metric Definitions Model ==============

class MetricDefinition(Base):
    __tablename__ = "metric_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(50))
    formula = Column(Text)
    sql_expression = Column(Text, nullable=True)
    source_fields = Column(JSON, default=list)
    is_system = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    saved_query_id = Column(UUID(as_uuid=True), ForeignKey("saved_queries.id", ondelete="SET NULL"), nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    organization = relationship("Organization")
    saved_query = relationship("SavedQuery", foreign_keys=[saved_query_id])

    __table_args__ = (
        Index("ix_metric_definitions_org_active", "organization_id", "is_active"),
    )

    def __repr__(self):
        return f"<MetricDefinition {self.name}>"


# ============== Recruiter Goal Model ==============

class RecruiterGoal(Base):
    __tablename__ = "recruiter_goals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    seniority = Column(String(50), nullable=False)  # Junior, Mid, Senior
    location = Column(String(100))
    manager = Column(String(200))
    employment_type = Column(String(50), default='Full-time')  # Full-time, Part-time, Contract

    # Per-quarter seniority (defaults to the base seniority field)
    q1_seniority = Column(String(50), nullable=True)
    q2_seniority = Column(String(50), nullable=True)
    q3_seniority = Column(String(50), nullable=True)
    q4_seniority = Column(String(50), nullable=True)

    # Goals
    q1_goal = Column(Integer, default=0)
    q2_goal = Column(Integer, default=0)
    q3_goal = Column(Integer, default=0)
    q4_goal = Column(Integer, default=0)

    # Actuals
    q1_actual = Column(Integer, default=0)
    q2_actual = Column(Integer, default=0)
    q3_actual = Column(Integer, default=0)
    q4_actual = Column(Integer, default=0)

    # Capacity Planning
    monthly_capacity = Column(Integer, default=4)  # hires per month this recruiter can handle
    utilization_pct = Column(Integer, default=85)  # % of time on active recruiting
    specializations = Column(String(500))  # comma-separated role types e.g. "Senior,Executive"
    overhead_pct = Column(Integer, default=15)  # admin/overhead percentage
    max_concurrent_reqs = Column(Integer, default=8)  # max open reqs at once

    # Bonus
    eligible_for_bonus = Column(Boolean, default=False)
    bonus_notes = Column(String(500))

    # Archive support
    is_active = Column(Boolean, default=True, nullable=False)

    # Organization (multi-tenancy)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True)

    # Metadata
    year = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization", back_populates="recruiter_goals")

    def __repr__(self):
        return f"<RecruiterGoal {self.name} ({self.year})>"


class RecruitmentCapacityScenario(Base):
    __tablename__ = "recruitment_capacity_scenarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)

    # Forecast Parameters
    planning_horizon_months = Column(Integer, default=6)
    new_reqs_per_month = Column(Integer, default=5)
    attrition_backfill_rate = Column(Integer, default=100)
    
    # Efficiency Parameters
    interviews_per_offer = Column(Float, default=4.0)
    screens_per_interview = Column(Float, default=3.0)
    
    # Results snapshot (for quick comparison)
    total_demand_weighted = Column(Float)
    total_capacity_available = Column(Float)
    capacity_gap = Column(Float)
    status = Column(String(20)) # green, yellow, red

    is_active = Column(Boolean, default=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    creator = relationship("User")

    def __repr__(self):
        return f"<RecruitmentCapacityScenario {self.name}>"


# ============== Industry Benchmark Model ==============

class IndustryBenchmark(Base):
    __tablename__ = "industry_benchmarks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)  # e.g., "Tech Industry 2025"
    category = Column(String(100))  # e.g., "compensation", "retention", "recruitment"
    metric_name = Column(String(100), nullable=False)  # e.g., "avg_salary_engineering"
    metric_value = Column(Float, nullable=False)
    unit = Column(String(50))  # e.g., "USD", "percent", "days"
    source = Column(String(200))  # e.g., "Radford Survey 2025"
    year = Column(Integer)
    region = Column(String(100))  # e.g., "US", "EMEA"
    industry = Column(String(100))  # e.g., "Technology", "Finance"
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    organization = relationship("Organization")

    __table_args__ = (
        Index("ix_industry_benchmarks_org_category", "organization_id", "category"),
        Index("ix_industry_benchmarks_org_year", "organization_id", "year"),
    )

    def __repr__(self):
        return f"<IndustryBenchmark {self.name}: {self.metric_name}={self.metric_value}>"
