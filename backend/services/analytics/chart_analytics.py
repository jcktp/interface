from datetime import date, timedelta
from typing import Dict, Any, List
from uuid import UUID
from sqlalchemy import select, func, or_
from sqlalchemy.orm import Session
from database.models import Employee, Candidate, JobRequisition

class ChartAnalytics:
    def __init__(self, db: Session):
        self.db = db

    def get_data(self, organization_id: UUID, chart_type: str, config: Dict) -> Dict:
        data_source = config.get("data_source", "headcount_by_department")
        org_id = organization_id

        # ---- Headcount ----
        if data_source == "headcount_by_department":
            results = self.db.execute(
                select(Employee.department, func.count(Employee.id).label("count"))
                .where(Employee.organization_id == org_id, Employee.status == "active")
                .group_by(Employee.department)
                .order_by(func.count(Employee.id).desc())
            ).all()
            return {
                "labels": [r.department for r in results],
                "datasets": [{"label": "Headcount", "data": [r.count for r in results]}]
            }

        elif data_source == "headcount_trend":
            labels = []
            data = []
            today = date.today()
            for i in range(11, -1, -1):
                month_date = date(today.year, today.month, 1) - timedelta(days=i * 30)
                month_end = date(month_date.year, month_date.month + 1, 1) if month_date.month < 12 else date(month_date.year + 1, 1, 1)
                count = self.db.execute(
                    select(func.count(Employee.id)).where(
                        Employee.organization_id == org_id,
                        Employee.hire_date < month_end,
                        or_(Employee.termination_date.is_(None), Employee.termination_date >= month_end)
                    )
                ).scalar() or 0
                labels.append(month_date.strftime("%b %Y"))
                data.append(count)
            return {
                "labels": labels,
                "datasets": [{"label": "Headcount", "data": data}]
            }

        # ---- Compensation ----
        elif data_source == "salary_by_department":
            results = self.db.execute(
                select(Employee.department, func.avg(Employee.salary).label("avg_salary"))
                .where(Employee.organization_id == org_id, Employee.status == "active")
                .group_by(Employee.department)
                .order_by(func.avg(Employee.salary).desc())
            ).all()
            return {
                "labels": [r.department for r in results],
                "datasets": [{"label": "Avg Salary", "data": [round(r.avg_salary or 0, 0) for r in results]}]
            }

        # ---- Recruitment ----
        elif data_source == "candidates_by_status":
            results = self.db.execute(
                select(Candidate.status, func.count(Candidate.id).label("count"))
                .where(Candidate.organization_id == org_id)
                .group_by(Candidate.status)
            ).all()
            return {
                "labels": [str(r.status) for r in results],
                "datasets": [{"label": "Candidates", "data": [r.count for r in results]}]
            }

        # Fallback
        return {"labels": [], "datasets": []}
