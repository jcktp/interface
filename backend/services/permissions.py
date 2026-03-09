"""
Role-based permissions system for Interface.

Defines permissions for each role and provides utilities for checking access.
"""

from enum import Enum
from typing import List, Set, Optional, Callable
from functools import wraps
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session

from database.models import User, UserRole
from database.connection import get_db


class Permission(str, Enum):
    """All available permissions in the system."""

    # User management
    USERS_VIEW = "users:view"
    USERS_CREATE = "users:create"
    USERS_EDIT = "users:edit"
    USERS_DELETE = "users:delete"
    USERS_MANAGE_ROLES = "users:manage_roles"

    # Organization settings
    ORG_VIEW = "org:view"
    ORG_EDIT = "org:edit"
    ORG_MANAGE_SSO = "org:manage_sso"
    ORG_MANAGE_BILLING = "org:manage_billing"

    # Employee data
    EMPLOYEES_VIEW = "employees:view"
    EMPLOYEES_VIEW_SALARY = "employees:view_salary"
    EMPLOYEES_VIEW_PII = "employees:view_pii"
    EMPLOYEES_CREATE = "employees:create"
    EMPLOYEES_EDIT = "employees:edit"
    EMPLOYEES_DELETE = "employees:delete"
    EMPLOYEES_EXPORT = "employees:export"

    # Candidate data
    CANDIDATES_VIEW = "candidates:view"
    CANDIDATES_CREATE = "candidates:create"
    CANDIDATES_EDIT = "candidates:edit"
    CANDIDATES_DELETE = "candidates:delete"

    # Job requisitions
    REQUISITIONS_VIEW = "requisitions:view"
    REQUISITIONS_CREATE = "requisitions:create"
    REQUISITIONS_EDIT = "requisitions:edit"
    REQUISITIONS_DELETE = "requisitions:delete"
    REQUISITIONS_APPROVE = "requisitions:approve"

    # Analytics and reports
    ANALYTICS_VIEW = "analytics:view"
    ANALYTICS_EXPORT = "analytics:export"
    REPORTS_CREATE = "reports:create"
    REPORTS_SCHEDULE = "reports:schedule"

    # Dashboards
    DASHBOARDS_VIEW = "dashboards:view"
    DASHBOARDS_CREATE = "dashboards:create"
    DASHBOARDS_EDIT = "dashboards:edit"
    DASHBOARDS_DELETE = "dashboards:delete"
    DASHBOARDS_SHARE = "dashboards:share"

    # Data integrations
    INTEGRATIONS_VIEW = "integrations:view"
    INTEGRATIONS_CREATE = "integrations:create"
    INTEGRATIONS_EDIT = "integrations:edit"
    INTEGRATIONS_DELETE = "integrations:delete"
    INTEGRATIONS_SYNC = "integrations:sync"

    # Data uploads
    UPLOADS_VIEW = "uploads:view"
    UPLOADS_CREATE = "uploads:create"
    UPLOADS_DELETE = "uploads:delete"

    # SQL queries (admin only)
    QUERIES_EXECUTE = "queries:execute"
    QUERIES_VIEW_ALL = "queries:view_all"

    # ML models
    ML_MODELS_VIEW = "ml:view"
    ML_MODELS_CREATE = "ml:create"
    ML_MODELS_TRAIN = "ml:train"
    ML_MODELS_ACTIVATE = "ml:activate"
    ML_MODELS_DELETE = "ml:delete"

    # Workforce planning
    PLANNING_VIEW = "planning:view"
    PLANNING_CREATE = "planning:create"
    PLANNING_EDIT = "planning:edit"
    PLANNING_APPROVE = "planning:approve"

    # Compensation planning
    COMPENSATION_VIEW = "compensation:view"
    COMPENSATION_VIEW_DETAILS = "compensation:view_details"
    COMPENSATION_EDIT = "compensation:edit"
    COMPENSATION_APPROVE = "compensation:approve"

    # Slack integration
    SLACK_MANAGE = "slack:manage"
    SLACK_USE = "slack:use"

    # System administration
    SYSTEM_ADMIN = "system:admin"
    AUDIT_LOGS_VIEW = "audit:view"

    # 2Model: Command Center & Org Health
    COMMAND_CENTER_VIEW = "command_center:view"
    COMMAND_CENTER_MANAGE = "command_center:manage"

    # 2Model: AI Q&A
    AI_QA_USE = "ai_qa:use"
    AI_QA_VIEW_HISTORY = "ai_qa:view_history"

    # 2Model: Alerts & Risk Detection
    ALERTS_VIEW = "alerts:view"
    ALERTS_MANAGE = "alerts:manage"
    ALERTS_RUN_DETECTION = "alerts:run_detection"

    # 2Model: Deep Dive Analysis
    DEEP_DIVE_VIEW = "deep_dive:view"

    # 2Model: KPIs, Goals & Benchmarks
    KPIS_VIEW = "kpis:view"
    KPIS_CREATE = "kpis:create"
    KPIS_EDIT = "kpis:edit"
    KPIS_APPROVE_TARGETS = "kpis:approve_targets"

    # 2Model: Office Attendance
    ATTENDANCE_VIEW = "attendance:view"
    ATTENDANCE_MANAGE = "attendance:manage"
    ATTENDANCE_IMPORT = "attendance:import"

    # 2Model: Data Warehouse
    WAREHOUSE_VIEW = "warehouse:view"
    WAREHOUSE_MANAGE = "warehouse:manage"
    WAREHOUSE_QUERY = "warehouse:query"


# Role to permissions mapping
ROLE_PERMISSIONS: dict[UserRole, Set[Permission]] = {
    UserRole.super_admin: set(Permission),  # All permissions

    UserRole.admin: {
        # User management (except role management for super_admin)
        Permission.USERS_VIEW,
        Permission.USERS_CREATE,
        Permission.USERS_EDIT,
        Permission.USERS_DELETE,
        Permission.USERS_MANAGE_ROLES,

        # Organization (except SSO and billing)
        Permission.ORG_VIEW,
        Permission.ORG_EDIT,

        # Full employee access
        Permission.EMPLOYEES_VIEW,
        Permission.EMPLOYEES_VIEW_SALARY,
        Permission.EMPLOYEES_VIEW_PII,
        Permission.EMPLOYEES_CREATE,
        Permission.EMPLOYEES_EDIT,
        Permission.EMPLOYEES_DELETE,
        Permission.EMPLOYEES_EXPORT,

        # Full candidate access
        Permission.CANDIDATES_VIEW,
        Permission.CANDIDATES_CREATE,
        Permission.CANDIDATES_EDIT,
        Permission.CANDIDATES_DELETE,

        # Full requisitions access
        Permission.REQUISITIONS_VIEW,
        Permission.REQUISITIONS_CREATE,
        Permission.REQUISITIONS_EDIT,
        Permission.REQUISITIONS_DELETE,
        Permission.REQUISITIONS_APPROVE,

        # Full analytics access
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.REPORTS_CREATE,
        Permission.REPORTS_SCHEDULE,

        # Full dashboard access
        Permission.DASHBOARDS_VIEW,
        Permission.DASHBOARDS_CREATE,
        Permission.DASHBOARDS_EDIT,
        Permission.DASHBOARDS_DELETE,
        Permission.DASHBOARDS_SHARE,

        # Full integration access
        Permission.INTEGRATIONS_VIEW,
        Permission.INTEGRATIONS_CREATE,
        Permission.INTEGRATIONS_EDIT,
        Permission.INTEGRATIONS_DELETE,
        Permission.INTEGRATIONS_SYNC,

        # Full upload access
        Permission.UPLOADS_VIEW,
        Permission.UPLOADS_CREATE,
        Permission.UPLOADS_DELETE,

        # SQL queries
        Permission.QUERIES_EXECUTE,
        Permission.QUERIES_VIEW_ALL,

        # ML models
        Permission.ML_MODELS_VIEW,
        Permission.ML_MODELS_CREATE,
        Permission.ML_MODELS_TRAIN,
        Permission.ML_MODELS_ACTIVATE,
        Permission.ML_MODELS_DELETE,

        # Planning
        Permission.PLANNING_VIEW,
        Permission.PLANNING_CREATE,
        Permission.PLANNING_EDIT,
        Permission.PLANNING_APPROVE,

        # Compensation
        Permission.COMPENSATION_VIEW,
        Permission.COMPENSATION_VIEW_DETAILS,
        Permission.COMPENSATION_EDIT,
        Permission.COMPENSATION_APPROVE,

        # Slack
        Permission.SLACK_MANAGE,
        Permission.SLACK_USE,

        # Audit
        Permission.AUDIT_LOGS_VIEW,

        # 2Model
        Permission.COMMAND_CENTER_VIEW,
        Permission.COMMAND_CENTER_MANAGE,
        Permission.AI_QA_USE,
        Permission.AI_QA_VIEW_HISTORY,
        Permission.ALERTS_VIEW,
        Permission.ALERTS_MANAGE,
        Permission.ALERTS_RUN_DETECTION,
        Permission.DEEP_DIVE_VIEW,
        Permission.KPIS_VIEW,
        Permission.KPIS_CREATE,
        Permission.KPIS_EDIT,
        Permission.KPIS_APPROVE_TARGETS,
        Permission.ATTENDANCE_VIEW,
        Permission.ATTENDANCE_MANAGE,
        Permission.ATTENDANCE_IMPORT,
        Permission.WAREHOUSE_VIEW,
        Permission.WAREHOUSE_MANAGE,
        Permission.WAREHOUSE_QUERY,
    },

    UserRole.hr_manager: {
        # View users only
        Permission.USERS_VIEW,

        # Organization view
        Permission.ORG_VIEW,

        # Full employee access (including sensitive data)
        Permission.EMPLOYEES_VIEW,
        Permission.EMPLOYEES_VIEW_SALARY,
        Permission.EMPLOYEES_VIEW_PII,
        Permission.EMPLOYEES_CREATE,
        Permission.EMPLOYEES_EDIT,
        Permission.EMPLOYEES_EXPORT,

        # Full candidate access
        Permission.CANDIDATES_VIEW,
        Permission.CANDIDATES_CREATE,
        Permission.CANDIDATES_EDIT,

        # Requisitions (create and edit, not approve)
        Permission.REQUISITIONS_VIEW,
        Permission.REQUISITIONS_CREATE,
        Permission.REQUISITIONS_EDIT,

        # Analytics
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.REPORTS_CREATE,

        # Dashboards
        Permission.DASHBOARDS_VIEW,
        Permission.DASHBOARDS_CREATE,
        Permission.DASHBOARDS_EDIT,
        Permission.DASHBOARDS_SHARE,

        # View integrations only
        Permission.INTEGRATIONS_VIEW,

        # Uploads
        Permission.UPLOADS_VIEW,
        Permission.UPLOADS_CREATE,

        # ML models view only
        Permission.ML_MODELS_VIEW,

        # Planning (view and edit, not approve)
        Permission.PLANNING_VIEW,
        Permission.PLANNING_CREATE,
        Permission.PLANNING_EDIT,

        # Compensation
        Permission.COMPENSATION_VIEW,
        Permission.COMPENSATION_VIEW_DETAILS,
        Permission.COMPENSATION_EDIT,

        # Slack
        Permission.SLACK_USE,

        # 2Model
        Permission.COMMAND_CENTER_VIEW,
        Permission.COMMAND_CENTER_MANAGE,
        Permission.AI_QA_USE,
        Permission.AI_QA_VIEW_HISTORY,
        Permission.ALERTS_VIEW,
        Permission.ALERTS_MANAGE,
        Permission.DEEP_DIVE_VIEW,
        Permission.KPIS_VIEW,
        Permission.KPIS_CREATE,
        Permission.KPIS_EDIT,
        Permission.ATTENDANCE_VIEW,
        Permission.ATTENDANCE_MANAGE,
        Permission.ATTENDANCE_IMPORT,
        Permission.WAREHOUSE_VIEW,
    },

    UserRole.analyst: {
        # Organization view
        Permission.ORG_VIEW,

        # Employee data (no PII or salary)
        Permission.EMPLOYEES_VIEW,
        Permission.EMPLOYEES_EXPORT,

        # Candidates view
        Permission.CANDIDATES_VIEW,

        # Requisitions view
        Permission.REQUISITIONS_VIEW,

        # Full analytics access
        Permission.ANALYTICS_VIEW,
        Permission.ANALYTICS_EXPORT,
        Permission.REPORTS_CREATE,
        Permission.REPORTS_SCHEDULE,

        # Dashboards (create and edit own)
        Permission.DASHBOARDS_VIEW,
        Permission.DASHBOARDS_CREATE,
        Permission.DASHBOARDS_EDIT,

        # View integrations
        Permission.INTEGRATIONS_VIEW,

        # View uploads
        Permission.UPLOADS_VIEW,

        # ML models
        Permission.ML_MODELS_VIEW,
        Permission.ML_MODELS_CREATE,
        Permission.ML_MODELS_TRAIN,

        # Planning view
        Permission.PLANNING_VIEW,

        # Compensation view (no details)
        Permission.COMPENSATION_VIEW,

        # Slack
        Permission.SLACK_USE,

        # 2Model
        Permission.COMMAND_CENTER_VIEW,
        Permission.AI_QA_USE,
        Permission.AI_QA_VIEW_HISTORY,
        Permission.ALERTS_VIEW,
        Permission.DEEP_DIVE_VIEW,
        Permission.KPIS_VIEW,
        Permission.ATTENDANCE_VIEW,
        Permission.WAREHOUSE_VIEW,
    },

    UserRole.viewer: {
        # Organization view
        Permission.ORG_VIEW,

        # Employee view (limited)
        Permission.EMPLOYEES_VIEW,

        # Candidates view
        Permission.CANDIDATES_VIEW,

        # Requisitions view
        Permission.REQUISITIONS_VIEW,

        # Basic analytics
        Permission.ANALYTICS_VIEW,

        # View dashboards only
        Permission.DASHBOARDS_VIEW,

        # Planning view
        Permission.PLANNING_VIEW,

        # Slack
        Permission.SLACK_USE,

        # 2Model (limited)
        Permission.COMMAND_CENTER_VIEW,
        Permission.ALERTS_VIEW,
        Permission.KPIS_VIEW,
        Permission.ATTENDANCE_VIEW,
    },
}


def get_permissions_for_role(role: UserRole) -> Set[Permission]:
    """Get all permissions for a given role."""
    return ROLE_PERMISSIONS.get(role, set())


def get_user_permissions(user: User) -> Set[Permission]:
    """Get effective permissions for a user.

    If the user has custom_permissions set (not None), those override the
    role-based defaults. Otherwise, fall back to role-based permissions.
    """
    if not user:
        return set()

    # Check for custom permissions override
    if hasattr(user, 'custom_permissions') and user.custom_permissions is not None:
        custom_set: Set[Permission] = set()
        for perm_str in user.custom_permissions:
            try:
                custom_set.add(Permission(perm_str))
            except ValueError:
                pass  # Skip invalid permission strings
        return custom_set

    # Fall back to role-based permissions
    return get_permissions_for_role(user.role) if user.role else set()


def has_permission(user: User, permission: Permission) -> bool:
    """Check if a user has a specific permission."""
    if not user:
        return False
    return permission in get_user_permissions(user)


def has_any_permission(user: User, permissions: List[Permission]) -> bool:
    """Check if a user has any of the specified permissions."""
    if not user:
        return False
    user_permissions = get_user_permissions(user)
    return bool(user_permissions.intersection(permissions))


def has_all_permissions(user: User, permissions: List[Permission]) -> bool:
    """Check if a user has all of the specified permissions."""
    if not user:
        return False
    user_permissions = get_user_permissions(user)
    return all(p in user_permissions for p in permissions)


def can_manage_user(manager: User, target_user: User) -> bool:
    """Check if a manager can manage a target user."""
    if not manager or not target_user:
        return False

    # Super admin can manage everyone
    if manager.role == UserRole.super_admin:
        return True

    # Admin can manage users in their organization (except super_admin)
    if manager.role == UserRole.admin:
        if target_user.role == UserRole.super_admin:
            return False
        # Must be in same organization
        return manager.organization_id == target_user.organization_id

    return False


def can_assign_role(manager: User, role: UserRole) -> bool:
    """Check if a manager can assign a specific role."""
    if not manager:
        return False

    # Super admin can assign any role
    if manager.role == UserRole.super_admin:
        return True

    # Admin can assign roles below admin level
    if manager.role == UserRole.admin:
        return role in [UserRole.hr_manager, UserRole.analyst, UserRole.viewer]

    return False


class PermissionChecker:
    """FastAPI dependency for permission checking."""

    def __init__(self, required_permissions: List[Permission], require_all: bool = True):
        self.required_permissions = required_permissions
        self.require_all = require_all

    def __call__(self, current_user: User) -> User:
        """Check if current user has required permissions."""
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required"
            )

        if self.require_all:
            has_access = has_all_permissions(current_user, self.required_permissions)
        else:
            has_access = has_any_permission(current_user, self.required_permissions)

        if not has_access:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )

        return current_user


# Convenience permission checkers
require_super_admin = PermissionChecker([Permission.SYSTEM_ADMIN])
require_admin = PermissionChecker([Permission.USERS_MANAGE_ROLES], require_all=False)
require_hr_manager = PermissionChecker([Permission.EMPLOYEES_EDIT], require_all=False)
require_analyst = PermissionChecker([Permission.ANALYTICS_VIEW], require_all=False)


def get_role_hierarchy() -> dict:
    """Get the role hierarchy for UI display."""
    return {
        "super_admin": {
            "name": "Super Admin",
            "description": "Full access to everything including system settings, SSO configuration, and billing",
            "level": 0,
            "can_manage": ["admin", "hr_manager", "analyst", "viewer"]
        },
        "admin": {
            "name": "Admin",
            "description": "Full access to data and features, can manage team users",
            "level": 1,
            "can_manage": ["hr_manager", "analyst", "viewer"]
        },
        "hr_manager": {
            "name": "HR Manager",
            "description": "Access to all HR data including sensitive employee information",
            "level": 2,
            "can_manage": []
        },
        "analyst": {
            "name": "Analyst",
            "description": "Read-only access to analytics and reports, can create ML models",
            "level": 3,
            "can_manage": []
        },
        "viewer": {
            "name": "Viewer",
            "description": "Limited read-only access to dashboards and basic reports",
            "level": 4,
            "can_manage": []
        }
    }


def get_permissions_by_category() -> dict:
    """Get permissions organized by category for UI display."""
    return {
        "User Management": [
            {"id": Permission.USERS_VIEW.value, "name": "View Users", "description": "View user list and profiles"},
            {"id": Permission.USERS_CREATE.value, "name": "Create Users", "description": "Create new user accounts"},
            {"id": Permission.USERS_EDIT.value, "name": "Edit Users", "description": "Modify user profiles"},
            {"id": Permission.USERS_DELETE.value, "name": "Delete Users", "description": "Remove user accounts"},
            {"id": Permission.USERS_MANAGE_ROLES.value, "name": "Manage Roles", "description": "Assign and change user roles"},
        ],
        "Employee Data": [
            {"id": Permission.EMPLOYEES_VIEW.value, "name": "View Employees", "description": "View employee directory"},
            {"id": Permission.EMPLOYEES_VIEW_SALARY.value, "name": "View Salaries", "description": "View compensation data"},
            {"id": Permission.EMPLOYEES_VIEW_PII.value, "name": "View PII", "description": "View personal information"},
            {"id": Permission.EMPLOYEES_EDIT.value, "name": "Edit Employees", "description": "Modify employee records"},
            {"id": Permission.EMPLOYEES_EXPORT.value, "name": "Export Employees", "description": "Export employee data"},
        ],
        "Analytics & Reports": [
            {"id": Permission.ANALYTICS_VIEW.value, "name": "View Analytics", "description": "Access analytics dashboards"},
            {"id": Permission.ANALYTICS_EXPORT.value, "name": "Export Analytics", "description": "Export analytics data"},
            {"id": Permission.REPORTS_CREATE.value, "name": "Create Reports", "description": "Create custom reports"},
            {"id": Permission.QUERIES_EXECUTE.value, "name": "Execute SQL", "description": "Run SQL queries"},
        ],
        "Integrations": [
            {"id": Permission.INTEGRATIONS_VIEW.value, "name": "View Integrations", "description": "View configured integrations"},
            {"id": Permission.INTEGRATIONS_CREATE.value, "name": "Create Integrations", "description": "Set up new integrations"},
            {"id": Permission.INTEGRATIONS_SYNC.value, "name": "Sync Data", "description": "Trigger data synchronization"},
        ],
        "Planning": [
            {"id": Permission.PLANNING_VIEW.value, "name": "View Plans", "description": "View workforce plans"},
            {"id": Permission.PLANNING_EDIT.value, "name": "Edit Plans", "description": "Modify workforce plans"},
            {"id": Permission.PLANNING_APPROVE.value, "name": "Approve Plans", "description": "Approve workforce plans"},
            {"id": Permission.COMPENSATION_VIEW.value, "name": "View Compensation", "description": "View compensation plans"},
            {"id": Permission.COMPENSATION_EDIT.value, "name": "Edit Compensation", "description": "Modify compensation plans"},
        ],
        "2Model: Command Center": [
            {"id": Permission.COMMAND_CENTER_VIEW.value, "name": "View Command Center", "description": "View org health overview"},
            {"id": Permission.COMMAND_CENTER_MANAGE.value, "name": "Manage Command Center", "description": "Configure command center settings"},
            {"id": Permission.ALERTS_VIEW.value, "name": "View Alerts", "description": "View risk alerts"},
            {"id": Permission.ALERTS_MANAGE.value, "name": "Manage Alerts", "description": "Acknowledge and resolve alerts"},
            {"id": Permission.ALERTS_RUN_DETECTION.value, "name": "Run Detection", "description": "Trigger risk detection manually"},
            {"id": Permission.DEEP_DIVE_VIEW.value, "name": "Deep Dive Analysis", "description": "Access root-cause analysis"},
        ],
        "2Model: AI & Intelligence": [
            {"id": Permission.AI_QA_USE.value, "name": "Use AI Assistant", "description": "Ask questions to AI assistant"},
            {"id": Permission.AI_QA_VIEW_HISTORY.value, "name": "View AI History", "description": "View past AI conversations"},
        ],
        "2Model: KPIs & Attendance": [
            {"id": Permission.KPIS_VIEW.value, "name": "View KPIs", "description": "View KPI definitions and measurements"},
            {"id": Permission.KPIS_CREATE.value, "name": "Create KPIs", "description": "Define new KPIs"},
            {"id": Permission.KPIS_EDIT.value, "name": "Edit KPIs", "description": "Modify KPI definitions and targets"},
            {"id": Permission.KPIS_APPROVE_TARGETS.value, "name": "Approve Targets", "description": "Approve KPI target changes"},
            {"id": Permission.ATTENDANCE_VIEW.value, "name": "View Attendance", "description": "View attendance data"},
            {"id": Permission.ATTENDANCE_MANAGE.value, "name": "Manage Attendance", "description": "Set attendance targets"},
            {"id": Permission.ATTENDANCE_IMPORT.value, "name": "Import Attendance", "description": "Import attendance records"},
        ],
        "2Model: Data Warehouse": [
            {"id": Permission.WAREHOUSE_VIEW.value, "name": "View Connections", "description": "View warehouse connections"},
            {"id": Permission.WAREHOUSE_MANAGE.value, "name": "Manage Connections", "description": "Create and configure warehouse connections"},
            {"id": Permission.WAREHOUSE_QUERY.value, "name": "Query Warehouse", "description": "Execute queries against warehouse"},
        ],
    }
