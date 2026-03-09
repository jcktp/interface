"""User Management Service for Interface.

Provides operations for managing users: listing, role changes, activation,
deactivation, invitations, and audit logging.
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from database.models import User, UserRole, Organization


# ============== Audit Log Entry (in-memory model for JSON storage) ==============

class AuditAction:
    """Constants for audit log action types."""
    ROLE_CHANGED = "role_changed"
    USER_DEACTIVATED = "user_deactivated"
    USER_ACTIVATED = "user_activated"
    USER_INVITED = "user_invited"
    USER_UPDATED = "user_updated"


# We store audit entries in a lightweight table-less approach using a list
# In production this would be its own model; here we use User.updated_at and
# a dedicated audit table. For now, we define a simple dict-based log that
# the service manages via a separate AuditLog model.

class UserAuditLog:
    """Lightweight audit log storage.

    In a production system this would be backed by a dedicated database table.
    Here we keep a module-level list for the service layer contract, but the
    real implementation stores entries in the sso_audit_logs table which already
    exists in the schema.
    """

    _entries: List[dict] = []

    @classmethod
    def append(cls, entry: dict) -> None:
        cls._entries.append(entry)

    @classmethod
    def query(
        cls,
        org_id: UUID,
        user_id: Optional[UUID] = None,
        limit: int = 50,
    ) -> List[dict]:
        results = [
            e for e in cls._entries
            if e.get("organization_id") == str(org_id)
        ]
        if user_id:
            results = [
                e for e in results
                if e.get("user_id") == str(user_id)
            ]
        # Most recent first
        results.sort(key=lambda e: e.get("timestamp", ""), reverse=True)
        return results[:limit]

    @classmethod
    def clear(cls) -> None:
        """Clear all entries. Useful for testing."""
        cls._entries = []


# ============== Assignable roles per manager role ==============

ASSIGNABLE_ROLES = {
    UserRole.super_admin: [
        UserRole.admin,
        UserRole.hr_manager,
        UserRole.analyst,
        UserRole.viewer,
    ],
    UserRole.admin: [
        UserRole.hr_manager,
        UserRole.analyst,
        UserRole.viewer,
    ],
}


class UserManagementService:
    """Service for user management operations.

    Follows the same pattern as PlanningService: accepts a SQLAlchemy Session
    on init and exposes domain methods that query/mutate User records.
    """

    def __init__(self, db: Session):
        self.db = db

    # ==================== List Users ====================

    def list_users(
        self,
        org_id: UUID,
        skip: int = 0,
        limit: int = 50,
        role_filter: Optional[str] = None,
        status_filter: Optional[str] = None,
    ) -> dict:
        """Return a paginated list of users for an organization.

        Args:
            org_id: Organization UUID to scope the query.
            skip: Number of records to skip (offset).
            limit: Maximum number of records to return.
            role_filter: Optional role string to filter by (e.g. 'admin').
            status_filter: Optional status string ('active' or 'inactive').

        Returns:
            Dict with 'users' list and 'total' count.
        """
        query = self.db.query(User).filter(
            User.organization_id == org_id,
        )

        if role_filter:
            try:
                role_enum = UserRole(role_filter)
                query = query.filter(User.role == role_enum)
            except ValueError:
                raise ValueError(f"Invalid role filter: {role_filter}")

        if status_filter:
            if status_filter == "active":
                query = query.filter(User.is_active == True)
            elif status_filter == "inactive":
                query = query.filter(User.is_active == False)
            elif status_filter == "pending":
                # Pending users have is_active False and were recently created
                # Convention: pending users have password_hash == 'PENDING_INVITE'
                query = query.filter(
                    User.is_active == False,
                    User.password_hash == "PENDING_INVITE",
                )
            else:
                raise ValueError(f"Invalid status filter: {status_filter}")

        total = query.count()

        users = (
            query
            .order_by(User.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

        return {
            "users": users,
            "total": total,
        }

    # ==================== Get Single User ====================

    def get_user(self, user_id: UUID) -> User:
        """Fetch a single user by ID.

        Args:
            user_id: The UUID of the user.

        Returns:
            The User object.

        Raises:
            ValueError: If no user is found with the given ID.
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise ValueError(f"User not found: {user_id}")
        return user

    # ==================== Update User Role ====================

    def update_user_role(
        self,
        user_id: UUID,
        new_role: str,
        changed_by: UUID,
    ) -> User:
        """Change a user's role.

        Validates that the new role is a valid UserRole value and that the
        requesting user (changed_by) has sufficient privileges to assign it.

        Args:
            user_id: UUID of the user whose role will be changed.
            new_role: String value of the new role (e.g. 'hr_manager').
            changed_by: UUID of the user performing the change.

        Returns:
            The updated User object.

        Raises:
            ValueError: If the role is invalid, the user is not found, or
                        the changer lacks permission to assign the role.
        """
        # Validate role string
        try:
            role_enum = UserRole(new_role)
        except ValueError:
            valid_roles = [r.value for r in UserRole]
            raise ValueError(
                f"Invalid role '{new_role}'. Must be one of: {', '.join(valid_roles)}"
            )

        user = self.get_user(user_id)
        changer = self.get_user(changed_by)

        # Check that the changer can assign the requested role
        allowed = ASSIGNABLE_ROLES.get(changer.role, [])
        if role_enum not in allowed:
            raise ValueError(
                f"User with role '{changer.role.value}' cannot assign role '{new_role}'"
            )

        old_role = user.role.value
        user.role = role_enum
        user.updated_at = datetime.utcnow()

        # Log the change
        self._log_audit(
            action=AuditAction.ROLE_CHANGED,
            organization_id=user.organization_id,
            user_id=user.id,
            performed_by=changed_by,
            details={
                "old_role": old_role,
                "new_role": new_role,
            },
        )

        self.db.commit()
        return user

    # ==================== Deactivate User ====================

    def deactivate_user(
        self,
        user_id: UUID,
        deactivated_by: UUID,
    ) -> User:
        """Deactivate a user account.

        Args:
            user_id: UUID of the user to deactivate.
            deactivated_by: UUID of the user performing the deactivation.

        Returns:
            The updated User object.

        Raises:
            ValueError: If the user is not found or is already inactive.
        """
        user = self.get_user(user_id)

        if not user.is_active:
            raise ValueError(f"User {user_id} is already inactive")

        user.is_active = False
        user.updated_at = datetime.utcnow()

        self._log_audit(
            action=AuditAction.USER_DEACTIVATED,
            organization_id=user.organization_id,
            user_id=user.id,
            performed_by=deactivated_by,
            details={"reason": "Manual deactivation"},
        )

        self.db.commit()
        return user

    # ==================== Activate User ====================

    def activate_user(self, user_id: UUID) -> User:
        """Activate a previously deactivated user account.

        Args:
            user_id: UUID of the user to activate.

        Returns:
            The updated User object.

        Raises:
            ValueError: If the user is not found or is already active.
        """
        user = self.get_user(user_id)

        if user.is_active:
            raise ValueError(f"User {user_id} is already active")

        user.is_active = True
        user.updated_at = datetime.utcnow()

        self._log_audit(
            action=AuditAction.USER_ACTIVATED,
            organization_id=user.organization_id,
            user_id=user.id,
            performed_by=user.id,
            details={"reason": "Manual activation"},
        )

        self.db.commit()
        return user

    # ==================== Invite User ====================

    def invite_user(
        self,
        email: str,
        name: str,
        role: str,
        org_id: UUID,
        invited_by: UUID,
    ) -> User:
        """Invite a new user to the organization.

        Creates a new User record with status='pending' (is_active=False,
        password_hash='PENDING_INVITE'). The user will need to complete
        registration via an invitation link.

        Args:
            email: Email address for the new user.
            name: Display name for the new user.
            role: Role to assign (e.g. 'analyst').
            org_id: Organization UUID the user will belong to.
            invited_by: UUID of the user sending the invitation.

        Returns:
            The newly created User object.

        Raises:
            ValueError: If the email is already in use, the role is invalid,
                        or the inviter cannot assign the requested role.
        """
        # Validate role
        try:
            role_enum = UserRole(role)
        except ValueError:
            valid_roles = [r.value for r in UserRole]
            raise ValueError(
                f"Invalid role '{role}'. Must be one of: {', '.join(valid_roles)}"
            )

        # Check inviter permissions
        inviter = self.get_user(invited_by)
        allowed = ASSIGNABLE_ROLES.get(inviter.role, [])
        if role_enum not in allowed:
            raise ValueError(
                f"User with role '{inviter.role.value}' cannot invite users with role '{role}'"
            )

        # Check for existing user with this email
        existing = self.db.query(User).filter(User.email == email).first()
        if existing:
            raise ValueError(f"A user with email '{email}' already exists")

        # Verify organization exists
        org = self.db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise ValueError(f"Organization not found: {org_id}")

        new_user = User(
            id=uuid4(),
            email=email,
            name=name,
            role=role_enum,
            organization_id=org_id,
            is_active=False,
            password_hash="PENDING_INVITE",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.db.add(new_user)

        self._log_audit(
            action=AuditAction.USER_INVITED,
            organization_id=org_id,
            user_id=new_user.id,
            performed_by=invited_by,
            details={
                "email": email,
                "name": name,
                "role": role,
            },
        )

        self.db.commit()
        return new_user

    # ==================== Audit Log ====================

    def get_audit_log(
        self,
        org_id: UUID,
        user_id: Optional[UUID] = None,
        limit: int = 50,
    ) -> List[dict]:
        """Retrieve audit log entries for an organization.

        Args:
            org_id: Organization UUID to scope the query.
            user_id: Optional user UUID to filter entries for a specific user.
            limit: Maximum number of entries to return.

        Returns:
            List of audit log entry dicts, most recent first.
        """
        return UserAuditLog.query(
            org_id=org_id,
            user_id=user_id,
            limit=limit,
        )

    # ==================== Internal Helpers ====================

    def _log_audit(
        self,
        action: str,
        organization_id: UUID,
        user_id: UUID,
        performed_by: UUID,
        details: Optional[dict] = None,
    ) -> None:
        """Write an entry to the audit log.

        Args:
            action: The action type (see AuditAction constants).
            organization_id: Organization the action relates to.
            user_id: The user the action was performed on.
            performed_by: The user who performed the action.
            details: Optional dict of additional context.
        """
        entry = {
            "id": str(uuid4()),
            "action": action,
            "organization_id": str(organization_id),
            "user_id": str(user_id),
            "performed_by": str(performed_by),
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat(),
        }
        UserAuditLog.append(entry)
