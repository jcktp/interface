from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from database.connection import get_db
from database.models import Employee, EmployeeStatus, OrgHealthAlert, AlertStatus
from services.auth.security import verify_token, get_org_id

router = APIRouter(prefix="/api/deep-dive", tags=["Deep Dive"])

# Mapping of metric name → Employee attribute
METRIC_ATTR = {
    "engagement": "engagement_score",
    "performance": "performance_rating",
    "salary": "salary",
    "tenure": "tenure",
    "age": "age",
    "headcount": None,       # count-based
    "attrition": None,       # termination-based
}


@router.get("/analyze")
async def analyze_metric(
    metric: str = "engagement",
    alert_id: Optional[str] = None,
    department: Optional[str] = None,
    location: Optional[str] = None,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)

    # Resolve alert context
    alert_context = None
    if alert_id:
        try:
            from uuid import UUID
            alert = db.query(OrgHealthAlert).filter(OrgHealthAlert.id == UUID(alert_id)).first()
            if alert:
                alert_context = {
                    "title": alert.title,
                    "description": alert.description,
                    "severity": alert.severity.value if hasattr(alert.severity, "value") else alert.severity,
                    "affected_org_unit": alert.affected_org_unit,
                }
                # Infer metric from alert type
                title_lower = (alert.title or "").lower()
                if "engagement" in title_lower:
                    metric = "engagement"
                elif "performance" in title_lower:
                    metric = "performance"
                elif "attrition" in title_lower or "turnover" in title_lower:
                    metric = "attrition"
                elif "salary" in title_lower or "compensation" in title_lower:
                    metric = "salary"
        except Exception:
            pass

    attr_name = METRIC_ATTR.get(metric)

    # Base query
    base = db.query(Employee).filter(Employee.organization_id == org_id)
    if department:
        base = base.filter(Employee.department == department)
    if location:
        base = base.filter(Employee.location == location)

    # By department
    by_dept = []
    if metric in ("headcount", "attrition"):
        if metric == "headcount":
            rows = (
                base.filter(Employee.status == EmployeeStatus.active)
                .with_entities(Employee.department, func.count(Employee.id).label("count"))
                .group_by(Employee.department)
                .order_by(func.count(Employee.id).desc())
                .all()
            )
            by_dept = [{"name": r.department or "Unknown", "avg_value": r.count, "count": r.count} for r in rows if r.department]
        else:  # attrition
            rows = (
                base.filter(Employee.status == EmployeeStatus.terminated)
                .with_entities(Employee.department, func.count(Employee.id).label("count"))
                .group_by(Employee.department)
                .order_by(func.count(Employee.id).desc())
                .all()
            )
            by_dept = [{"name": r.department or "Unknown", "avg_value": r.count, "count": r.count} for r in rows if r.department]
    elif attr_name:
        attr = getattr(Employee, attr_name)
        rows = (
            base.filter(attr.isnot(None))
            .with_entities(
                Employee.department,
                func.avg(attr).label("avg_value"),
                func.count(Employee.id).label("count"),
            )
            .group_by(Employee.department)
            .order_by(func.avg(attr).desc())
            .all()
        )
        by_dept = [
            {"name": r.department or "Unknown", "avg_value": round(float(r.avg_value), 2), "count": r.count}
            for r in rows if r.department
        ]

    # By location
    by_location = []
    if metric in ("headcount", "attrition"):
        if metric == "headcount":
            rows = (
                base.filter(Employee.status == EmployeeStatus.active)
                .with_entities(Employee.location, func.count(Employee.id).label("count"))
                .group_by(Employee.location)
                .order_by(func.count(Employee.id).desc())
                .all()
            )
            by_location = [{"name": r.location or "Unknown", "avg_value": r.count, "count": r.count} for r in rows if r.location]
        else:
            rows = (
                base.filter(Employee.status == EmployeeStatus.terminated)
                .with_entities(Employee.location, func.count(Employee.id).label("count"))
                .group_by(Employee.location)
                .order_by(func.count(Employee.id).desc())
                .all()
            )
            by_location = [{"name": r.location or "Unknown", "avg_value": r.count, "count": r.count} for r in rows if r.location]
    elif attr_name:
        attr = getattr(Employee, attr_name)
        rows = (
            base.filter(attr.isnot(None))
            .with_entities(
                Employee.location,
                func.avg(attr).label("avg_value"),
                func.count(Employee.id).label("count"),
            )
            .group_by(Employee.location)
            .order_by(func.avg(attr).desc())
            .all()
        )
        by_location = [
            {"name": r.location or "Unknown", "avg_value": round(float(r.avg_value), 2), "count": r.count}
            for r in rows if r.location
        ]

    # Trend over time (by hire year)
    trend = []
    if attr_name:
        attr = getattr(Employee, attr_name)
        rows = (
            base.filter(attr.isnot(None), Employee.hire_date.isnot(None))
            .with_entities(
                extract("year", Employee.hire_date).label("yr"),
                func.avg(attr).label("avg_value"),
                func.count(Employee.id).label("count"),
            )
            .group_by("yr")
            .order_by("yr")
            .all()
        )
        trend = [
            {"month": str(int(r.yr)), "value": round(float(r.avg_value), 2), "period": str(int(r.yr)), "avg_value": round(float(r.avg_value), 2), "count": r.count}
            for r in rows
        ]

    # Overall summary
    overall = None
    if attr_name:
        attr = getattr(Employee, attr_name)
        result = base.filter(attr.isnot(None)).with_entities(
            func.avg(attr), func.min(attr), func.max(attr), func.count(Employee.id)
        ).first()
        if result and result[0] is not None:
            overall = {
                "avg": round(float(result[0]), 2),
                "min": round(float(result[1]), 2),
                "max": round(float(result[2]), 2),
                "count": result[3],
            }

    return {
        "status": "success",
        "metric": metric,
        "alert_context": alert_context,
        "by_department": by_dept[:20],
        "by_location": by_location[:20],
        "trend": trend,
        "overall": overall,
    }
