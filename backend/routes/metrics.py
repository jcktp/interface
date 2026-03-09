from typing import Dict, Any, Optional, List
from datetime import datetime, date, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract, text

from database.connection import get_db
from database.models import (
    Employee, Candidate, JobRequisition, AttendanceRecord,
    EmployeeStatus, CandidateStatus, RequisitionStatus, AttendanceStatus,
    RecruiterGoal, WorkforcePlan, OrganizationFinancial, MetricDefinition
)
from services.auth.security import verify_token, get_org_id
from services.metrics_service import MetricsService

# Default system metrics to seed when none exist
_SYSTEM_METRICS = [
    {"name": "Total Headcount", "category": "HR", "formula": "COUNT(employees WHERE status='active')"},
    {"name": "Active Employees", "category": "HR", "formula": "COUNT(employees WHERE status='active')"},
    {"name": "Turnover Rate", "category": "Retention", "formula": "terminations_12m / avg_headcount * 100"},
    {"name": "Voluntary Turnover Rate", "category": "Retention", "formula": "voluntary_terms_12m / avg_headcount * 100"},
    {"name": "Average Tenure", "category": "HR", "formula": "AVG(employees.tenure)"},
    {"name": "Time to Fill", "category": "Recruitment", "formula": "AVG(close_date - open_date) WHERE status='closed'"},
    {"name": "Offer Acceptance Rate", "category": "Recruitment", "formula": "hired / offers_extended * 100"},
    {"name": "Engagement Score", "category": "Engagement", "formula": "AVG(employees.engagement_score)"},
    {"name": "Performance Rating Avg", "category": "Performance", "formula": "AVG(employees.performance_rating)"},
    {"name": "Average Salary", "category": "Compensation", "formula": "AVG(employees.salary)"},
    {"name": "Gender Pay Gap", "category": "Diversity", "formula": "(avg_male_salary - avg_female_salary) / avg_male_salary * 100"},
    {"name": "Absenteeism Rate", "category": "Attendance", "formula": "absent_days / scheduled_days * 100"},
    {"name": "Flight Risk Rate", "category": "Retention", "formula": "COUNT(flight_risk='high') / total_active * 100"},
    {"name": "Cost Per Hire", "category": "Recruitment", "formula": "total_recruitment_cost / hires_in_period"},
    {"name": "Headcount Growth Rate", "category": "HR", "formula": "(current_headcount - prior_headcount) / prior_headcount * 100"},
]


def _serialize_metric(m) -> Dict[str, Any]:
    return {
        "id": str(m.id),
        "name": m.name,
        "category": m.category or "Custom",
        "formula": m.formula or "",
        "sql_expression": m.sql_expression,
        "source_fields": m.source_fields or [],
        "is_system": m.is_system,
        "is_active": m.is_active,
        "saved_query_id": str(m.saved_query_id) if m.saved_query_id else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
    }


def _ensure_system_metrics(db: Session, org_id: UUID):
    """Seed system metrics for the org if none exist."""
    count = db.query(func.count(MetricDefinition.id)).filter(
        MetricDefinition.organization_id == org_id,
        MetricDefinition.is_system == True,
    ).scalar()
    if count == 0:
        for m in _SYSTEM_METRICS:
            db.add(MetricDefinition(
                id=uuid4(),
                organization_id=org_id,
                name=m["name"],
                category=m["category"],
                formula=m["formula"],
                is_system=True,
                is_active=True,
            ))
        db.commit()

router = APIRouter(prefix="/api/metrics", tags=["Metrics"])

@router.get("/dashboard")
async def get_dashboard_metrics(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = MetricsService(db)
    
    data = service.get_dashboard_metrics(
        org_id=org_id,
        departments=departments,
        locations=locations,
        status=status,
        start_date=start_date,
        end_date=end_date
    )
    
    return {
        "status": "success",
        "data": data,
        "source": "live-api"
    }

@router.get("/financials")
@router.get("/financial")
async def get_financial_metrics(
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = MetricsService(db)
    
    data = service.get_financial_metrics(org_id)
    
    return {
        "status": "success",
        "data": data
    }

@router.get("/retention")
async def get_retention_metrics(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = MetricsService(db)
    
    data = service.get_retention_metrics(
        org_id=org_id,
        departments=departments,
        locations=locations
    )
    
    return {
        "status": "success",
        "data": data
    }

@router.get("/diversity")
async def get_diversity_metrics(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = MetricsService(db)
    
    data = service.get_diversity_metrics(
        org_id=org_id,
        departments=departments,
        locations=locations,
        end_date=end_date
    )

    return {
        "status": "success",
        "data": data
    }


@router.get("/diversity/breakdown")
async def get_diversity_breakdown(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    data = MetricsService(db).get_diversity_breakdown(org_id, departments=departments, locations=locations)
    return {"status": "success", "data": data}


@router.get("/diversity/trends")
async def get_diversity_trends(
    months: int = Query(12, ge=3, le=24),
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    data = MetricsService(db).get_diversity_trends(org_id, months=months, departments=departments, locations=locations)
    return {"status": "success", "data": data}


# ── Metric Definitions CRUD ──────────────────────────────────────────────────

@router.get("/definitions")
async def list_metric_definitions(
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    _ensure_system_metrics(db, org_id)
    metrics = db.query(MetricDefinition).filter(
        MetricDefinition.organization_id == org_id
    ).order_by(MetricDefinition.category, MetricDefinition.name).all()
    return {"status": "success", "data": [_serialize_metric(m) for m in metrics]}


@router.post("/definitions")
async def create_metric_definition(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    m = MetricDefinition(
        id=uuid4(),
        organization_id=org_id,
        name=name,
        category=data.get("category", "Custom"),
        formula=data.get("formula", ""),
        sql_expression=data.get("sql_expression"),
        source_fields=data.get("source_fields"),
        is_system=False,
        is_active=True,
        saved_query_id=UUID(data["saved_query_id"]) if data.get("saved_query_id") else None,
        created_by=UUID(user["id"]),
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return {"status": "success", "data": _serialize_metric(m)}


@router.put("/definitions/{metric_id}")
async def update_metric_definition(
    metric_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    m = db.query(MetricDefinition).filter(
        MetricDefinition.id == UUID(metric_id),
        MetricDefinition.organization_id == org_id
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Metric not found")
    if "sql_expression" in data:
        m.sql_expression = data["sql_expression"]
    if "source_fields" in data:
        m.source_fields = data["source_fields"]
    if "formula" in data:
        m.formula = data["formula"]
    if "saved_query_id" in data:
        m.saved_query_id = UUID(data["saved_query_id"]) if data["saved_query_id"] else None
    if "is_active" in data:
        m.is_active = bool(data["is_active"])
    db.commit()
    db.refresh(m)
    return {"status": "success", "data": _serialize_metric(m)}


@router.get("/definitions/{metric_id}/calculate")
async def calculate_metric(
    metric_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    m = db.query(MetricDefinition).filter(
        MetricDefinition.id == UUID(metric_id),
        MetricDefinition.organization_id == org_id
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Metric not found")
    if not m.sql_expression:
        return {"value": None, "error": "No SQL expression configured"}
    try:
        result = db.execute(
            text(m.sql_expression),
            {"org_id": str(org_id)}
        ).fetchone()
        value = result[0] if result else None
        if value is not None:
            try:
                value = float(value)
            except (TypeError, ValueError):
                value = str(value)
        return {"value": value, "error": None}
    except Exception as e:
        return {"value": None, "error": str(e)}
