from datetime import date, timedelta
from typing import Dict, Any
from uuid import UUID
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from database.models import Employee, AttendanceRecord

class GaugeAnalytics:
    def __init__(self, db: Session):
        self.db = db

    def get_data(self, organization_id: UUID, config: Dict) -> Dict:
        metric = config.get("metric", "engagement")
        thresholds = config.get("thresholds", {"low": 50, "medium": 70, "high": 90})
        org_id = organization_id

        if metric == "engagement":
            value = self.db.execute(
                select(func.avg(Employee.engagement_score)).where(
                    Employee.organization_id == org_id, Employee.status == "active"
                )
            ).scalar() or 0
            return {"value": round(value, 1), "min": 0, "max": 100, "thresholds": thresholds, "label": "Engagement Score"}

        elif metric == "performance":
            value = self.db.execute(
                select(func.avg(Employee.performance_rating)).where(
                    Employee.organization_id == org_id, Employee.status == "active"
                )
            ).scalar() or 0
            return {"value": round(value, 1), "min": 0, "max": 5, "thresholds": {"low": 2, "medium": 3.5, "high": 4.5}, "label": "Avg Performance"}

        # Fallback
        return {"value": 0, "min": 0, "max": 100, "thresholds": thresholds}
