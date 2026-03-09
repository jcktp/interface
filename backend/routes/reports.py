from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from uuid import UUID
import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, or_

from database.connection import get_db
from database.models import Report, Employee, EmployeeStatus
from services.auth.security import verify_token, get_org_id, get_user_id

router = APIRouter(prefix="/api/reports", tags=["Reports"])

# ─── Column definitions ───────────────────────────────────────────────────────

COLUMN_GROUPS = {
    "employee_info": [
        {"key": "employee_id", "label": "Employee ID", "type": "string"},
        {"key": "first_name", "label": "First Name", "type": "string"},
        {"key": "last_name", "label": "Last Name", "type": "string"},
        {"key": "name", "label": "Full Name", "type": "string"},
        {"key": "email", "label": "Email", "type": "string"},
        {"key": "job_title", "label": "Job Title", "type": "string"},
        {"key": "department", "label": "Department", "type": "string"},
        {"key": "location", "label": "Location", "type": "string"},
        {"key": "job_level", "label": "Job Level", "type": "string"},
        {"key": "work_type", "label": "Work Type", "type": "string"},
        {"key": "status", "label": "Status", "type": "string"},
    ],
    "compensation": [
        {"key": "salary", "label": "Salary", "type": "number"},
        {"key": "equity_value", "label": "Equity Value", "type": "number"},
        {"key": "currency", "label": "Currency", "type": "string"},
        {"key": "cost_per_hire", "label": "Cost Per Hire", "type": "number"},
        {"key": "bonus_target", "label": "Bonus Target", "type": "number"},
    ],
    "demographics": [
        {"key": "gender", "label": "Gender", "type": "string"},
        {"key": "ethnicity", "label": "Ethnicity", "type": "string"},
        {"key": "nationality", "label": "Nationality", "type": "string"},
        {"key": "age", "label": "Age", "type": "number"},
    ],
    "dates": [
        {"key": "hire_date", "label": "Hire Date", "type": "date"},
        {"key": "termination_date", "label": "Termination Date", "type": "date"},
        {"key": "tenure", "label": "Tenure (years)", "type": "number"},
    ],
    "performance": [
        {"key": "performance_rating", "label": "Performance Rating", "type": "number"},
        {"key": "engagement_score", "label": "Engagement Score", "type": "number"},
        {"key": "quality_of_hire_score", "label": "Quality of Hire Score", "type": "number"},
        {"key": "flight_risk", "label": "Flight Risk", "type": "string"},
    ],
    "source": [
        {"key": "previous_company", "label": "Previous Company", "type": "string"},
        {"key": "source", "label": "Hire Source", "type": "string"},
        {"key": "employment_type", "label": "Employment Type", "type": "string"},
    ],
}

# Map column key → Employee attribute name (for columns that don't match exactly)
_COLUMN_MAP = {
    "name": "name",  # computed below
    "employee_id": "employee_id",
    "first_name": "first_name",
    "last_name": "last_name",
    "email": "email",
    "job_title": "job_title",
    "department": "department",
    "location": "location",
    "job_level": "job_level",
    "work_type": "work_type",
    "status": "status",
    "salary": "salary",
    "equity_value": "equity_value",
    "currency": "currency",
    "cost_per_hire": "cost_per_hire",
    "bonus_target": "bonus_target",
    "gender": "gender",
    "ethnicity": "ethnicity",
    "nationality": "nationality",
    "age": "age",
    "hire_date": "hire_date",
    "termination_date": "termination_date",
    "tenure": "tenure",
    "performance_rating": "performance_rating",
    "engagement_score": "engagement_score",
    "quality_of_hire_score": "quality_of_hire_score",
    "flight_risk": "flight_risk",
    "previous_company": "previous_company",
    "source": "source",
    "employment_type": "employment_type",
}


def _serialize_report(r) -> Dict[str, Any]:
    return {
        "id": str(r.id),
        "name": r.name,
        "description": r.description,
        "report_type": r.report_type,
        "config": r.config,
        "dashboard_id": str(r.dashboard_id) if r.dashboard_id else None,
        "dashboard_name": None,
        "share_token": r.share_token,
        "is_public": r.is_public,
        "expires_at": r.expires_at.isoformat() if r.expires_at else None,
        "schedule": r.schedule,
        "recipients": r.recipients,
        "last_sent_at": r.last_sent_at.isoformat() if r.last_sent_at else None,
        "created_by": str(r.created_by),
        "creator_name": r.creator.name if r.creator else None,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }


def _get_employee_value(emp, col_key: str):
    """Extract a value from an employee row for a given column key."""
    if col_key == "name":
        fn = getattr(emp, "first_name", None) or ""
        ln = getattr(emp, "last_name", None) or ""
        return f"{fn} {ln}".strip() or None
    attr = _COLUMN_MAP.get(col_key, col_key)
    val = getattr(emp, attr, None)
    if val is None:
        return None
    # Serialize non-primitives
    if hasattr(val, "isoformat"):
        return val.isoformat()
    if hasattr(val, "value"):
        return val.value
    return val


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/columns")
async def get_report_columns(user=Depends(verify_token)):
    return COLUMN_GROUPS


@router.post("/data")
async def get_report_data(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    columns: List[str] = data.get("columns", [])
    filters: Dict[str, Any] = data.get("filters", {})
    sort_by: Optional[str] = data.get("sort_by")
    sort_direction: str = data.get("sort_direction", "asc")
    skip: int = int(data.get("skip", 0))
    limit: int = min(int(data.get("limit", 50)), 5000)

    query = db.query(Employee).filter(Employee.organization_id == org_id)

    # Apply filters
    if filters.get("departments"):
        query = query.filter(Employee.department.in_(filters["departments"]))
    if filters.get("locations"):
        query = query.filter(Employee.location.in_(filters["locations"]))
    if filters.get("statuses"):
        query = query.filter(Employee.status.in_(filters["statuses"]))
    if filters.get("start_date"):
        query = query.filter(Employee.hire_date >= filters["start_date"])
    if filters.get("end_date"):
        query = query.filter(Employee.hire_date <= filters["end_date"])

    # Apply sorting
    if sort_by and sort_by in _COLUMN_MAP:
        attr = _COLUMN_MAP[sort_by]
        col = getattr(Employee, attr, None)
        if col is not None:
            query = query.order_by(col.desc() if sort_direction == "desc" else col.asc())
    else:
        query = query.order_by(Employee.last_name)

    total = query.count()
    employees = query.offset(skip).limit(limit).all()

    # Build column defs for response
    flat_cols = {c["key"]: c for grp in COLUMN_GROUPS.values() for c in grp}
    response_cols = [flat_cols[k] for k in columns if k in flat_cols]

    rows = [
        {col_key: _get_employee_value(emp, col_key) for col_key in columns}
        for emp in employees
    ]

    return {"rows": rows, "total": total, "columns": response_cols}


@router.get("")
async def list_reports(
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    reports = (
        db.query(Report)
        .filter(Report.organization_id == org_id)
        .order_by(Report.updated_at.desc())
        .all()
    )
    return {"status": "success", "reports": [_serialize_report(r) for r in reports]}


@router.post("")
async def create_report(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    name = data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Report name is required")

    report = Report(
        organization_id=org_id,
        name=name,
        description=data.get("description"),
        report_type=data.get("report_type", "custom"),
        config=data.get("config", {}),
        created_by=user_id,
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"status": "success", "report": _serialize_report(report)}


@router.put("/{report_id}")
async def update_report(
    report_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    report = db.query(Report).filter(
        Report.id == UUID(report_id),
        Report.organization_id == org_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    for field in ("name", "description", "config", "schedule", "recipients"):
        if field in data:
            setattr(report, field, data[field])
    report.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(report)
    return {"status": "success", "report": _serialize_report(report)}


@router.delete("/{report_id}")
async def delete_report(
    report_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    report = db.query(Report).filter(
        Report.id == UUID(report_id),
        Report.organization_id == org_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    db.delete(report)
    db.commit()
    return {"status": "success"}


@router.post("/{report_id}/share")
async def share_report(
    report_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    report = db.query(Report).filter(
        Report.id == UUID(report_id),
        Report.organization_id == org_id,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    token = secrets.token_urlsafe(32)
    report.share_token = token
    report.is_public = True

    expires_hours = data.get("expires_hours")
    if expires_hours is not None and expires_hours > 0:
        report.expires_at = datetime.utcnow() + timedelta(hours=expires_hours)
    else:
        report.expires_at = None

    report.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(report)
    return {
        "status": "success",
        "share_token": report.share_token,
        "is_public": report.is_public,
        "expires_at": report.expires_at.isoformat() if report.expires_at else None,
    }


@router.get("/shared/{token}")
async def get_shared_report(token: str, db: Session = Depends(get_db)):
    report = db.query(Report).filter(
        Report.share_token == token,
        Report.is_public == True,
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found or link expired")
    if report.expires_at and datetime.utcnow() > report.expires_at:
        raise HTTPException(status_code=410, detail="Share link has expired")
    return {"status": "success", "report": _serialize_report(report)}
