from datetime import date, timedelta, datetime
from typing import Dict, Any, Optional
from uuid import UUID
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from database.models import Employee, JobRequisition, AttendanceRecord

class MetricAnalytics:
    def __init__(self, db: Session):
        self.db = db

    def get_data(self, organization_id: UUID, config: Dict) -> Dict:
        metric = config.get("metric", "headcount")
        org_id = organization_id

        # Helper: count active employees
        def _active_count(**extra_filters):
            q = select(func.count(Employee.id)).where(
                Employee.organization_id == org_id,
                Employee.status == "active"
            )
            for col, val in extra_filters.items():
                q = q.where(getattr(Employee, col) == val)
            return self.db.execute(q).scalar() or 0

        # Helper: count all employees
        def _total_count():
            return self.db.execute(
                select(func.count(Employee.id)).where(Employee.organization_id == org_id)
            ).scalar() or 0

        # ---- Workforce ----
        if metric == "headcount":
            return {"value": _active_count(), "label": "Total Headcount", "format": "number"}
        elif metric == "active_employees":
            return {"value": _active_count(), "label": "Active Employees", "format": "number"}
        elif metric == "new_hires":
            thirty_days_ago = date.today() - timedelta(days=30)
            count = self.db.execute(
                select(func.count(Employee.id)).where(
                    Employee.organization_id == org_id,
                    Employee.hire_date >= thirty_days_ago,
                    Employee.status == "active"
                )
            ).scalar() or 0
            return {"value": count, "label": "New Hires (30d)", "format": "number"}
        elif metric == "avg_tenure":
            value = self.db.execute(
                select(func.avg(Employee.tenure)).where(
                    Employee.organization_id == org_id,
                    Employee.status == "active"
                )
            ).scalar() or 0
            return {"value": round(value, 1), "label": "Avg Tenure (Years)", "format": "decimal"}
        elif metric == "remote_percentage":
            active = _active_count()
            remote = self.db.execute(
                select(func.count(Employee.id)).where(
                    Employee.organization_id == org_id,
                    Employee.status == "active",
                    Employee.work_type == "remote"
                )
            ).scalar() or 0
            pct = round((remote / active * 100), 1) if active > 0 else 0
            return {"value": pct, "label": "Remote Work %", "format": "percentage", "suffix": "%"}

        # ---- Retention & Attrition ----
        elif metric == "turnover_rate":
            last_year = datetime.utcnow() - timedelta(days=365)
            terminated = self.db.execute(
                select(func.count(Employee.id)).where(
                    Employee.organization_id == org_id,
                    Employee.status == "terminated",
                    Employee.termination_date >= last_year.date()
                )
            ).scalar() or 0
            total = _total_count()
            rate = (terminated / total * 100) if total > 0 else 0
            return {"value": round(rate, 1), "label": "Turnover Rate", "format": "percentage", "suffix": "%"}

        # ---- Recruitment ----
        elif metric == "open_positions":
            value = self.db.execute(
                select(func.sum(JobRequisition.headcount)).where(
                    JobRequisition.organization_id == org_id,
                    JobRequisition.status == "open"
                )
            ).scalar() or 0
            return {"value": value, "label": "Open Positions", "format": "number"}

        # ---- Compensation ----
        elif metric == "avg_salary":
            value = self.db.execute(
                select(func.avg(Employee.salary)).where(
                    Employee.organization_id == org_id,
                    Employee.status == "active"
                )
            ).scalar() or 0
            return {"value": round(value, 0), "label": "Avg Salary", "format": "currency", "prefix": "$"}

        # ---- Engagement & Performance ----
        elif metric == "engagement":
            value = self.db.execute(
                select(func.avg(Employee.engagement_score)).where(
                    Employee.organization_id == org_id,
                    Employee.status == "active"
                )
            ).scalar() or 0
            return {"value": round(value, 1), "label": "Engagement Score", "format": "decimal"}
        elif metric == "performance":
            value = self.db.execute(
                select(func.avg(Employee.performance_rating)).where(
                    Employee.organization_id == org_id,
                    Employee.status == "active"
                )
            ).scalar() or 0
            return {"value": round(value, 1), "label": "Performance Rating", "format": "decimal"}

        # Fallback for unknown metrics
        return {"value": 0, "label": metric, "note": "Metric implementation pending"}
