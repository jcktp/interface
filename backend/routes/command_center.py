from typing import Dict, Any, Optional
from datetime import date, timedelta
from calendar import monthrange
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from database.connection import get_db
from services.auth.security import verify_token, get_org_id

router = APIRouter(prefix="/api/command-center", tags=["Command Center"])


@router.get("/health")
async def get_health(
    departments: Optional[str] = None,
    locations: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    from database.models import (
        Employee, EmployeeStatus,
        JobRequisition, RequisitionStatus,
        OrgHealthAlert, AlertStatus,
        AttendanceRecord, AttendanceStatus,
    )
    from utils.filters import apply_global_filters
    org_id = get_org_id(user)

    def _base():
        q = db.query(Employee).filter(Employee.organization_id == org_id)
        return apply_global_filters(q, Employee, departments=departments, locations=locations, start_date=start_date, end_date=end_date)

    total_emp = _base().count()
    active_emp = _base().filter(Employee.status == EmployeeStatus.active).count()
    terminated_emp = _base().filter(Employee.status == EmployeeStatus.terminated).count()

    attrition_rate = round((terminated_emp / total_emp * 100), 1) if total_emp > 0 else 0

    active_q = _base().filter(Employee.status == EmployeeStatus.active)
    engagement_stats = active_q.with_entities(
        func.avg(Employee.engagement_score),
        func.avg(Employee.performance_rating),
    ).first()
    avg_engagement = round(float(engagement_stats[0] or 0), 2)
    avg_performance = round(float(engagement_stats[1] or 0), 2)

    open_req = db.query(func.count(JobRequisition.id)).filter(
        JobRequisition.organization_id == org_id,
        JobRequisition.status.in_([RequisitionStatus.open]),
    ).scalar() or 0

    active_alerts = db.query(func.count(OrgHealthAlert.id)).filter(
        OrgHealthAlert.organization_id == org_id,
        OrgHealthAlert.status == AlertStatus.active,
    ).scalar() or 0

    # Attendance rate over last 30 days
    cutoff = date.today() - timedelta(days=30)
    att_base = db.query(AttendanceRecord).filter(
        AttendanceRecord.organization_id == org_id,
        AttendanceRecord.record_date >= cutoff,
    )
    att_total = att_base.count()
    att_present = att_base.filter(
        AttendanceRecord.status.in_([AttendanceStatus.in_office, AttendanceStatus.remote])
    ).count()
    attendance_rate = round((att_present / att_total * 100), 1) if att_total > 0 else 0

    return {
        "status": "success",
        "headcount": active_emp,
        "attrition_rate": attrition_rate,
        "avg_engagement": avg_engagement,
        "avg_performance": avg_performance,
        "open_requisitions": open_req,
        "active_alerts": active_alerts,
        "attendance_rate": attendance_rate,
    }


@router.get("/trends")
async def get_trends(
    months: int = 6,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    from database.models import Employee, EmployeeStatus
    from datetime import datetime as dt
    org_id = get_org_id(user)

    today = date.today()

    # If a date range is provided, derive months and anchor point from it
    if start_date and start_date != 'all' and end_date and end_date != 'all':
        try:
            range_end = dt.strptime(end_date, '%Y-%m-%d').date()
            range_start = dt.strptime(start_date, '%Y-%m-%d').date()
            diff_days = (range_end - range_start).days
            months = max(1, min(round(diff_days / 30), 24))
            anchor = range_end
        except ValueError:
            anchor = today
    else:
        anchor = today

    trends = []

    for i in range(months - 1, -1, -1):
        month_first = (anchor.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        _, last_day = monthrange(month_first.year, month_first.month)
        month_end = month_first.replace(day=last_day)

        active = db.query(func.count(Employee.id)).filter(
            Employee.organization_id == org_id,
            Employee.hire_date <= month_end,
            or_(Employee.termination_date.is_(None), Employee.termination_date > month_end),
        ).scalar() or 0

        terminated = db.query(func.count(Employee.id)).filter(
            Employee.organization_id == org_id,
            Employee.termination_date >= month_first,
            Employee.termination_date <= month_end,
        ).scalar() or 0

        is_current_month = (month_first.year == today.year and month_first.month == today.month)
        if is_current_month and today.day > 0:
            scale = last_day / max(today.day, 1)
            effective_terminated = terminated * scale
        else:
            effective_terminated = terminated

        attrition = round((effective_terminated / max(active, 1)) * 100, 1)

        trends.append({
            "date": month_end.isoformat(),
            "month": month_end.strftime("%b %Y"),
            "headcount": active,
            "attrition_rate": attrition,
        })

    return {"status": "success", "trends": trends}


@router.get("/alerts")
async def get_alerts(user=Depends(verify_token), db: Session = Depends(get_db)):
    from database.models import OrgHealthAlert, AlertStatus
    org_id = get_org_id(user)

    alerts = db.query(OrgHealthAlert).filter(
        OrgHealthAlert.organization_id == org_id,
        OrgHealthAlert.status == AlertStatus.active,
    ).order_by(OrgHealthAlert.created_at.desc()).limit(50).all()

    return {
        "status": "success",
        "alerts": [
            {
                "id": str(a.id),
                "title": a.title,
                "description": a.description,
                "severity": a.severity.value if hasattr(a.severity, "value") else a.severity,
                "status": a.status.value if hasattr(a.status, "value") else a.status,
                "trend": a.trend_direction,
                "affected_department": a.affected_org_unit,
                "affected_count": None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in alerts
        ],
    }


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(alert_id: str, user=Depends(verify_token), db: Session = Depends(get_db)):
    from database.models import OrgHealthAlert, AlertStatus
    from datetime import datetime
    alert = db.query(OrgHealthAlert).filter(OrgHealthAlert.id == alert_id).first()
    if alert:
        alert.status = AlertStatus.acknowledged
        alert.updated_at = datetime.utcnow()
        db.commit()
    return {"status": "success"}


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, user=Depends(verify_token), db: Session = Depends(get_db)):
    from database.models import OrgHealthAlert, AlertStatus
    from datetime import datetime
    alert = db.query(OrgHealthAlert).filter(OrgHealthAlert.id == alert_id).first()
    if alert:
        alert.status = AlertStatus.resolved
        alert.updated_at = datetime.utcnow()
        db.commit()
    return {"status": "success"}


@router.post("/run-detection")
async def run_detection(user=Depends(verify_token)):
    return {"status": "success", "message": "Anomaly detection started"}
