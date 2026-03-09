"""Command Center Service for 2Model.

Aggregates live data from PostgreSQL to provide organizational health
summaries, trends, and unit-level analysis.
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case, and_, distinct
from utils.filters import apply_global_filters

from database.models import (
    Employee, EmployeeStatus, JobRequisition, RequisitionStatus,
    OrgHealthAlert, AlertStatus, AlertSeverity,
    AttendanceRecord, AttendanceStatus,
)


class CommandCenterService:
    """Provides organizational health data from real database records."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Health Summary ====================

    def get_health_summary(
        self, 
        org_id: UUID,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get comprehensive org health summary with 6 key metrics."""

        def _emp_q():
            q = self.db.query(Employee).filter(Employee.organization_id == org_id)
            q = apply_global_filters(q, Employee, departments=departments, locations=locations, start_date=start_date, end_date=end_date)
            return q

        active_count = _emp_q().filter(Employee.status == EmployeeStatus.active).count()

        # Calculate attrition rate (respecting filters)
        twelve_months_ago = date.today() - timedelta(days=365)
        attrition_q = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.terminated,
        )
        attrition_q = apply_global_filters(attrition_q, Employee, departments=departments, locations=locations)
        
        if start_date:
            attrition_q = attrition_q.filter(Employee.termination_date >= start_date)
        else:
            attrition_q = attrition_q.filter(Employee.termination_date >= twelve_months_ago)
            
        if end_date:
            attrition_q = attrition_q.filter(Employee.termination_date <= end_date)
            
        terminated_count = attrition_q.count()

        total_for_attrition = active_count + terminated_count
        attrition_rate = (
            (terminated_count / total_for_attrition * 100)
            if total_for_attrition > 0
            else 0
        )

        # Average engagement score (filtered)
        avg_engagement = _emp_q().filter(
            Employee.status == EmployeeStatus.active,
            Employee.engagement_score.isnot(None),
        ).with_entities(func.avg(Employee.engagement_score)).scalar() or 0

        # Open requisitions (filtered)
        req_q = self.db.query(JobRequisition).filter(JobRequisition.organization_id == org_id)
        req_q = apply_global_filters(req_q, JobRequisition, departments=departments, locations=locations, start_date=start_date, end_date=end_date)
        open_reqs = req_q.filter(JobRequisition.status == RequisitionStatus.open).count()

        # Average performance (filtered)
        avg_performance = _emp_q().filter(
            Employee.status == EmployeeStatus.active,
            Employee.performance_rating.isnot(None),
        ).with_entities(func.avg(Employee.performance_rating)).scalar() or 0

        # Attendance rate (respecting filters)
        att_q = self.db.query(AttendanceRecord).filter(AttendanceRecord.organization_id == org_id)
        if start_date or end_date:
            att_q = apply_global_filters(att_q, AttendanceRecord, start_date=start_date, end_date=end_date)
        else:
            thirty_days_ago = date.today() - timedelta(days=30)
            att_q = att_q.filter(AttendanceRecord.record_date >= thirty_days_ago)
            
        if departments or locations:
            att_q = att_q.join(Employee, AttendanceRecord.employee_id == Employee.id)
            att_q = apply_global_filters(att_q, Employee, departments=departments, locations=locations)

        total_attendance = att_q.count()
        present_attendance = att_q.filter(
            AttendanceRecord.status.in_([
                AttendanceStatus.in_office,
                AttendanceStatus.remote,
            ]),
        ).count()

        attendance_rate = (
            (present_attendance / total_attendance * 100)
            if total_attendance > 0
            else 0
        )

        # Active alerts count (filtered by affected unit if applicable)
        alert_q = self.db.query(OrgHealthAlert).filter(
            OrgHealthAlert.organization_id == org_id,
            OrgHealthAlert.status.in_([
                AlertStatus.active,
                AlertStatus.acknowledged,
            ]),
        )
        if departments:
            dept_list = [d.strip() for d in departments.split(',')]
            alert_q = alert_q.filter(OrgHealthAlert.affected_org_unit.in_(dept_list))
            
        active_alerts = alert_q.count()

        return {
            "headcount": active_count,
            "attrition_rate": round(attrition_rate, 1),
            "avg_engagement": round(float(avg_engagement), 2),
            "open_requisitions": open_reqs,
            "avg_performance": round(float(avg_performance), 2),
            "attendance_rate": round(attendance_rate, 1),
            "active_alerts": active_alerts,
            "as_of": datetime.utcnow().isoformat(),
        }

    # ==================== Health Trends ====================

    def get_health_trends(
        self, org_id: UUID, months: int = 6
    ) -> List[Dict[str, Any]]:
        """Get monthly health metric trends for sparklines.

        Walks backwards ``months`` calendar months and returns one entry
        per month containing headcount, attrition rate, and raw
        termination count.
        """
        trends: List[Dict[str, Any]] = []
        today = date.today()

        for i in range(months - 1, -1, -1):
            # Calculate month boundaries
            # Subtract roughly i months by stepping back in 30-day
            # increments, then snap to the first of that month.
            ref = date(today.year, today.month, 1) - timedelta(days=i * 30)
            month_start = date(ref.year, ref.month, 1)

            if month_start.month == 12:
                month_end = date(month_start.year + 1, 1, 1) - timedelta(days=1)
            else:
                month_end = date(
                    month_start.year, month_start.month + 1, 1
                ) - timedelta(days=1)

            # Active headcount at end of month: hired on or before
            # month_end AND either still active or terminated after
            # month_end.
            headcount = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == org_id,
                Employee.hire_date <= month_end,
                (Employee.termination_date.is_(None))
                | (Employee.termination_date > month_end),
            ).scalar() or 0

            # Terminations that occurred within this month
            terminations = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.terminated,
                Employee.termination_date >= month_start,
                Employee.termination_date <= month_end,
            ).scalar() or 0

            # Pro-rate current (partial) month so attrition is comparable
            is_current_month = (month_start.year == today.year and month_start.month == today.month)
            if is_current_month and today.day > 0:
                days_in_month = (month_end - month_start).days + 1
                days_elapsed = max(today.day, 1)
                scale = days_in_month / days_elapsed
                effective_terminations = terminations * scale
            else:
                effective_terminations = terminations

            attrition = (
                (effective_terminations / headcount * 100) if headcount > 0 else 0
            )

            trends.append({
                "month": month_start.strftime("%Y-%m"),
                "headcount": headcount,
                "attrition_rate": round(attrition, 1),
                "terminations": terminations,
            })

        return trends

    # ==================== Org-Unit Health ====================

    def get_org_unit_health(
        self,
        org_id: UUID,
        unit_type: str = "department",
        unit_value: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get health metrics broken down by org unit (department or location).

        When ``unit_value`` is provided the result list contains at most
        one element for that specific unit; otherwise every unit within
        the organization is returned.
        """
        # Determine grouping column
        group_col = (
            Employee.department
            if unit_type == "department"
            else Employee.location
        )

        query = self.db.query(
            group_col.label("unit"),
            func.count(Employee.id).label("headcount"),
            func.avg(Employee.engagement_score).label("avg_engagement"),
            func.avg(Employee.performance_rating).label("avg_performance"),
            func.avg(Employee.salary).label("avg_salary"),
        ).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        )

        if unit_value:
            query = query.filter(group_col == unit_value)

        results = query.group_by(group_col).all()

        units: List[Dict[str, Any]] = []
        for row in results:
            units.append({
                "unit": row.unit or "Unknown",
                "headcount": row.headcount,
                "avg_engagement": round(float(row.avg_engagement or 0), 2),
                "avg_performance": round(float(row.avg_performance or 0), 2),
                "avg_salary": round(float(row.avg_salary or 0), 0),
            })

        return sorted(units, key=lambda x: x["headcount"], reverse=True)

    # ==================== Department Summary ====================

    def get_department_summary(self, org_id: UUID) -> List[Dict[str, Any]]:
        """Get summary stats per department for the command center grid.

        Returns total employees (all statuses), active count, average
        engagement, and average performance for each department.
        """
        departments = self.db.query(
            Employee.department,
            func.count(Employee.id).label("total"),
            func.count(
                case(
                    (Employee.status == EmployeeStatus.active, 1),
                )
            ).label("active"),
            func.avg(Employee.engagement_score).label("engagement"),
            func.avg(Employee.performance_rating).label("performance"),
        ).filter(
            Employee.organization_id == org_id,
        ).group_by(Employee.department).all()

        return [
            {
                "department": dept.department or "Unknown",
                "total": dept.total,
                "active": dept.active,
                "engagement": round(float(dept.engagement or 0), 2),
                "performance": round(float(dept.performance or 0), 2),
            }
            for dept in departments
        ]

    # ==================== Alert Retrieval ====================

    def get_active_alerts(
        self,
        org_id: UUID,
        severity: Optional[AlertSeverity] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """Return the most recent active/acknowledged alerts.

        Optionally filter by severity.  Results are ordered newest first
        and capped at ``limit``.
        """
        query = self.db.query(OrgHealthAlert).filter(
            OrgHealthAlert.organization_id == org_id,
            OrgHealthAlert.status.in_([
                AlertStatus.active,
                AlertStatus.acknowledged,
            ]),
        )

        if severity is not None:
            query = query.filter(OrgHealthAlert.severity == severity)

        alerts = (
            query
            .order_by(OrgHealthAlert.created_at.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "id": str(alert.id),
                "alert_type": alert.alert_type,
                "severity": alert.severity.value if alert.severity else None,
                "status": alert.status.value if alert.status else None,
                "title": alert.title,
                "description": alert.description,
                "affected_org_unit": alert.affected_org_unit,
                "affected_org_unit_type": alert.affected_org_unit_type,
                "metric_name": alert.metric_name,
                "metric_value": alert.metric_value,
                "threshold_value": alert.threshold_value,
                "trend_direction": alert.trend_direction,
                "contributing_factors": alert.contributing_factors,
                "recommendations": alert.recommendations,
                "created_at": (
                    alert.created_at.isoformat() if alert.created_at else None
                ),
            }
            for alert in alerts
        ]

    # ==================== Hiring Pipeline Summary ====================

    def get_hiring_pipeline(self, org_id: UUID) -> Dict[str, Any]:
        """Return a snapshot of the current hiring pipeline.

        Provides counts of open, on-hold, filled, and closed
        requisitions as well as the average number of days a requisition
        has been open (for those still open).
        """
        status_counts = self.db.query(
            JobRequisition.status,
            func.count(JobRequisition.id).label("count"),
        ).filter(
            JobRequisition.organization_id == org_id,
        ).group_by(JobRequisition.status).all()

        pipeline: Dict[str, int] = {
            "open": 0,
            "on_hold": 0,
            "filled": 0,
            "closed": 0,
        }
        for row in status_counts:
            key = row.status.value if row.status else "unknown"
            if key in pipeline:
                pipeline[key] = row.count

        # Average days open for currently open requisitions
        if self.db.bind.dialect.name == 'sqlite':
            avg_days_open_result = self.db.query(
                func.avg(func.julianday(func.current_date()) - func.julianday(JobRequisition.open_date))
            ).filter(
                JobRequisition.organization_id == org_id,
                JobRequisition.status == RequisitionStatus.open,
                JobRequisition.open_date.isnot(None),
            ).scalar()
        else:
            avg_days_open_result = self.db.query(
                func.avg(func.current_date() - JobRequisition.open_date)
            ).filter(
                JobRequisition.organization_id == org_id,
                JobRequisition.status == RequisitionStatus.open,
                JobRequisition.open_date.isnot(None),
            ).scalar()
            if avg_days_open_result and hasattr(avg_days_open_result, 'days'):
                avg_days_open_result = avg_days_open_result.days

        # Fallback: compute in Python if the DB function is unavailable
        if avg_days_open_result is None:
            open_reqs = self.db.query(JobRequisition.open_date).filter(
                JobRequisition.organization_id == org_id,
                JobRequisition.status == RequisitionStatus.open,
                JobRequisition.open_date.isnot(None),
            ).all()
            if open_reqs:
                total_days = sum(
                    (date.today() - req.open_date).days for req in open_reqs
                )
                avg_days_open = total_days / len(open_reqs)
            else:
                avg_days_open = 0
        else:
            avg_days_open = float(avg_days_open_result)

        return {
            **pipeline,
            "total": sum(pipeline.values()),
            "avg_days_open": round(avg_days_open, 1),
        }

    # ==================== Workforce Composition ====================

    def get_workforce_composition(self, org_id: UUID) -> Dict[str, Any]:
        """Return workforce breakdown by status, work type, and tenure bands.

        Useful for the command center's composition donut charts.
        """

        # --- By status ---
        status_counts = self.db.query(
            Employee.status,
            func.count(Employee.id).label("count"),
        ).filter(
            Employee.organization_id == org_id,
        ).group_by(Employee.status).all()

        by_status = {
            row.status.value: row.count for row in status_counts
        }

        # --- By work type (remote / hybrid / onsite) ---
        work_type_counts = self.db.query(
            Employee.work_type,
            func.count(Employee.id).label("count"),
        ).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        ).group_by(Employee.work_type).all()

        by_work_type = {
            (row.work_type or "unknown"): row.count
            for row in work_type_counts
        }

        # --- Tenure bands - OPTIMIZED: Aggregated via SQL ---
        today_val = date.today()
        
        if self.db.bind.dialect.name == 'sqlite':
            day_diff_expr = func.julianday(today_val) - func.julianday(Employee.hire_date)
        else:
            # PostgreSQL: subtraction returns integer days directly for Dates
            day_diff_expr = func.date_part('day', today_val - Employee.hire_date)
            # or just today_val - Employee.hire_date depending on SQLAlchemy version/types
            # For simplicity and broad support:
            day_diff_expr = today_val - Employee.hire_date

        tenure_stats = self.db.query(
            case(
                (day_diff_expr / 365.25 < 1, '<1yr'),
                (day_diff_expr / 365.25 < 3, '1-3yr'),
                (day_diff_expr / 365.25 < 5, '3-5yr'),
                (day_diff_expr / 365.25 < 10, '5-10yr'),
                else_='10+yr'
            ).label('band'),
            func.count(Employee.id)
        ).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
            Employee.hire_date.isnot(None)
        ).group_by('band').all()

        tenure_bands = {
            "<1yr": 0,
            "1-3yr": 0,
            "3-5yr": 0,
            "5-10yr": 0,
            "10+yr": 0,
        }
        for band, count in tenure_stats:
            if band in tenure_bands:
                tenure_bands[band] = count

        return {
            "by_status": by_status,
            "by_work_type": by_work_type,
            "tenure_bands": tenure_bands,
        }

    # ==================== Attendance Overview ====================

    def get_attendance_overview(
        self, org_id: UUID, days: int = 30
    ) -> Dict[str, Any]:
        """Return attendance breakdown for the last N days.

        Provides counts and rates for each ``AttendanceStatus`` value
        plus a day-by-day series.
        """
        since = date.today() - timedelta(days=days)

        # Overall counts by status
        status_breakdown = self.db.query(
            AttendanceRecord.status,
            func.count(AttendanceRecord.id).label("count"),
        ).filter(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.record_date >= since,
        ).group_by(AttendanceRecord.status).all()

        total_records = sum(row.count for row in status_breakdown)
        breakdown = {}
        for row in status_breakdown:
            key = row.status.value if row.status else "unknown"
            breakdown[key] = {
                "count": row.count,
                "pct": (
                    round(row.count / total_records * 100, 1)
                    if total_records > 0
                    else 0
                ),
            }

        # Daily series (for sparkline / trend chart)
        daily_rows = self.db.query(
            AttendanceRecord.record_date,
            func.count(AttendanceRecord.id).label("total"),
            func.count(
                case(
                    (AttendanceRecord.status.in_([
                        AttendanceStatus.in_office,
                        AttendanceStatus.remote,
                    ]), 1),
                )
            ).label("present"),
        ).filter(
            AttendanceRecord.organization_id == org_id,
            AttendanceRecord.record_date >= since,
        ).group_by(
            AttendanceRecord.record_date,
        ).order_by(
            AttendanceRecord.record_date,
        ).all()

        daily_series = [
            {
                "date": row.record_date.isoformat(),
                "total": row.total,
                "present": row.present,
                "rate": (
                    round(row.present / row.total * 100, 1)
                    if row.total > 0
                    else 0
                ),
            }
            for row in daily_rows
        ]

        present_count = sum(
            row.count
            for row in status_breakdown
            if row.status in (AttendanceStatus.in_office, AttendanceStatus.remote)
        )
        overall_rate = (
            round(present_count / total_records * 100, 1)
            if total_records > 0
            else 0
        )

        return {
            "period_days": days,
            "total_records": total_records,
            "overall_rate": overall_rate,
            "breakdown": breakdown,
            "daily_series": daily_series,
        }

    # ==================== Flight Risk Summary ====================

    def get_flight_risk_summary(self, org_id: UUID) -> Dict[str, Any]:
        """Return a summary of flight-risk levels across active employees.

        Groups employees by their ``flight_risk`` field (low / medium /
        high) and also lists departments with the most high-risk
        employees.
        """
        risk_counts = self.db.query(
            Employee.flight_risk,
            func.count(Employee.id).label("count"),
        ).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        ).group_by(Employee.flight_risk).all()

        by_risk = {
            (row.flight_risk or "unscored"): row.count
            for row in risk_counts
        }

        # Departments with the most high-risk employees
        high_risk_depts = self.db.query(
            Employee.department,
            func.count(Employee.id).label("high_risk_count"),
        ).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
            Employee.flight_risk == "high",
        ).group_by(Employee.department).order_by(
            func.count(Employee.id).desc()
        ).limit(10).all()

        departments_at_risk = [
            {
                "department": row.department or "Unknown",
                "high_risk_count": row.high_risk_count,
            }
            for row in high_risk_depts
        ]

        return {
            "by_risk_level": by_risk,
            "total_high_risk": by_risk.get("high", 0),
            "departments_at_risk": departments_at_risk,
        }

    # ==================== Comprehensive Command Center Payload ====================

    def get_command_center_data(self, org_id: UUID) -> Dict[str, Any]:
        """Aggregate all command-center widgets into a single response.

        This is the primary entry point for the front-end command center
        page.  It calls every sub-method and merges their outputs so the
        UI can hydrate all widgets from one API call.
        """
        return {
            "health_summary": self.get_health_summary(org_id),
            "health_trends": self.get_health_trends(org_id, months=6),
            "department_summary": self.get_department_summary(org_id),
            "hiring_pipeline": self.get_hiring_pipeline(org_id),
            "workforce_composition": self.get_workforce_composition(org_id),
            "attendance_overview": self.get_attendance_overview(org_id, days=30),
            "flight_risk_summary": self.get_flight_risk_summary(org_id),
            "active_alerts": self.get_active_alerts(org_id, limit=10),
        }
