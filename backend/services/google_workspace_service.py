"""Google Workspace Directory Sync Service."""

from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy import and_

from database.models import Employee, EmployeeStatus, Organization


class GoogleWorkspaceService:
    """Syncs users from Google Workspace Admin Directory API."""

    def __init__(self, db: Session):
        self.db = db
        self._service = None

    def configure(self, org_id: UUID, config: Dict[str, Any]) -> Dict[str, Any]:
        """Store Google Workspace configuration.

        Config should include:
        - service_account_json: Service account credentials JSON
        - admin_email: Admin email for domain-wide delegation
        - domain: Google Workspace domain
        """
        # In production, encrypt and store in DB
        # For now, validate the config structure
        required = ['service_account_json', 'admin_email', 'domain']
        missing = [k for k in required if k not in config]
        if missing:
            raise ValueError(f"Missing required config: {', '.join(missing)}")

        return {
            "status": "configured",
            "domain": config['domain'],
            "admin_email": config['admin_email'],
            "configured_at": datetime.utcnow().isoformat(),
        }

    def get_status(self, org_id: UUID) -> Dict[str, Any]:
        """Get Google Workspace connection status."""
        return {
            "connected": False,
            "last_sync": None,
            "users_synced": 0,
            "domain": None,
            "message": "Not configured. Provide service account credentials to connect.",
        }

    def _build_service(self, config: Dict[str, Any]):
        """Build Google Admin SDK service client."""
        try:
            from google.oauth2 import service_account
            from googleapiclient.discovery import build

            credentials = service_account.Credentials.from_service_account_info(
                config['service_account_json'],
                scopes=['https://www.googleapis.com/auth/admin.directory.user.readonly'],
                subject=config['admin_email'],
            )
            return build('admin', 'directory_v1', credentials=credentials)
        except ImportError:
            raise ValueError(
                "Google API client not installed. "
                "Install with: pip install google-api-python-client google-auth"
            )

    def list_users(self, config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """List all users from Google Workspace."""
        service = self._build_service(config)

        users = []
        page_token = None

        while True:
            results = service.users().list(
                domain=config['domain'],
                maxResults=500,
                pageToken=page_token,
                projection='full',
            ).execute()

            users.extend(results.get('users', []))
            page_token = results.get('nextPageToken')

            if not page_token:
                break

        return users

    def transform_to_employee(self, gws_user: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a Google Workspace user to Employee schema."""
        name = gws_user.get('name', {})
        org = gws_user.get('organizations', [{}])[0] if gws_user.get('organizations') else {}

        return {
            "email": gws_user.get('primaryEmail', ''),
            "first_name": name.get('givenName', ''),
            "last_name": name.get('familyName', ''),
            "department": org.get('department', 'Unknown'),
            "job_title": org.get('title', ''),
            "location": gws_user.get('locations', [{}])[0].get('area', '') if gws_user.get('locations') else '',
            "status": "active" if not gws_user.get('suspended', False) else "terminated",
            "employee_id": gws_user.get('id', ''),
            "hire_date": gws_user.get('creationTime', ''),
        }

    def sync_users(self, org_id: UUID, config: Dict[str, Any]) -> Dict[str, Any]:
        """Sync users from Google Workspace to Employee table."""
        try:
            gws_users = self.list_users(config)
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "synced": 0,
                "created": 0,
                "updated": 0,
            }

        created = 0
        updated = 0
        errors = []

        for gws_user in gws_users:
            try:
                emp_data = self.transform_to_employee(gws_user)

                # Check if employee exists by email
                existing = self.db.query(Employee).filter(
                    and_(
                        Employee.organization_id == org_id,
                        Employee.email == emp_data['email'],
                    )
                ).first()

                if existing:
                    # Update existing
                    for key in ['first_name', 'last_name', 'department', 'job_title', 'location']:
                        if emp_data.get(key):
                            setattr(existing, key, emp_data[key])
                    existing.updated_at = datetime.utcnow()
                    updated += 1
                else:
                    # Create new employee
                    employee = Employee(
                        id=uuid4(),
                        organization_id=org_id,
                        employee_id=emp_data.get('employee_id', str(uuid4())[:8]),
                        first_name=emp_data['first_name'],
                        last_name=emp_data['last_name'],
                        email=emp_data['email'],
                        department=emp_data.get('department', 'Unknown'),
                        job_title=emp_data.get('job_title', ''),
                        location=emp_data.get('location', ''),
                        status=EmployeeStatus.active,
                        hire_date=datetime.utcnow().date(),
                        salary=0,
                    )
                    self.db.add(employee)
                    created += 1

            except Exception as e:
                errors.append(f"Error syncing {gws_user.get('primaryEmail', 'unknown')}: {str(e)}")

        self.db.commit()

        return {
            "status": "success",
            "synced": created + updated,
            "created": created,
            "updated": updated,
            "errors": errors[:10],
            "synced_at": datetime.utcnow().isoformat(),
        }
