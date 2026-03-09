from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id, get_user_id
from services.user_management_service import UserManagementService
from scripts.seed_data import seed_full_database
from uuid import UUID

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.get("/users")
async def list_users(
    role: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = UserManagementService(db)
    result = service.list_users(org_id, skip, limit, role, status)
    
    # Format for frontend
    from services.permissions import get_permissions_for_role
    from database.models import UserRole
    
    users_out = []
    for u in result["users"]:
        role_enum = u.role if hasattr(u.role, 'name') else UserRole(u.role)
        role_permissions = [p.value for p in get_permissions_for_role(role_enum)]
        # custom_permissions overrides role-based permissions when set
        effective_permissions = u.custom_permissions if u.custom_permissions is not None else role_permissions
        users_out.append({
            "id": str(u.id),
            "email": u.email,
            "name": u.name,
            "role": u.role.value if hasattr(u.role, 'value') else u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "permissions": effective_permissions,
            "custom_permissions": u.custom_permissions,  # raw saved value for the UI
        })
    return {"users": users_out, "total": result["total"]}

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    data: Dict[str, str],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    service = UserManagementService(db)
    service.update_user_role(UUID(user_id), data["role"], get_user_id(user))
    return {"status": "success"}

@router.put("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    service = UserManagementService(db)
    service.deactivate_user(UUID(user_id), get_user_id(user))
    return {"status": "success"}

@router.put("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    db: Session = Depends(get_db),
):
    service = UserManagementService(db)
    service.activate_user(UUID(user_id))
    return {"status": "success"}

@router.put("/users/{user_id}/permissions")
async def update_user_permissions(
    user_id: str,
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    from database.models import User
    target = db.query(User).filter(User.id == UUID(user_id)).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    permissions = data.get("permissions")
    # None means revert to role-based; empty list means no permissions
    target.custom_permissions = permissions if permissions is not None else None
    db.commit()
    return {"status": "success"}

@router.post("/seed-full")
async def seed_full(
    employee_count: int = 4500,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = str(get_org_id(user))
    user_id = str(get_user_id(user))
    
    from database.models import Organization
    org = db.query(Organization).filter(Organization.id == UUID(org_id)).first()
    if not org:
        org = Organization(
            id=UUID(org_id),
            name="Demo Organization",
            slug="demo-org",
            domain="interface.app"
        )
        db.add(org)
        db.commit()

    try:
        # Run synchronously to give frontend immediate feedback
        result = seed_full_database(
            db, 
            organization_id=org_id, 
            user_id=user_id,
            employee_count=employee_count,
            clear_existing=True
        )
        return {"status": "success", "data": result}
    except Exception as e:
        import traceback
        print(f"Seeding failed: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/data-summary")
async def get_data_summary(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    from database.models import Employee, Candidate, JobRequisition, AttendanceRecord
    from sqlalchemy import func
    
    return {
        "status": "success",
        "data": {
            "employees": db.query(func.count(Employee.id)).filter(Employee.organization_id == org_id).scalar(),
            "candidates": db.query(func.count(Candidate.id)).filter(Candidate.organization_id == org_id).scalar(),
            "requisitions": db.query(func.count(JobRequisition.id)).filter(JobRequisition.organization_id == org_id).scalar(),
            "attendance_records": db.query(func.count(AttendanceRecord.id)).filter(AttendanceRecord.organization_id == org_id).scalar(),
        }
    }

@router.post("/clear-data")
async def clear_data(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    from sqlalchemy import text
    
    tables = [
        'attendance_records', 'candidates', 'job_requisitions', 'employees',
        'recruiter_goals', 'compensation_plans', 'compensation_changes',
        'kpi_measurements', 'kpi_targets', 'kpi_definitions'
    ]
    
    for table in tables:
        db.execute(text(f"DELETE FROM {table} WHERE organization_id = :oid"), {"oid": org_id})
    
    db.commit()
    return {"status": "success", "message": "Data cleared for organization"}

@router.get("/health")
async def health_check():
    from datetime import datetime
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat() + "Z"}
