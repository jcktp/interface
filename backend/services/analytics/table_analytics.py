from datetime import date, timedelta
from typing import Dict, Any, List
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.orm import Session
from database.models import Employee, Candidate, JobRequisition

class TableAnalytics:
    def __init__(self, db: Session):
        self.db = db

    def get_data(self, organization_id: UUID, config: Dict) -> Dict:
        data_source = config.get("data_source", "employees")
        columns = config.get("columns", ["name", "department", "job_title"])
        limit = config.get("limit", 10)
        org_id = organization_id

        # ---- People ----
        if data_source == "employees":
            results = self.db.execute(
                select(Employee)
                .where(Employee.organization_id == org_id, Employee.status == "active")
                .limit(limit)
            ).scalars().all()
            return {
                "columns": columns,
                "rows": [
                    {
                        "name": f"{e.first_name} {e.last_name}",
                        "department": e.department,
                        "job_title": e.job_title,
                        "location": e.location,
                        "hire_date": e.hire_date.isoformat() if e.hire_date else None
                    }
                    for e in results
                ]
            }

        elif data_source == "top_performers":
            results = self.db.execute(
                select(Employee)
                .where(Employee.organization_id == org_id, Employee.status == "active", Employee.performance_rating.isnot(None))
                .order_by(Employee.performance_rating.desc())
                .limit(limit)
            ).scalars().all()
            return {
                "columns": ["name", "department", "job_title", "performance_rating"],
                "rows": [
                    {
                        "name": f"{e.first_name} {e.last_name}",
                        "department": e.department,
                        "job_title": e.job_title,
                        "performance_rating": e.performance_rating
                    }
                    for e in results
                ]
            }

        # ---- Recruitment ----
        elif data_source == "open_requisitions":
            results = self.db.execute(
                select(JobRequisition)
                .where(JobRequisition.organization_id == org_id, JobRequisition.status == "open")
                .order_by(JobRequisition.open_date.desc())
                .limit(limit)
            ).scalars().all()
            return {
                "columns": ["title", "department", "location", "open_date"],
                "rows": [
                    {
                        "title": r.title,
                        "department": r.department,
                        "location": r.location,
                        "open_date": r.open_date.isoformat() if r.open_date else None
                    }
                    for r in results
                ]
            }

        return {"columns": [], "rows": []}
