from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from database.models import Employee, EmployeeStatus
from services.auth.security import verify_token, get_org_id

router = APIRouter(prefix="/api/retention", tags=["Retention"])


@router.get("/reasons-for-leaving")
async def get_reasons_for_leaving(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)

    base = db.query(Employee).filter(
        Employee.organization_id == org_id,
        Employee.status == EmployeeStatus.terminated,
        Employee.termination_reason.isnot(None),
    )
    if departments:
        base = base.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
    if locations:
        base = base.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))
    if start_date and start_date != 'all':
        base = base.filter(Employee.termination_date >= start_date)
    if end_date and end_date != 'all':
        base = base.filter(Employee.termination_date <= end_date)

    # Overall reason counts
    reason_rows = (
        base.with_entities(Employee.termination_reason, func.count(Employee.id).label("count"))
        .group_by(Employee.termination_reason)
        .order_by(func.count(Employee.id).desc())
        .all()
    )
    overall = [{"reason": r.termination_reason, "count": r.count} for r in reason_rows]
    total_departures = sum(r["count"] for r in overall)

    # By department: top reason per dept
    dept_rows = base.with_entities(
        Employee.department, Employee.termination_reason, func.count(Employee.id).label("count")
    ).group_by(Employee.department, Employee.termination_reason).all()

    by_department: Dict[str, list] = {}
    for row in dept_rows:
        if not row.department:
            continue
        by_department.setdefault(row.department, []).append(
            {"reason": row.termination_reason, "count": row.count}
        )
    # Sort each dept's list by count desc
    for dept in by_department:
        by_department[dept].sort(key=lambda x: x["count"], reverse=True)

    return {
        "status": "success",
        "data": {
            "overall": overall,
            "by_department": by_department,
            "total_departures": total_departures,
        },
    }
