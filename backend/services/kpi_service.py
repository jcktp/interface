"""KPI Service for 2Model.

Manages KPI definitions, targets with approval workflow,
and measurements calculated from real employee data.
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from database.models import (
    KPIDefinition, KPITarget, KPIMeasurement,
    Employee, EmployeeStatus, AttendanceRecord, AttendanceStatus,
    JobRequisition, RequisitionStatus,
)


# System KPI definitions that get seeded for new orgs
SYSTEM_KPIS = [
    {"name": "Turnover Rate", "category": "retention", "calculation_method": "terminated_12m / (active + terminated_12m) * 100", "unit": "percentage", "description": "Annual voluntary and involuntary turnover rate"},
    {"name": "Retention Rate", "category": "retention", "calculation_method": "retained_12m / active_12m_ago * 100", "unit": "percentage", "description": "Percentage of employees retained over 12 months"},
    {"name": "Average Engagement", "category": "engagement", "calculation_method": "avg(engagement_score)", "unit": "score", "description": "Average employee engagement score (1-5 scale)"},
    {"name": "Average Performance", "category": "performance", "calculation_method": "avg(performance_rating)", "unit": "score", "description": "Average performance rating (1-5 scale)"},
    {"name": "Headcount", "category": "workforce", "calculation_method": "count(active_employees)", "unit": "number", "description": "Total active employee headcount"},
    {"name": "Time to Fill", "category": "hiring", "calculation_method": "avg(close_date - open_date)", "unit": "days", "description": "Average days to fill open requisitions"},
    {"name": "Open Requisitions", "category": "hiring", "calculation_method": "count(open_requisitions)", "unit": "number", "description": "Number of currently open job requisitions"},
    {"name": "Attendance Rate", "category": "attendance", "calculation_method": "present_days / total_days * 100", "unit": "percentage", "description": "Percentage of days employees are present (in-office or remote)"},
]


class KPIService:
    """Manages KPI definitions, targets, and measurements."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Definitions ====================

    def get_definitions(self, org_id: UUID, category: Optional[str] = None) -> List[KPIDefinition]:
        query = self.db.query(KPIDefinition).filter(
            KPIDefinition.organization_id == org_id,
            KPIDefinition.is_active == True,
        )
        if category:
            query = query.filter(KPIDefinition.category == category)
        return query.order_by(KPIDefinition.category, KPIDefinition.name).all()

    def create_definition(self, org_id: UUID, user_id: UUID, data: Dict[str, Any]) -> KPIDefinition:
        import re
        metric_key = data.get("metric_key") or re.sub(r'[^a-z0-9]+', '_', data["name"].lower()).strip('_')
        defn = KPIDefinition(
            id=uuid4(),
            organization_id=org_id,
            name=data["name"],
            description=data.get("description", ""),
            category=data.get("category", "custom"),
            metric_key=metric_key,
            calculation_method=data.get("calculation_method", "manual"),
            unit=data.get("unit", "number"),
            display_format=data.get("display_format", ""),
            higher_is_better=data.get("higher_is_better", True),
            is_system=False,
            is_active=True,
            created_by=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(defn)
        self.db.commit()
        return defn

    def seed_system_kpis(self, org_id: UUID, user_id: UUID) -> List[KPIDefinition]:
        """Seed system KPIs for a new organization."""
        created = []
        for kpi_data in SYSTEM_KPIS:
            existing = self.db.query(KPIDefinition).filter(
                KPIDefinition.organization_id == org_id,
                KPIDefinition.name == kpi_data["name"],
                KPIDefinition.is_system == True,
            ).first()
            if not existing:
                defn = KPIDefinition(
                    id=uuid4(),
                    organization_id=org_id,
                    name=kpi_data["name"],
                    description=kpi_data["description"],
                    category=kpi_data["category"],
                    calculation_method=kpi_data["calculation_method"],
                    unit=kpi_data["unit"],
                    is_system=True,
                    is_active=True,
                    created_by=user_id,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                self.db.add(defn)
                created.append(defn)
        self.db.commit()
        return created

    # ==================== Targets ====================

    def get_targets(self, org_id: UUID, kpi_id: Optional[UUID] = None, status: Optional[str] = None) -> List[KPITarget]:
        query = self.db.query(KPITarget).filter(KPITarget.organization_id == org_id)
        if kpi_id:
            query = query.filter(KPITarget.kpi_definition_id == kpi_id)
        if status:
            query = query.filter(KPITarget.status == status)
        return query.order_by(KPITarget.created_at.desc()).all()

    def create_target(self, org_id: UUID, user_id: UUID, data: Dict[str, Any]) -> KPITarget:
        target = KPITarget(
            id=uuid4(),
            kpi_definition_id=UUID(data["kpi_definition_id"]),
            organization_id=org_id,
            target_value=data["target_value"],
            effective_from=data.get("period_start"),
            effective_to=data.get("period_end"),
            status="draft",
            org_unit=data.get("department"),
            change_reason=data.get("notes"),
            previous_version_id=UUID(data["previous_version_id"]) if data.get("previous_version_id") else None,
            proposed_by=user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(target)
        self.db.commit()
        return target

    def update_target(self, target_id: UUID, org_id: UUID, data: Dict[str, Any]) -> KPITarget:
        target = self.db.query(KPITarget).filter(
            KPITarget.id == target_id,
            KPITarget.organization_id == org_id,
        ).first()
        if not target:
            raise ValueError("Target not found")
        # Allow editing all targets (including active/system targets)
        field_map = {
            "target_value": "target_value",
            "period_start": "effective_from",
            "period_end": "effective_to",
            "department": "org_unit",
            "notes": "change_reason",
            "status": "status",
        }
        for api_key, model_key in field_map.items():
            if api_key in data:
                setattr(target, model_key, data[api_key])
        target.updated_at = datetime.utcnow()
        self.db.commit()
        return target

    def approve_target(self, target_id: UUID, org_id: UUID, user_id: UUID) -> KPITarget:
        target = self.db.query(KPITarget).filter(
            KPITarget.id == target_id, KPITarget.organization_id == org_id,
        ).first()
        if not target:
            raise ValueError("Target not found")
        if target.status not in ("draft", "pending_approval"):
            raise ValueError(f"Cannot approve target in '{target.status}' status")
        # Deactivate previous active targets for same KPI+org_unit
        self.db.query(KPITarget).filter(
            KPITarget.kpi_definition_id == target.kpi_definition_id,
            KPITarget.organization_id == org_id,
            KPITarget.org_unit == target.org_unit,
            KPITarget.status == "active",
        ).update({"status": "expired", "updated_at": datetime.utcnow()})
        target.status = "active"
        target.approved_by = user_id
        target.approved_at = datetime.utcnow()
        target.updated_at = datetime.utcnow()
        self.db.commit()
        return target

    def reject_target(self, target_id: UUID, org_id: UUID, user_id: UUID, reason: str = "") -> KPITarget:
        target = self.db.query(KPITarget).filter(
            KPITarget.id == target_id, KPITarget.organization_id == org_id,
        ).first()
        if not target:
            raise ValueError("Target not found")
        target.status = "rejected"
        target.change_reason = (target.change_reason or "") + f"\nRejected: {reason}" if reason else target.change_reason
        target.updated_at = datetime.utcnow()
        self.db.commit()
        return target

    def get_target_history(self, target_id: UUID, org_id: UUID) -> List[KPITarget]:
        """Get version history for a target by following previous_version_id chain."""
        history = []
        current = self.db.query(KPITarget).filter(
            KPITarget.id == target_id, KPITarget.organization_id == org_id,
        ).first()
        while current:
            history.append(current)
            if current.previous_version_id:
                current = self.db.query(KPITarget).filter(KPITarget.id == current.previous_version_id).first()
            else:
                break
        return history

    # ==================== Measurements ====================

    def get_measurements(self, org_id: UUID, kpi_id: UUID, limit: int = 12) -> List[KPIMeasurement]:
        return (
            self.db.query(KPIMeasurement)
            .filter(KPIMeasurement.organization_id == org_id, KPIMeasurement.kpi_definition_id == kpi_id)
            .order_by(KPIMeasurement.measurement_date.desc())
            .limit(limit)
            .all()
        )

    def calculate_measurements(self, org_id: UUID) -> List[KPIMeasurement]:
        """Calculate current values for all system KPIs from real data."""
        definitions = self.db.query(KPIDefinition).filter(
            KPIDefinition.organization_id == org_id,
            KPIDefinition.is_system == True,
            KPIDefinition.is_active == True,
        ).all()

        today = date.today()
        period_start = date(today.year, today.month, 1)
        period_end = today
        measurements = []

        for defn in definitions:
            value = self._calculate_kpi_value(org_id, defn.name, period_start, period_end)
            if value is not None:
                # Get previous measurement for variance
                prev = (
                    self.db.query(KPIMeasurement)
                    .filter(
                        KPIMeasurement.kpi_definition_id == defn.id,
                        KPIMeasurement.organization_id == org_id,
                    )
                    .order_by(KPIMeasurement.measurement_date.desc())
                    .first()
                )
                prev_value = prev.measured_value if prev else None
                variance = (value - prev_value) if prev_value is not None else None

                measurement = KPIMeasurement(
                    id=uuid4(),
                    kpi_definition_id=defn.id,
                    organization_id=org_id,
                    measurement_date=period_end,
                    period_type="monthly",
                    measured_value=round(value, 2),
                    variance=round(variance, 2) if variance is not None else None,
                    data_source="calculated",
                    created_at=datetime.utcnow(),
                )
                self.db.add(measurement)
                measurements.append(measurement)

        self.db.commit()
        return measurements

    def _calculate_kpi_value(self, org_id: UUID, kpi_name: str, period_start: date, period_end: date) -> Optional[float]:
        """Calculate a system KPI value from real database data."""
        if kpi_name == "Headcount":
            return float(self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == org_id, Employee.status == EmployeeStatus.active,
            ).scalar() or 0)

        if kpi_name == "Turnover Rate":
            active = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == org_id, Employee.status == EmployeeStatus.active,
            ).scalar() or 0
            twelve_months_ago = period_end - timedelta(days=365)
            terminated = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == org_id, Employee.status == EmployeeStatus.terminated,
                Employee.termination_date >= twelve_months_ago,
            ).scalar() or 0
            total = active + terminated
            return (terminated / total * 100) if total > 0 else 0.0

        if kpi_name == "Retention Rate":
            active = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == org_id, Employee.status == EmployeeStatus.active,
            ).scalar() or 0
            twelve_months_ago = period_end - timedelta(days=365)
            terminated = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == org_id, Employee.status == EmployeeStatus.terminated,
                Employee.termination_date >= twelve_months_ago,
            ).scalar() or 0
            total = active + terminated
            return ((active / total) * 100) if total > 0 else 100.0

        if kpi_name == "Average Engagement":
            return float(self.db.query(func.avg(Employee.engagement_score)).filter(
                Employee.organization_id == org_id, Employee.status == EmployeeStatus.active,
                Employee.engagement_score.isnot(None),
            ).scalar() or 0)

        if kpi_name == "Average Performance":
            return float(self.db.query(func.avg(Employee.performance_rating)).filter(
                Employee.organization_id == org_id, Employee.status == EmployeeStatus.active,
                Employee.performance_rating.isnot(None),
            ).scalar() or 0)

        if kpi_name == "Open Requisitions":
            return float(self.db.query(func.count(JobRequisition.id)).filter(
                JobRequisition.organization_id == org_id, JobRequisition.status == RequisitionStatus.open,
            ).scalar() or 0)

        if kpi_name == "Attendance Rate":
            thirty_days_ago = period_end - timedelta(days=30)
            total = self.db.query(func.count(AttendanceRecord.id)).filter(
                AttendanceRecord.organization_id == org_id, AttendanceRecord.record_date >= thirty_days_ago,
            ).scalar() or 0
            present = self.db.query(func.count(AttendanceRecord.id)).filter(
                AttendanceRecord.organization_id == org_id, AttendanceRecord.record_date >= thirty_days_ago,
                AttendanceRecord.status.in_([AttendanceStatus.in_office, AttendanceStatus.remote]),
            ).scalar() or 0
            return (present / total * 100) if total > 0 else 0.0

        return None

    # ==================== Dashboard ====================

    def get_dashboard(self, org_id: UUID) -> List[Dict[str, Any]]:
        """Get KPI dashboard with current values and org-level targets."""
        definitions = self.get_definitions(org_id)
        dashboard_items = []

        for defn in definitions:
            # Get latest two measurements for current + previous
            recent = (
                self.db.query(KPIMeasurement)
                .filter(KPIMeasurement.kpi_definition_id == defn.id, KPIMeasurement.organization_id == org_id)
                .order_by(KPIMeasurement.measurement_date.desc())
                .limit(2)
                .all()
            )
            latest = recent[0] if len(recent) > 0 else None
            previous = recent[1] if len(recent) > 1 else None
            # Get org-wide active target (org_unit is NULL)
            target = (
                self.db.query(KPITarget)
                .filter(
                    KPITarget.kpi_definition_id == defn.id,
                    KPITarget.organization_id == org_id,
                    KPITarget.status == "active",
                    KPITarget.org_unit == None,  # noqa: E711
                )
                .first()
            )

            # Get 12-month trend
            trend_measurements = (
                self.db.query(KPIMeasurement)
                .filter(KPIMeasurement.kpi_definition_id == defn.id, KPIMeasurement.organization_id == org_id)
                .order_by(KPIMeasurement.measurement_date.asc())
                .limit(13)
                .all()
            )
            trend = [
                {"date": str(m.measurement_date), "value": m.measured_value}
                for m in trend_measurements
            ]

            dashboard_items.append({
                "kpi_id": str(defn.id),
                "name": defn.name,
                "category": defn.category,
                "unit": defn.unit,
                "description": defn.description,
                "current_value": latest.measured_value if latest else None,
                "previous_value": previous.measured_value if previous else None,
                "variance": latest.variance if latest else None,
                "target_value": target.target_value if target else None,
                "target_status": target.status if target else None,
                "last_updated": latest.created_at.isoformat() if latest else None,
                "is_system": defn.is_system,
                "trend": trend,
            })

        return dashboard_items

    def get_targets_by_level(self, org_id: UUID) -> Dict[str, Any]:
        """Get targets grouped by level: org, department, team, employee."""
        definitions = self.get_definitions(org_id)
        def_map = {str(d.id): d for d in definitions}

        all_targets = (
            self.db.query(KPITarget)
            .filter(KPITarget.organization_id == org_id, KPITarget.status == "active")
            .all()
        )

        org_targets = []
        dept_targets: Dict[str, list] = {}
        team_targets: Dict[str, list] = {}
        employee_targets: Dict[str, list] = {}

        for t in all_targets:
            defn = def_map.get(str(t.kpi_definition_id))
            entry = {
                "id": str(t.id),
                "kpi_id": str(t.kpi_definition_id),
                "kpi_name": defn.name if defn else "Unknown",
                "kpi_category": defn.category if defn else "custom",
                "kpi_unit": defn.unit if defn else "number",
                "target_value": t.target_value,
                "org_unit": t.org_unit,
                "org_unit_type": t.org_unit_type,
                "status": t.status,
            }
            if t.org_unit_type is None:
                org_targets.append(entry)
            elif t.org_unit_type == "department":
                dept_targets.setdefault(t.org_unit, []).append(entry)
            elif t.org_unit_type == "team":
                team_targets.setdefault(t.org_unit, []).append(entry)
            elif t.org_unit_type == "employee":
                employee_targets.setdefault(t.org_unit, []).append(entry)

        return {
            "org": org_targets,
            "departments": dept_targets,
            "teams": team_targets,
            "employees": employee_targets,
        }
