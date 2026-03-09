from typing import Dict, Any, Optional
from datetime import datetime, date, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract

from database.connection import get_db
from database.models import Dashboard, DashboardShare, Employee, EmployeeStatus
from services.auth.security import verify_token, get_org_id, get_user_id

router = APIRouter(prefix="/api/dashboards", tags=["Dashboards"])


def _serialize_dashboard(d) -> Dict[str, Any]:
    return {
        "id": str(d.id),
        "name": d.name,
        "description": d.description,
        "is_default": d.is_default,
        "is_public": d.is_public,
        "layout": d.layout or [],
        "widgets": d.widgets or [],
        "global_filters": d.global_filters or {},
        "theme": d.theme or "light",
        "refresh_interval": d.refresh_interval,
        "created_by": str(d.created_by),
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "updated_at": d.updated_at.isoformat() if d.updated_at else None,
    }


@router.get("")
async def list_dashboards(
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    dashboards = (
        db.query(Dashboard)
        .filter(Dashboard.organization_id == org_id)
        .order_by(Dashboard.updated_at.desc())
        .all()
    )
    return {"status": "success", "dashboards": [_serialize_dashboard(d) for d in dashboards]}


@router.post("")
async def create_dashboard(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    name = data.get("name", "").strip() or "Untitled Dashboard"
    dashboard = Dashboard(
        organization_id=org_id,
        name=name,
        description=data.get("description"),
        is_default=data.get("is_default", False),
        is_public=data.get("is_public", False),
        layout=data.get("layout", []),
        widgets=data.get("widgets", []),
        global_filters=data.get("global_filters", {}),
        theme=data.get("theme", "light"),
        refresh_interval=data.get("refresh_interval"),
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(dashboard)
    db.commit()
    db.refresh(dashboard)
    return {"status": "success", "dashboard": _serialize_dashboard(dashboard), "id": str(dashboard.id)}


@router.get("/{dashboard_id}")
async def get_dashboard(
    dashboard_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == UUID(dashboard_id),
        Dashboard.organization_id == org_id,
    ).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {"status": "success", "dashboard": _serialize_dashboard(dashboard)}


@router.put("/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == UUID(dashboard_id),
        Dashboard.organization_id == org_id,
    ).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    for field in ("name", "description", "is_default", "is_public", "layout", "widgets", "global_filters", "theme", "refresh_interval"):
        if field in data:
            setattr(dashboard, field, data[field])
    dashboard.updated_by = user_id
    dashboard.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(dashboard)
    return {"status": "success", "dashboard": _serialize_dashboard(dashboard)}


@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == UUID(dashboard_id),
        Dashboard.organization_id == org_id,
    ).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    db.delete(dashboard)
    db.commit()
    return {"status": "success"}


@router.post("/{dashboard_id}/duplicate")
async def duplicate_dashboard(
    dashboard_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    original = db.query(Dashboard).filter(
        Dashboard.id == UUID(dashboard_id),
        Dashboard.organization_id == org_id,
    ).first()
    if not original:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    copy = Dashboard(
        organization_id=org_id,
        name=data.get("name", f"{original.name} (Copy)"),
        description=original.description,
        is_default=False,
        is_public=False,
        layout=original.layout,
        widgets=original.widgets,
        global_filters=original.global_filters,
        theme=original.theme,
        refresh_interval=original.refresh_interval,
        created_by=user_id,
        updated_by=user_id,
    )
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return {"status": "success", "dashboard": _serialize_dashboard(copy), "id": str(copy.id)}


@router.post("/{dashboard_id}/share")
async def share_dashboard(
    dashboard_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    dashboard = db.query(Dashboard).filter(
        Dashboard.id == UUID(dashboard_id),
        Dashboard.organization_id == org_id,
    ).first()
    if not dashboard:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {"status": "success", "message": "Dashboard shared"}


# ==================== Widget Data Router ====================

widgets_router = APIRouter(prefix="/api/widgets", tags=["Widgets"])


def _get_metric_data(db: Session, org_id, config: Dict[str, Any]) -> Dict[str, Any]:
    metric = config.get("metric", "headcount")
    dept = config.get("department")

    base_q = db.query(Employee).filter(Employee.organization_id == org_id)
    if dept:
        base_q = base_q.filter(Employee.department == dept)
    active_q = base_q.filter(Employee.status == EmployeeStatus.active)

    # Handle custom metric definitions (prefixed with "custom:")
    if metric.startswith("custom:"):
        from database.models import MetricDefinition
        from uuid import UUID as _UUID
        from services.query_service import QueryService
        metric_id = metric.split(":", 1)[1]
        try:
            defn = db.query(MetricDefinition).filter(MetricDefinition.id == _UUID(metric_id)).first()
            if defn and defn.sql_expression:
                qs = QueryService(db)
                result = qs.execute_query(org_id, org_id, defn.sql_expression)
                rows = result.get("rows", [])
                value = next(iter(rows[0].values()), None) if rows else None
                return {"value": value, "label": defn.name}
        except Exception:
            pass
        return {"value": None, "label": metric_id}

    if metric == "headcount":
        return {"value": base_q.count(), "label": "Total Headcount"}
    elif metric == "active_employees":
        return {"value": active_q.count(), "label": "Active Employees"}
    elif metric == "new_hires":
        thirty = date.today() - timedelta(days=30)
        return {"value": base_q.filter(Employee.hire_date >= thirty).count(), "label": "New Hires (Last 30 Days)"}
    elif metric == "new_hires_quarter":
        quarter = date.today() - timedelta(days=90)
        return {"value": active_q.filter(Employee.hire_date >= quarter).count(), "label": "New Hires (This Quarter)"}
    elif metric == "new_hires_year":
        year_start = date(date.today().year, 1, 1)
        return {"value": active_q.filter(Employee.hire_date >= year_start).count(), "label": "New Hires (This Year)"}
    elif metric == "avg_tenure":
        val = active_q.with_entities(func.avg(Employee.tenure)).scalar() or 0
        return {"value": round(float(val), 1), "label": "Avg Tenure", "suffix": " yrs"}
    elif metric == "avg_age":
        val = active_q.with_entities(func.avg(Employee.age)).scalar() or 0
        return {"value": round(float(val), 1), "label": "Avg Age", "suffix": " yrs"}
    elif metric == "full_time_count":
        return {"value": active_q.filter(Employee.employment_type.ilike("full%")).count(), "label": "Full-Time Employees"}
    elif metric == "part_time_count":
        return {"value": active_q.filter(Employee.employment_type.ilike("part%")).count(), "label": "Part-Time Employees"}
    elif metric == "contractor_count":
        return {"value": active_q.filter(Employee.employment_type.ilike("contract%")).count(), "label": "Contractors"}
    elif metric == "remote_percentage":
        total = active_q.count()
        remote = active_q.filter(Employee.work_type == "remote").count()
        return {"value": round(remote / total * 100, 1) if total > 0 else 0, "label": "Remote Work %", "suffix": "%"}
    elif metric == "turnover_rate":
        total = base_q.count()
        term = base_q.filter(Employee.status == EmployeeStatus.terminated).count()
        return {"value": round(term / total * 100, 1) if total > 0 else 0, "label": "Turnover Rate", "suffix": "%"}
    elif metric == "voluntary_turnover":
        total = base_q.count()
        vol = base_q.filter(Employee.status == EmployeeStatus.terminated, Employee.termination_reason.ilike("Voluntary%")).count()
        return {"value": round(vol / total * 100, 1) if total > 0 else 0, "label": "Voluntary Turnover", "suffix": "%"}
    elif metric == "involuntary_turnover":
        total = base_q.count()
        inv = base_q.filter(Employee.status == EmployeeStatus.terminated, Employee.termination_reason.ilike("Involuntary%")).count()
        return {"value": round(inv / total * 100, 1) if total > 0 else 0, "label": "Involuntary Turnover", "suffix": "%"}
    elif metric == "retention_rate":
        total = base_q.count()
        term = base_q.filter(Employee.status == EmployeeStatus.terminated).count()
        return {"value": round((1 - term / total) * 100, 1) if total > 0 else 0, "label": "Retention Rate", "suffix": "%"}
    elif metric == "first_year_turnover":
        term_q = base_q.filter(Employee.status == EmployeeStatus.terminated)
        total_term = term_q.count()
        first_year = term_q.filter(Employee.tenure < 1).count()
        return {"value": round(first_year / total_term * 100, 1) if total_term > 0 else 0, "label": "First-Year Turnover", "suffix": "%"}
    elif metric == "terminations_last_30":
        thirty = date.today() - timedelta(days=30)
        count = base_q.filter(Employee.status == EmployeeStatus.terminated, Employee.termination_date >= thirty).count()
        return {"value": count, "label": "Terminations (Last 30 Days)"}
    elif metric == "terminations_quarter":
        quarter = date.today() - timedelta(days=90)
        count = base_q.filter(Employee.status == EmployeeStatus.terminated, Employee.termination_date >= quarter).count()
        return {"value": count, "label": "Terminations (This Quarter)"}
    elif metric == "avg_tenure_terminated":
        val = base_q.filter(Employee.status == EmployeeStatus.terminated).with_entities(func.avg(Employee.tenure)).scalar() or 0
        return {"value": round(float(val), 1), "label": "Avg Tenure (Departed)", "suffix": " yrs"}
    elif metric == "open_positions":
        from database.models import JobRequisition, RequisitionStatus
        count = db.query(func.count(JobRequisition.id)).filter(
            JobRequisition.organization_id == org_id, JobRequisition.status == RequisitionStatus.open
        ).scalar() or 0
        return {"value": count, "label": "Open Positions"}
    elif metric == "total_candidates":
        from database.models import Candidate
        count = db.query(func.count(Candidate.id)).filter(Candidate.organization_id == org_id).scalar() or 0
        return {"value": count, "label": "Total Candidates"}
    elif metric == "active_candidates":
        from database.models import Candidate, CandidateStatus
        count = db.query(func.count(Candidate.id)).filter(
            Candidate.organization_id == org_id,
            Candidate.status.in_([CandidateStatus.screening, CandidateStatus.interview, CandidateStatus.offer])
        ).scalar() or 0
        return {"value": count, "label": "Active Candidates"}
    elif metric == "hired_count":
        from database.models import Candidate, CandidateStatus
        count = db.query(func.count(Candidate.id)).filter(
            Candidate.organization_id == org_id, Candidate.status == CandidateStatus.hired
        ).scalar() or 0
        return {"value": count, "label": "Total Hired"}
    elif metric == "offer_acceptance_rate":
        from database.models import Candidate, CandidateStatus
        offers = db.query(func.count(Candidate.id)).filter(
            Candidate.organization_id == org_id, Candidate.status.in_([CandidateStatus.offer, CandidateStatus.hired])
        ).scalar() or 0
        hired = db.query(func.count(Candidate.id)).filter(
            Candidate.organization_id == org_id, Candidate.status == CandidateStatus.hired
        ).scalar() or 0
        return {"value": round(hired / offers * 100, 1) if offers > 0 else 0, "label": "Offer Acceptance Rate", "suffix": "%"}
    elif metric == "avg_time_to_fill":
        from database.models import Candidate, CandidateStatus
        try:
            hired = db.query(Candidate.application_date, Candidate.offer_accepted_date).filter(
                Candidate.organization_id == org_id,
                Candidate.status == CandidateStatus.hired,
                Candidate.offer_accepted_date.isnot(None),
                Candidate.application_date.isnot(None),
            ).limit(500).all()
            days_list = [(c.offer_accepted_date - c.application_date).days for c in hired if c.offer_accepted_date and c.application_date]
            val = round(sum(days_list) / len(days_list)) if days_list else 0
        except Exception:
            val = 0
        return {"value": val, "label": "Avg Time to Fill", "suffix": " days"}
    elif metric == "pipeline_conversion":
        from database.models import Candidate, CandidateStatus
        total_c = db.query(func.count(Candidate.id)).filter(Candidate.organization_id == org_id).scalar() or 0
        hired = db.query(func.count(Candidate.id)).filter(
            Candidate.organization_id == org_id, Candidate.status == CandidateStatus.hired
        ).scalar() or 0
        return {"value": round(hired / total_c * 100, 1) if total_c > 0 else 0, "label": "Pipeline Conversion", "suffix": "%"}
    elif metric == "cost_per_hire":
        val = active_q.with_entities(func.avg(Employee.cost_per_hire)).scalar() or 0
        return {"value": round(float(val), 0), "label": "Cost per Hire", "prefix": "€"}
    elif metric == "avg_salary":
        val = active_q.with_entities(func.avg(Employee.salary)).scalar() or 0
        return {"value": round(float(val), 0), "label": "Avg Salary", "prefix": "€"}
    elif metric == "median_salary":
        salaries = sorted([r[0] for r in active_q.with_entities(Employee.salary).all() if r[0]])
        mid = salaries[len(salaries) // 2] if salaries else 0
        return {"value": round(float(mid), 0), "label": "Median Salary", "prefix": "€"}
    elif metric == "total_payroll":
        val = active_q.with_entities(func.sum(Employee.salary)).scalar() or 0
        return {"value": round(float(val), 0), "label": "Total Payroll", "prefix": "€"}
    elif metric == "avg_salary_increase":
        # Use bonus_target as % of salary as compensation increase proxy
        rows = active_q.with_entities(Employee.salary, Employee.bonus_target).filter(
            Employee.salary.isnot(None), Employee.bonus_target.isnot(None), Employee.salary > 0
        ).all()
        if rows:
            pcts = [r.bonus_target / r.salary * 100 for r in rows if r.salary > 0]
            val = round(sum(pcts) / len(pcts), 1) if pcts else 0
        else:
            val = 0
        return {"value": val, "label": "Avg Bonus % of Salary", "suffix": "%"}
    elif metric == "compa_ratio":
        # Internal compa ratio: salary vs median salary for same job level
        level_rows = active_q.with_entities(Employee.job_level, Employee.salary).filter(
            Employee.salary.isnot(None), Employee.job_level.isnot(None)
        ).all()
        level_salaries: Dict[str, list] = {}
        for r in level_rows:
            level_salaries.setdefault(r.job_level, []).append(r.salary)
        level_medians = {
            lvl: sorted(sals)[len(sals) // 2]
            for lvl, sals in level_salaries.items() if sals
        }
        compa_vals = [
            r.salary / level_medians[r.job_level]
            for r in level_rows
            if r.job_level in level_medians and level_medians[r.job_level] > 0
        ]
        compa = round(sum(compa_vals) / len(compa_vals), 2) if compa_vals else 1.0
        return {"value": compa, "label": "Internal Compa-Ratio"}
    elif metric == "revenue_per_employee":
        from database.models import OrganizationFinancial
        fin = db.query(OrganizationFinancial).filter(OrganizationFinancial.organization_id == org_id).order_by(OrganizationFinancial.year.desc()).first()
        headcount = active_q.count()
        rev = float(fin.annual_revenue) if fin else 0
        return {"value": round(rev / headcount, 0) if headcount > 0 else 0, "label": "Revenue per Employee", "prefix": "€"}
    elif metric == "profit_per_employee":
        from database.models import OrganizationFinancial
        fin = db.query(OrganizationFinancial).filter(OrganizationFinancial.organization_id == org_id).order_by(OrganizationFinancial.year.desc()).first()
        headcount = active_q.count()
        profit = float(fin.annual_profit) if fin else 0
        return {"value": round(profit / headcount, 0) if headcount > 0 else 0, "label": "Profit per Employee", "prefix": "€"}
    elif metric == "engagement":
        val = active_q.with_entities(func.avg(Employee.engagement_score)).scalar() or 0
        return {"value": round(float(val), 1), "label": "Engagement Score", "suffix": "/5"}
    elif metric == "performance":
        val = active_q.with_entities(func.avg(Employee.performance_rating)).scalar() or 0
        return {"value": round(float(val), 1), "label": "Performance Rating", "suffix": "/5"}
    elif metric == "high_performers_pct":
        total = active_q.count()
        high = active_q.filter(Employee.performance_rating >= 4).count()
        return {"value": round(high / total * 100, 1) if total > 0 else 0, "label": "High Performers %", "suffix": "%"}
    elif metric == "low_performers_pct":
        total = active_q.count()
        low = active_q.filter(Employee.performance_rating <= 2).count()
        return {"value": round(low / total * 100, 1) if total > 0 else 0, "label": "Low Performers %", "suffix": "%"}
    elif metric == "flight_risk_count":
        return {"value": active_q.filter(Employee.flight_risk == "high").count(), "label": "Flight Risk Employees"}
    elif metric == "flight_risk_pct":
        total = active_q.count()
        high = active_q.filter(Employee.flight_risk == "high").count()
        return {"value": round(high / total * 100, 1) if total > 0 else 0, "label": "Flight Risk %", "suffix": "%"}
    elif metric == "gender_diversity_ratio":
        total = active_q.count()
        female = active_q.filter(Employee.gender == "female").count()
        return {"value": round(female / total * 100, 1) if total > 0 else 0, "label": "Women %", "suffix": "%"}
    elif metric == "women_in_leadership":
        lead_q = active_q.filter(Employee.job_level.in_(["Manager", "Director", "Executive", "VP"]))
        total_l = lead_q.count()
        women_l = lead_q.filter(Employee.gender == "female").count()
        return {"value": round(women_l / total_l * 100, 1) if total_l > 0 else 0, "label": "Women in Leadership", "suffix": "%"}
    elif metric == "pay_equity_gap":
        salaries = active_q.with_entities(
            func.avg(case((Employee.gender == "male", Employee.salary))).label("m"),
            func.avg(case((Employee.gender == "female", Employee.salary))).label("f"),
        ).first()
        gap = 0
        if salaries and salaries.m and salaries.f and salaries.m > 0:
            gap = round(((salaries.m - salaries.f) / salaries.m) * 100, 1)
        return {"value": gap, "label": "Pay Equity Gap", "suffix": "%"}
    elif metric == "ethnic_diversity_index":
        total = active_q.count()
        groups = dict(active_q.with_entities(Employee.ethnicity, func.count(Employee.id)).group_by(Employee.ethnicity).all())
        index = 1.0 - sum((v / total) ** 2 for v in groups.values()) if total > 0 else 0
        return {"value": round(index * 100, 1), "label": "Ethnic Diversity Index", "suffix": "/100"}
    elif metric == "attendance_rate":
        from database.models import AttendanceRecord, AttendanceStatus
        try:
            total_r = db.query(func.count(AttendanceRecord.id)).filter(AttendanceRecord.organization_id == org_id).scalar() or 0
            present = db.query(func.count(AttendanceRecord.id)).filter(
                AttendanceRecord.organization_id == org_id,
                AttendanceRecord.status.in_([AttendanceStatus.in_office, AttendanceStatus.remote])
            ).scalar() or 0
            rate = round(present / total_r * 100, 1) if total_r > 0 else 0
        except Exception:
            rate = 0
        return {"value": rate, "label": "Attendance Rate", "suffix": "%"}
    elif metric == "absence_rate":
        from database.models import AttendanceRecord, AttendanceStatus
        try:
            total_r = db.query(func.count(AttendanceRecord.id)).filter(AttendanceRecord.organization_id == org_id).scalar() or 0
            absent = db.query(func.count(AttendanceRecord.id)).filter(
                AttendanceRecord.organization_id == org_id, AttendanceRecord.status == AttendanceStatus.absent
            ).scalar() or 0
            rate = round(absent / total_r * 100, 1) if total_r > 0 else 0
        except Exception:
            rate = 0
        return {"value": rate, "label": "Absence Rate", "suffix": "%"}
    elif metric == "avg_sick_days":
        from database.models import AttendanceRecord, AttendanceStatus
        try:
            emp_count = active_q.count()
            leave_count = db.query(func.count(AttendanceRecord.id)).filter(
                AttendanceRecord.organization_id == org_id,
                AttendanceRecord.status.in_([AttendanceStatus.absent, AttendanceStatus.leave]),
            ).scalar() or 0
            # Normalize to annual average (records span ~2 years)
            val = round(leave_count / emp_count / 2, 1) if emp_count > 0 else 0
        except Exception:
            val = 0
        return {"value": val, "label": "Avg Absent/Leave Days per Year"}
    else:
        return {"value": 0, "label": metric}


def _get_chart_data(db: Session, org_id, config: Dict[str, Any]) -> Dict[str, Any]:
    data_source = config.get("data_source", "headcount_by_department")
    dept_filter = config.get("department")

    base_q = db.query(Employee).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active)
    if dept_filter:
        base_q = base_q.filter(Employee.department == dept_filter)

    if data_source == "headcount_by_department":
        rows = base_q.with_entities(Employee.department, func.count(Employee.id)).group_by(Employee.department).order_by(func.count(Employee.id).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Headcount", "data": [r[1] for r in rows]}]}
    elif data_source == "headcount_by_location":
        rows = base_q.with_entities(Employee.location, func.count(Employee.id)).group_by(Employee.location).order_by(func.count(Employee.id).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Headcount", "data": [r[1] for r in rows]}]}
    elif data_source == "headcount_by_level":
        rows = base_q.with_entities(Employee.job_level, func.count(Employee.id)).group_by(Employee.job_level).order_by(func.count(Employee.id).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Headcount", "data": [r[1] for r in rows]}]}
    elif data_source == "headcount_by_type":
        rows = base_q.with_entities(Employee.employment_type, func.count(Employee.id)).group_by(Employee.employment_type).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Headcount", "data": [r[1] for r in rows]}]}
    elif data_source == "headcount_trend":
        rows = (
            db.query(Employee)
            .filter(Employee.organization_id == org_id, Employee.hire_date.isnot(None))
            .with_entities(extract("year", Employee.hire_date).label("yr"), extract("month", Employee.hire_date).label("mo"), func.count(Employee.id).label("cnt"))
            .group_by("yr", "mo").order_by("yr", "mo").all()
        )
        return {"labels": [f"{int(r.yr)}-{int(r.mo):02d}" for r in rows], "datasets": [{"label": "Hires", "data": [r.cnt for r in rows]}]}
    elif data_source == "salary_by_department":
        rows = base_q.with_entities(Employee.department, func.avg(Employee.salary)).group_by(Employee.department).order_by(func.avg(Employee.salary).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Avg Salary", "data": [round(float(r[1] or 0), 0) for r in rows]}]}
    elif data_source == "salary_by_level":
        rows = base_q.with_entities(Employee.job_level, func.avg(Employee.salary)).group_by(Employee.job_level).order_by(func.avg(Employee.salary).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Avg Salary", "data": [round(float(r[1] or 0), 0) for r in rows]}]}
    elif data_source == "salary_by_location":
        rows = base_q.with_entities(Employee.location, func.avg(Employee.salary)).group_by(Employee.location).order_by(func.avg(Employee.salary).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Avg Salary", "data": [round(float(r[1] or 0), 0) for r in rows]}]}
    elif data_source == "salary_distribution":
        buckets = [(0, 50000, "<50k"), (50000, 75000, "50-75k"), (75000, 100000, "75-100k"), (100000, 150000, "100-150k"), (150000, 999999999, "150k+")]
        data = []
        for low, high, _ in buckets:
            data.append(base_q.filter(Employee.salary >= low, Employee.salary < high).count())
        return {"labels": [b[2] for b in buckets], "datasets": [{"label": "Employees", "data": data}]}
    elif data_source == "gender_distribution":
        rows = base_q.with_entities(Employee.gender, func.count(Employee.id)).group_by(Employee.gender).all()
        return {"labels": [(r[0] or "Unknown").title() for r in rows], "datasets": [{"label": "Employees", "data": [r[1] for r in rows]}]}
    elif data_source == "ethnicity_distribution":
        rows = base_q.with_entities(Employee.ethnicity, func.count(Employee.id)).group_by(Employee.ethnicity).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Employees", "data": [r[1] for r in rows]}]}
    elif data_source == "gender_by_department":
        depts = [r[0] for r in base_q.with_entities(Employee.department).distinct().all()]
        male_data = [base_q.filter(Employee.department == d, Employee.gender == "male").count() for d in depts]
        female_data = [base_q.filter(Employee.department == d, Employee.gender == "female").count() for d in depts]
        return {"labels": depts, "datasets": [{"label": "Male", "data": male_data}, {"label": "Female", "data": female_data}]}
    elif data_source == "gender_by_level":
        levels = [r[0] for r in base_q.with_entities(Employee.job_level).distinct().all()]
        male_data = [base_q.filter(Employee.job_level == l, Employee.gender == "male").count() for l in levels]
        female_data = [base_q.filter(Employee.job_level == l, Employee.gender == "female").count() for l in levels]
        return {"labels": levels, "datasets": [{"label": "Male", "data": male_data}, {"label": "Female", "data": female_data}]}
    elif data_source == "performance_distribution":
        buckets = [(1, 2, "1-2"), (2, 3, "2-3"), (3, 4, "3-4"), (4, 6, "4-5")]
        data = [base_q.filter(Employee.performance_rating >= b[0], Employee.performance_rating < b[1]).count() for b in buckets]
        return {"labels": [b[2] for b in buckets], "datasets": [{"label": "Employees", "data": data}]}
    elif data_source == "performance_by_department":
        rows = base_q.with_entities(Employee.department, func.avg(Employee.performance_rating)).group_by(Employee.department).order_by(func.avg(Employee.performance_rating).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Avg Performance", "data": [round(float(r[1] or 0), 2) for r in rows]}]}
    elif data_source == "engagement_by_department":
        rows = base_q.with_entities(Employee.department, func.avg(Employee.engagement_score)).group_by(Employee.department).order_by(func.avg(Employee.engagement_score).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Avg Engagement", "data": [round(float(r[1] or 0), 1) for r in rows]}]}
    elif data_source == "turnover_by_department":
        all_q = db.query(Employee).filter(Employee.organization_id == org_id)
        rows = all_q.with_entities(
            Employee.department,
            func.count(Employee.id).label("total"),
            func.sum(case((Employee.status == EmployeeStatus.terminated, 1), else_=0)).label("term")
        ).group_by(Employee.department).all()
        valid = sorted(
            [{"dept": r.department, "rate": round(r.term / r.total * 100, 1)} for r in rows if r.total > 0 and r.department],
            key=lambda x: x["rate"], reverse=True
        )
        return {"labels": [r["dept"] for r in valid], "datasets": [{"label": "Turnover Rate %", "data": [r["rate"] for r in valid]}]}
    elif data_source == "turnover_trend":
        rows = (
            db.query(Employee)
            .filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.terminated, Employee.termination_date.isnot(None))
            .with_entities(extract("year", Employee.termination_date).label("yr"), extract("month", Employee.termination_date).label("mo"), func.count(Employee.id).label("cnt"))
            .group_by("yr", "mo").order_by("yr", "mo").all()
        )
        return {"labels": [f"{int(r.yr)}-{int(r.mo):02d}" for r in rows], "datasets": [{"label": "Terminations", "data": [r.cnt for r in rows]}]}
    elif data_source == "turnover_by_tenure":
        term_q = db.query(Employee).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.terminated)
        buckets = [(0, 1, "<1 yr"), (1, 3, "1-3 yrs"), (3, 5, "3-5 yrs"), (5, 10, "5-10 yrs"), (10, 999, "10+ yrs")]
        data = [term_q.filter(Employee.tenure >= b[0], Employee.tenure < b[1]).count() for b in buckets]
        return {"labels": [b[2] for b in buckets], "datasets": [{"label": "Terminations", "data": data}]}
    elif data_source == "termination_reasons":
        rows = (
            db.query(Employee)
            .filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.terminated, Employee.termination_reason.isnot(None))
            .with_entities(Employee.termination_reason, func.count(Employee.id))
            .group_by(Employee.termination_reason).order_by(func.count(Employee.id).desc()).all()
        )
        return {"labels": [r[0] for r in rows], "datasets": [{"label": "Count", "data": [r[1] for r in rows]}]}
    elif data_source == "candidates_by_status":
        from database.models import Candidate
        rows = db.query(Candidate).filter(Candidate.organization_id == org_id).with_entities(Candidate.status, func.count(Candidate.id)).group_by(Candidate.status).all()
        return {"labels": [str(r[0].value) if hasattr(r[0], "value") else str(r[0]) for r in rows], "datasets": [{"label": "Candidates", "data": [r[1] for r in rows]}]}
    elif data_source == "candidates_by_source":
        from database.models import Candidate
        rows = db.query(Candidate).filter(Candidate.organization_id == org_id).with_entities(Candidate.source, func.count(Candidate.id)).group_by(Candidate.source).order_by(func.count(Candidate.id).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Candidates", "data": [r[1] for r in rows]}]}
    elif data_source == "requisitions_by_department":
        from database.models import JobRequisition
        rows = db.query(JobRequisition).filter(JobRequisition.organization_id == org_id).with_entities(JobRequisition.department, func.count(JobRequisition.id)).group_by(JobRequisition.department).order_by(func.count(JobRequisition.id).desc()).all()
        return {"labels": [r[0] or "Unknown" for r in rows], "datasets": [{"label": "Requisitions", "data": [r[1] for r in rows]}]}
    elif data_source == "requisitions_by_status":
        from database.models import JobRequisition
        rows = db.query(JobRequisition).filter(JobRequisition.organization_id == org_id).with_entities(JobRequisition.status, func.count(JobRequisition.id)).group_by(JobRequisition.status).all()
        return {"labels": [str(r[0].value) if hasattr(r[0], "value") else str(r[0]) for r in rows], "datasets": [{"label": "Requisitions", "data": [r[1] for r in rows]}]}
    elif data_source in ("hires_by_month", "source_effectiveness"):
        rows = (
            db.query(Employee)
            .filter(Employee.organization_id == org_id, Employee.hire_date.isnot(None))
            .with_entities(extract("year", Employee.hire_date).label("yr"), extract("month", Employee.hire_date).label("mo"), func.count(Employee.id).label("cnt"))
            .group_by("yr", "mo").order_by("yr", "mo").all()
        )
        return {"labels": [f"{int(r.yr)}-{int(r.mo):02d}" for r in rows], "datasets": [{"label": "Hires", "data": [r.cnt for r in rows]}]}
    else:
        return {"labels": [], "datasets": [{"label": "Data", "data": []}]}


def _get_table_data(db: Session, org_id, config: Dict[str, Any]) -> Dict[str, Any]:
    data_source = config.get("data_source", "employees")
    dept_filter = config.get("department")
    limit = min(int(config.get("limit", 10)), 100)

    base_q = db.query(Employee).filter(Employee.organization_id == org_id)
    if dept_filter:
        base_q = base_q.filter(Employee.department == dept_filter)

    if data_source == "employees":
        rows = base_q.filter(Employee.status == EmployeeStatus.active).limit(limit).all()
        return {"columns": ["name", "department", "job_title", "location", "salary", "hire_date"], "rows": [
            {"name": f"{e.first_name} {e.last_name}", "department": e.department, "job_title": e.job_title, "location": e.location, "salary": e.salary, "hire_date": str(e.hire_date)}
            for e in rows
        ]}
    elif data_source == "new_hires":
        thirty = date.today() - timedelta(days=30)
        rows = base_q.filter(Employee.hire_date >= thirty).order_by(Employee.hire_date.desc()).limit(limit).all()
        return {"columns": ["name", "department", "job_title", "hire_date"], "rows": [
            {"name": f"{e.first_name} {e.last_name}", "department": e.department, "job_title": e.job_title, "hire_date": str(e.hire_date)}
            for e in rows
        ]}
    elif data_source == "terminations":
        rows = base_q.filter(Employee.status == EmployeeStatus.terminated).order_by(Employee.termination_date.desc()).limit(limit).all()
        return {"columns": ["name", "department", "job_title", "termination_date", "reason"], "rows": [
            {"name": f"{e.first_name} {e.last_name}", "department": e.department, "job_title": e.job_title, "termination_date": str(e.termination_date), "reason": e.termination_reason}
            for e in rows
        ]}
    elif data_source == "flight_risks":
        rows = base_q.filter(Employee.status == EmployeeStatus.active, Employee.flight_risk == "high").order_by(Employee.engagement_score.asc()).limit(limit).all()
        return {"columns": ["name", "department", "job_title", "engagement_score", "tenure"], "rows": [
            {"name": f"{e.first_name} {e.last_name}", "department": e.department, "job_title": e.job_title, "engagement_score": e.engagement_score, "tenure": e.tenure}
            for e in rows
        ]}
    elif data_source == "top_performers":
        rows = base_q.filter(Employee.status == EmployeeStatus.active, Employee.performance_rating.isnot(None)).order_by(Employee.performance_rating.desc()).limit(limit).all()
        return {"columns": ["name", "department", "job_title", "performance_rating", "engagement_score"], "rows": [
            {"name": f"{e.first_name} {e.last_name}", "department": e.department, "job_title": e.job_title, "performance_rating": e.performance_rating, "engagement_score": e.engagement_score}
            for e in rows
        ]}
    elif data_source == "upcoming_anniversaries":
        today = date.today()
        rows = base_q.filter(Employee.status == EmployeeStatus.active, Employee.hire_date.isnot(None)).limit(limit * 5).all()
        ann = sorted(
            [e for e in rows if e.hire_date and (e.hire_date.month == today.month or e.hire_date.month == (today.month % 12) + 1)],
            key=lambda e: (e.hire_date.month, e.hire_date.day)
        )[:limit]
        return {"columns": ["name", "department", "hire_date", "years"], "rows": [
            {"name": f"{e.first_name} {e.last_name}", "department": e.department, "hire_date": str(e.hire_date), "years": round(float(e.tenure or 0))}
            for e in ann
        ]}
    elif data_source == "open_requisitions":
        from database.models import JobRequisition, RequisitionStatus
        rows = db.query(JobRequisition).filter(JobRequisition.organization_id == org_id, JobRequisition.status == RequisitionStatus.open).limit(limit).all()
        return {"columns": ["title", "department", "location", "status"], "rows": [
            {"title": r.title, "department": r.department, "location": r.location, "status": str(r.status.value) if hasattr(r.status, "value") else str(r.status)}
            for r in rows
        ]}
    elif data_source == "candidates_pipeline":
        from database.models import Candidate
        rows = db.query(Candidate).filter(Candidate.organization_id == org_id).limit(limit).all()
        return {"columns": ["name", "department", "status", "source"], "rows": [
            {"name": f"{c.first_name} {c.last_name}", "department": c.department, "status": str(c.status.value) if hasattr(c.status, "value") else str(c.status), "source": c.source}
            for c in rows
        ]}
    else:
        return {"columns": [], "rows": []}


def _get_gauge_data(db: Session, org_id, config: Dict[str, Any]) -> Dict[str, Any]:
    metric = config.get("metric", "engagement")
    dept_filter = config.get("department")

    base_q = db.query(Employee).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active)
    if dept_filter:
        base_q = base_q.filter(Employee.department == dept_filter)

    if metric == "engagement":
        val = base_q.with_entities(func.avg(Employee.engagement_score)).scalar() or 0
        return {"value": round(float(val), 2), "min": 0, "max": 5, "thresholds": {"low": 2, "medium": 3.5, "high": 4.5}, "label": "Engagement Score"}
    elif metric == "performance":
        val = base_q.with_entities(func.avg(Employee.performance_rating)).scalar() or 0
        return {"value": round(float(val), 2), "min": 0, "max": 5, "thresholds": {"low": 2, "medium": 3.5, "high": 4.5}, "label": "Performance Rating"}
    elif metric == "retention_rate":
        all_q = db.query(Employee).filter(Employee.organization_id == org_id)
        if dept_filter:
            all_q = all_q.filter(Employee.department == dept_filter)
        total = all_q.count()
        term = all_q.filter(Employee.status == EmployeeStatus.terminated).count()
        rate = round((1 - term / total) * 100, 1) if total > 0 else 0
        return {"value": rate, "min": 0, "max": 100, "thresholds": {"low": 70, "medium": 85, "high": 95}, "label": "Retention Rate"}
    elif metric == "attendance_rate":
        from database.models import AttendanceRecord, AttendanceStatus
        try:
            total_r = db.query(func.count(AttendanceRecord.id)).filter(AttendanceRecord.organization_id == org_id).scalar() or 0
            present = db.query(func.count(AttendanceRecord.id)).filter(
                AttendanceRecord.organization_id == org_id,
                AttendanceRecord.status.in_([AttendanceStatus.in_office, AttendanceStatus.remote])
            ).scalar() or 0
            rate = round(present / total_r * 100, 1) if total_r > 0 else 0
        except Exception:
            rate = 0
        return {"value": rate, "min": 0, "max": 100, "thresholds": {"low": 70, "medium": 85, "high": 95}, "label": "Attendance Rate"}
    elif metric == "offer_acceptance_rate":
        from database.models import Candidate, CandidateStatus
        offers = db.query(func.count(Candidate.id)).filter(
            Candidate.organization_id == org_id, Candidate.status.in_([CandidateStatus.offer, CandidateStatus.hired])
        ).scalar() or 0
        hired = db.query(func.count(Candidate.id)).filter(
            Candidate.organization_id == org_id, Candidate.status == CandidateStatus.hired
        ).scalar() or 0
        rate = round(hired / offers * 100, 1) if offers > 0 else 0
        return {"value": rate, "min": 0, "max": 100, "thresholds": {"low": 50, "medium": 70, "high": 85}, "label": "Offer Acceptance Rate"}
    elif metric == "diversity_index":
        total = base_q.count()
        groups = dict(base_q.with_entities(Employee.ethnicity, func.count(Employee.id)).group_by(Employee.ethnicity).all())
        index = 1.0 - sum((v / total) ** 2 for v in groups.values()) if total > 0 else 0
        return {"value": round(index * 100, 1), "min": 0, "max": 100, "thresholds": {"low": 30, "medium": 60, "high": 80}, "label": "Diversity Index"}
    elif metric == "goal_attainment":
        from database.models import RecruiterGoal
        year = date.today().year
        totals = db.query(
            func.sum(RecruiterGoal.q1_actual + RecruiterGoal.q2_actual + RecruiterGoal.q3_actual + RecruiterGoal.q4_actual).label("actual"),
            func.sum(RecruiterGoal.q1_goal + RecruiterGoal.q2_goal + RecruiterGoal.q3_goal + RecruiterGoal.q4_goal).label("goal"),
        ).filter(
            RecruiterGoal.organization_id == org_id,
            RecruiterGoal.year == year,
        ).first()
        if totals and totals.goal and totals.goal > 0:
            attainment = round(float(totals.actual or 0) / float(totals.goal) * 100, 1)
        else:
            attainment = 0
        return {"value": attainment, "min": 0, "max": 100, "thresholds": {"low": 50, "medium": 75, "high": 90}, "label": "Recruiting Goal Attainment"}
    elif metric == "eNPS":
        total = base_q.count()
        promoters = base_q.filter(Employee.engagement_score >= 4.5).count()
        detractors = base_q.filter(Employee.engagement_score < 3.0).count()
        enps = round((promoters - detractors) / total * 100, 0) if total > 0 else 0
        return {"value": enps, "min": -100, "max": 100, "thresholds": {"low": -10, "medium": 30, "high": 60}, "label": "eNPS"}
    else:
        return {"value": 0, "min": 0, "max": 100, "thresholds": {"low": 30, "medium": 60, "high": 80}, "label": metric}


@widgets_router.post("/data")
async def get_widget_data(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    widget_type = data.get("widget_type")
    config = data.get("config", {})

    try:
        if widget_type == "metric":
            result = _get_metric_data(db, org_id, config)
        elif widget_type in ("bar", "line", "area", "pie"):
            result = _get_chart_data(db, org_id, config)
        elif widget_type == "table":
            result = _get_table_data(db, org_id, config)
        elif widget_type == "gauge":
            result = _get_gauge_data(db, org_id, config)
        else:
            result = None
        return {"status": "success", "data": result}
    except Exception as e:
        return {"status": "error", "data": None, "error": str(e)}
