"""Risk Detection Service for 2Model.

Rules-based detection engine that queries real employee/metrics data
from PostgreSQL to identify organizational risks and create alerts.
"""

from datetime import datetime, timedelta, date
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case, and_

from database.models import (
    Employee, EmployeeStatus, OrgHealthAlert, AlertSeverity, AlertStatus,
    KPITarget, KPIDefinition, AttendanceRecord, JobRequisition,
    RequisitionStatus,
)


class RiskDetectionService:
    """Detects organizational risks by analyzing real employee data."""

    # Default thresholds (used when no KPITarget is set)
    DEFAULT_THRESHOLDS = {
        "attrition_rate": {"critical": 25.0, "warning": 18.0, "info": 12.0},
        "engagement_score": {"critical": 2.5, "warning": 3.0, "info": 3.3},
        "performance_avg": {"critical": 2.0, "warning": 2.5, "info": 3.0},
        "time_to_fill": {"critical": 90, "warning": 60, "info": 45},
        "offer_acceptance_rate": {"critical": 50, "warning": 65, "info": 75},
        "concentration_risk": {"critical": 50.0, "warning": 40.0, "info": 35.0},
    }

    def __init__(self, db: Session):
        self.db = db

    # ==================== Public API ====================

    def run_detection(self, org_id: UUID) -> List[OrgHealthAlert]:
        """Run all detection rules and create/update alerts.

        Executes every risk-detection rule against the current state of
        the organization's data and persists any newly created alerts.

        Returns:
            List of newly created OrgHealthAlert objects.
        """
        new_alerts: List[OrgHealthAlert] = []

        new_alerts.extend(self._detect_attrition_risk(org_id))
        new_alerts.extend(self._detect_engagement_risk(org_id))
        new_alerts.extend(self._detect_performance_risk(org_id))
        new_alerts.extend(self._detect_hiring_bottleneck(org_id))
        new_alerts.extend(self._detect_concentration_risk(org_id))

        self.db.commit()
        return new_alerts

    def get_active_alerts(
        self, org_id: UUID, limit: int = 20
    ) -> List[OrgHealthAlert]:
        """Get active alerts for an organization, ordered by severity."""
        severity_order = case(
            (OrgHealthAlert.severity == AlertSeverity.critical, 1),
            (OrgHealthAlert.severity == AlertSeverity.warning, 2),
            (OrgHealthAlert.severity == AlertSeverity.info, 3),
            else_=4,
        )
        return (
            self.db.query(OrgHealthAlert)
            .filter(
                OrgHealthAlert.organization_id == org_id,
                OrgHealthAlert.status.in_(
                    [AlertStatus.active, AlertStatus.acknowledged]
                ),
            )
            .order_by(severity_order, OrgHealthAlert.created_at.desc())
            .limit(limit)
            .all()
        )

    def acknowledge_alert(
        self, alert_id: UUID, user_id: UUID
    ) -> OrgHealthAlert:
        """Mark an alert as acknowledged by a specific user."""
        alert = (
            self.db.query(OrgHealthAlert)
            .filter(OrgHealthAlert.id == alert_id)
            .first()
        )
        if not alert:
            raise ValueError(f"Alert not found: {alert_id}")
        alert.status = AlertStatus.acknowledged
        alert.acknowledged_by = user_id
        alert.acknowledged_at = datetime.utcnow()
        alert.updated_at = datetime.utcnow()
        self.db.commit()
        return alert

    def resolve_alert(
        self, alert_id: UUID, user_id: UUID, notes: Optional[str] = None
    ) -> OrgHealthAlert:
        """Mark an alert as resolved by a specific user."""
        alert = (
            self.db.query(OrgHealthAlert)
            .filter(OrgHealthAlert.id == alert_id)
            .first()
        )
        if not alert:
            raise ValueError(f"Alert not found: {alert_id}")
        alert.status = AlertStatus.resolved
        alert.resolved_by = user_id
        alert.resolved_at = datetime.utcnow()
        alert.updated_at = datetime.utcnow()
        if notes:
            alert.resolution_notes = notes
        self.db.commit()
        return alert

    def dismiss_alert(
        self, alert_id: UUID, user_id: UUID
    ) -> OrgHealthAlert:
        """Dismiss an alert so it no longer appears in active lists."""
        alert = (
            self.db.query(OrgHealthAlert)
            .filter(OrgHealthAlert.id == alert_id)
            .first()
        )
        if not alert:
            raise ValueError(f"Alert not found: {alert_id}")
        alert.status = AlertStatus.dismissed
        alert.acknowledged_by = user_id
        alert.updated_at = datetime.utcnow()
        self.db.commit()
        return alert

    # ==================== Threshold Helpers ====================

    def _get_threshold(
        self, org_id: UUID, metric_name: str, severity: AlertSeverity
    ) -> float:
        """Return the threshold for a metric at a given severity level.

        Checks KPITarget (linked via KPIDefinition.metric_key) first.
        Falls back to DEFAULT_THRESHOLDS when no target is configured.
        """
        kpi_target = (
            self.db.query(KPITarget)
            .join(KPIDefinition, KPITarget.kpi_definition_id == KPIDefinition.id)
            .filter(
                KPITarget.organization_id == org_id,
                KPIDefinition.metric_key == metric_name,
                KPITarget.status == "active",
            )
            .order_by(KPITarget.created_at.desc())
            .first()
        )

        if kpi_target:
            if severity == AlertSeverity.critical and kpi_target.critical_threshold is not None:
                return kpi_target.critical_threshold
            if severity == AlertSeverity.warning and kpi_target.warning_threshold is not None:
                return kpi_target.warning_threshold
            if severity == AlertSeverity.info and kpi_target.target_value is not None:
                return kpi_target.target_value

        # Fall back to hard-coded defaults
        defaults = self.DEFAULT_THRESHOLDS.get(metric_name, {})
        return defaults.get(severity.value, 0.0)

    def _determine_severity(
        self,
        org_id: UUID,
        metric_name: str,
        value: float,
        higher_is_worse: bool = True,
    ) -> Optional[AlertSeverity]:
        """Determine alert severity by comparing *value* against thresholds.

        Args:
            org_id: Organization to look up KPITarget overrides for.
            metric_name: Key into DEFAULT_THRESHOLDS / KPIDefinition.metric_key.
            value: The measured metric value.
            higher_is_worse: If True, value >= threshold triggers the alert
                (e.g. attrition rate). If False, value <= threshold triggers
                (e.g. engagement score).

        Returns:
            The highest applicable AlertSeverity, or None if no threshold
            is breached.
        """
        for sev in (AlertSeverity.critical, AlertSeverity.warning, AlertSeverity.info):
            threshold = self._get_threshold(org_id, metric_name, sev)
            if threshold is None or threshold == 0.0:
                continue
            if higher_is_worse and value >= threshold:
                return sev
            if not higher_is_worse and value <= threshold:
                return sev
        return None

    def _has_active_alert(
        self, org_id: UUID, alert_type: str, affected_unit: Optional[str] = None
    ) -> bool:
        """Check whether an active or acknowledged alert already exists."""
        query = self.db.query(OrgHealthAlert).filter(
            OrgHealthAlert.organization_id == org_id,
            OrgHealthAlert.alert_type == alert_type,
            OrgHealthAlert.status.in_(
                [AlertStatus.active, AlertStatus.acknowledged]
            ),
        )
        if affected_unit is not None:
            query = query.filter(
                OrgHealthAlert.affected_org_unit == affected_unit
            )
        return query.first() is not None

    def _create_alert(
        self,
        org_id: UUID,
        alert_type: str,
        severity: AlertSeverity,
        title: str,
        description: str,
        metric_name: str,
        metric_value: float,
        threshold_value: float,
        affected_unit: Optional[str] = None,
        affected_unit_type: Optional[str] = None,
        trend_direction: Optional[str] = None,
        trend_period_days: Optional[int] = None,
        contributing_factors: Optional[Dict[str, Any]] = None,
        recommendations: Optional[List[str]] = None,
    ) -> OrgHealthAlert:
        """Build, persist, and return a new OrgHealthAlert."""
        alert = OrgHealthAlert(
            id=uuid4(),
            organization_id=org_id,
            alert_type=alert_type,
            severity=severity,
            status=AlertStatus.active,
            title=title,
            description=description,
            affected_org_unit=affected_unit,
            affected_org_unit_type=affected_unit_type,
            metric_name=metric_name,
            metric_value=metric_value,
            threshold_value=threshold_value,
            trend_direction=trend_direction,
            trend_period_days=trend_period_days,
            contributing_factors=contributing_factors,
            recommendations=recommendations,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        self.db.add(alert)
        return alert

    # ==================== Detection Rules ====================

    def _detect_attrition_risk(self, org_id: UUID) -> List[OrgHealthAlert]:
        """Detect elevated attrition rates across the organization.

        Calculates attrition as the percentage of employees terminated
        within the last 90 days relative to total active headcount.
        Creates department-level alerts when a department's rate breaches
        a threshold, plus an org-wide alert if the overall rate is high.
        """
        new_alerts: List[OrgHealthAlert] = []
        lookback = date.today() - timedelta(days=90)

        # --- Org-wide attrition ---
        active_count = (
            self.db.query(func.count(Employee.id))
            .filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.active,
            )
            .scalar()
        ) or 0

        terminated_count = (
            self.db.query(func.count(Employee.id))
            .filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.terminated,
                Employee.termination_date >= lookback,
            )
            .scalar()
        ) or 0

        if active_count + terminated_count == 0:
            return new_alerts

        org_attrition_rate = (
            terminated_count / (active_count + terminated_count)
        ) * 100.0

        org_severity = self._determine_severity(
            org_id, "attrition_rate", org_attrition_rate, higher_is_worse=True
        )

        # --- Per-department breakdown ---
        dept_stats = (
            self.db.query(
                Employee.department,
                func.count(Employee.id).label("total"),
                func.count(
                    case(
                        (
                            and_(
                                Employee.status == EmployeeStatus.terminated,
                                Employee.termination_date >= lookback,
                            ),
                            Employee.id,
                        ),
                    )
                ).label("terminated"),
            )
            .filter(Employee.organization_id == org_id)
            .group_by(Employee.department)
            .all()
        )

        department_breakdown: Dict[str, Dict[str, Any]] = {}
        flagged_departments: List[str] = []

        for dept_name, total, term in dept_stats:
            if total == 0:
                continue
            dept_rate = (term / total) * 100.0
            department_breakdown[dept_name] = {
                "total_employees": total,
                "terminated_last_90d": term,
                "attrition_rate_pct": round(dept_rate, 2),
            }

            dept_severity = self._determine_severity(
                org_id, "attrition_rate", dept_rate, higher_is_worse=True
            )
            if dept_severity is not None:
                flagged_departments.append(dept_name)
                if not self._has_active_alert(org_id, "attrition_risk", dept_name):
                    threshold = self._get_threshold(org_id, "attrition_rate", dept_severity)
                    new_alerts.append(
                        self._create_alert(
                            org_id=org_id,
                            alert_type="attrition_risk",
                            severity=dept_severity,
                            title=f"Elevated attrition in {dept_name}",
                            description=(
                                f"{dept_name} has an annualized attrition rate of "
                                f"{dept_rate:.1f}% over the last 90 days "
                                f"({term} of {total} employees terminated). "
                                f"This exceeds the {dept_severity.value} threshold of "
                                f"{threshold:.1f}%."
                            ),
                            metric_name="attrition_rate",
                            metric_value=round(dept_rate, 2),
                            threshold_value=threshold,
                            affected_unit=dept_name,
                            affected_unit_type="department",
                            trend_direction="declining",
                            trend_period_days=90,
                            contributing_factors={
                                "department": dept_name,
                                "active_employees": total - term,
                                "terminated_last_90d": term,
                                "attrition_rate_pct": round(dept_rate, 2),
                            },
                            recommendations=[
                                f"Conduct exit-interview analysis for {dept_name} departures",
                                f"Review compensation competitiveness in {dept_name}",
                                "Schedule stay interviews with tenured employees",
                                "Assess manager effectiveness and team morale",
                            ],
                        )
                    )

        # Org-wide alert
        if org_severity is not None and not self._has_active_alert(
            org_id, "attrition_risk", "__organization__"
        ):
            threshold = self._get_threshold(org_id, "attrition_rate", org_severity)
            new_alerts.append(
                self._create_alert(
                    org_id=org_id,
                    alert_type="attrition_risk",
                    severity=org_severity,
                    title="Organization-wide attrition rate elevated",
                    description=(
                        f"Overall attrition rate is {org_attrition_rate:.1f}% "
                        f"over the last 90 days ({terminated_count} terminations "
                        f"out of {active_count + terminated_count} employees). "
                        f"Departments most affected: "
                        f"{', '.join(flagged_departments) or 'N/A'}."
                    ),
                    metric_name="attrition_rate",
                    metric_value=round(org_attrition_rate, 2),
                    threshold_value=threshold,
                    affected_unit="__organization__",
                    affected_unit_type="organization",
                    trend_direction="declining",
                    trend_period_days=90,
                    contributing_factors={
                        "active_employees": active_count,
                        "terminated_last_90d": terminated_count,
                        "attrition_rate_pct": round(org_attrition_rate, 2),
                        "flagged_departments": flagged_departments,
                        "department_breakdown": department_breakdown,
                    },
                    recommendations=[
                        "Launch an organization-wide engagement survey",
                        "Benchmark total compensation against market rates",
                        "Review career-development and internal-mobility programs",
                        "Investigate common termination reasons for systemic issues",
                    ],
                )
            )

        return new_alerts

    def _detect_engagement_risk(self, org_id: UUID) -> List[OrgHealthAlert]:
        """Detect low engagement scores across departments.

        Queries the average ``engagement_score`` of active employees per
        department and flags any that fall below the configured thresholds.
        """
        new_alerts: List[OrgHealthAlert] = []

        dept_engagement = (
            self.db.query(
                Employee.department,
                func.avg(Employee.engagement_score).label("avg_engagement"),
                func.count(Employee.id).label("employee_count"),
                func.count(
                    case(
                        (Employee.engagement_score <= 2.5, Employee.id),
                    )
                ).label("low_engagement_count"),
            )
            .filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.active,
                Employee.engagement_score.isnot(None),
            )
            .group_by(Employee.department)
            .all()
        )

        for dept_name, avg_eng, emp_count, low_count in dept_engagement:
            if avg_eng is None:
                continue

            avg_eng_float = float(avg_eng)
            severity = self._determine_severity(
                org_id, "engagement_score", avg_eng_float, higher_is_worse=False
            )
            if severity is None:
                continue

            if self._has_active_alert(org_id, "engagement_risk", dept_name):
                continue

            threshold = self._get_threshold(org_id, "engagement_score", severity)
            low_pct = (low_count / emp_count * 100.0) if emp_count > 0 else 0.0

            new_alerts.append(
                self._create_alert(
                    org_id=org_id,
                    alert_type="engagement_risk",
                    severity=severity,
                    title=f"Low engagement in {dept_name}",
                    description=(
                        f"Average engagement score in {dept_name} is "
                        f"{avg_eng_float:.2f} (threshold: {threshold:.2f}). "
                        f"{low_count} of {emp_count} employees "
                        f"({low_pct:.0f}%) have critically low scores."
                    ),
                    metric_name="engagement_score",
                    metric_value=round(avg_eng_float, 2),
                    threshold_value=threshold,
                    affected_unit=dept_name,
                    affected_unit_type="department",
                    trend_direction=None,
                    contributing_factors={
                        "department": dept_name,
                        "average_engagement": round(avg_eng_float, 2),
                        "employee_count": emp_count,
                        "low_engagement_count": low_count,
                        "low_engagement_pct": round(low_pct, 1),
                    },
                    recommendations=[
                        f"Schedule 1-on-1 check-ins with the {low_count} low-scoring employees",
                        f"Run a focused pulse survey in {dept_name}",
                        "Review workload distribution and work-life balance indicators",
                        "Assess management practices and communication effectiveness",
                        "Consider team-building or recognition initiatives",
                    ],
                )
            )

        return new_alerts

    def _detect_performance_risk(self, org_id: UUID) -> List[OrgHealthAlert]:
        """Detect departments with low average performance ratings.

        Queries active employees' ``performance_rating`` by department
        and creates alerts for departments whose averages breach the
        configured thresholds.
        """
        new_alerts: List[OrgHealthAlert] = []

        dept_performance = (
            self.db.query(
                Employee.department,
                func.avg(Employee.performance_rating).label("avg_performance"),
                func.count(Employee.id).label("employee_count"),
                func.count(
                    case(
                        (Employee.performance_rating <= 2.0, Employee.id),
                    )
                ).label("underperformer_count"),
                func.count(
                    case(
                        (Employee.performance_rating >= 4.0, Employee.id),
                    )
                ).label("high_performer_count"),
            )
            .filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.active,
                Employee.performance_rating.isnot(None),
            )
            .group_by(Employee.department)
            .all()
        )

        for (
            dept_name,
            avg_perf,
            emp_count,
            underperformer_count,
            high_performer_count,
        ) in dept_performance:
            if avg_perf is None:
                continue

            avg_perf_float = float(avg_perf)
            severity = self._determine_severity(
                org_id, "performance_avg", avg_perf_float, higher_is_worse=False
            )
            if severity is None:
                continue

            if self._has_active_alert(org_id, "performance_risk", dept_name):
                continue

            threshold = self._get_threshold(org_id, "performance_avg", severity)
            underperformer_pct = (
                (underperformer_count / emp_count * 100.0) if emp_count > 0 else 0.0
            )

            new_alerts.append(
                self._create_alert(
                    org_id=org_id,
                    alert_type="performance_risk",
                    severity=severity,
                    title=f"Low performance average in {dept_name}",
                    description=(
                        f"Average performance rating in {dept_name} is "
                        f"{avg_perf_float:.2f} (threshold: {threshold:.2f}). "
                        f"{underperformer_count} of {emp_count} employees "
                        f"({underperformer_pct:.0f}%) are rated at or below 2.0."
                    ),
                    metric_name="performance_avg",
                    metric_value=round(avg_perf_float, 2),
                    threshold_value=threshold,
                    affected_unit=dept_name,
                    affected_unit_type="department",
                    trend_direction=None,
                    contributing_factors={
                        "department": dept_name,
                        "average_performance": round(avg_perf_float, 2),
                        "employee_count": emp_count,
                        "underperformer_count": underperformer_count,
                        "underperformer_pct": round(underperformer_pct, 1),
                        "high_performer_count": high_performer_count,
                    },
                    recommendations=[
                        f"Review performance management processes in {dept_name}",
                        "Create individual performance improvement plans for underperformers",
                        "Evaluate whether role expectations and goals are clearly defined",
                        "Assess training and development opportunities",
                        "Consider whether manager calibration sessions are needed",
                    ],
                )
            )

        return new_alerts

    def _detect_hiring_bottleneck(self, org_id: UUID) -> List[OrgHealthAlert]:
        """Detect open requisitions that have been unfilled for too long.

        Queries ``JobRequisition`` records with status 'open' and
        calculates how many days each has been open. Creates per-
        department alerts when the average days-open exceeds thresholds,
        as well as individual alerts for critically overdue requisitions.
        """
        new_alerts: List[OrgHealthAlert] = []
        today = date.today()

        open_reqs = (
            self.db.query(JobRequisition)
            .filter(
                JobRequisition.organization_id == org_id,
                JobRequisition.status == RequisitionStatus.open,
                JobRequisition.open_date.isnot(None),
            )
            .all()
        )

        if not open_reqs:
            return new_alerts

        # Group by department
        dept_reqs: Dict[str, List[Dict[str, Any]]] = {}
        for req in open_reqs:
            days_open = (today - req.open_date).days
            dept = req.department or "Unknown"
            dept_reqs.setdefault(dept, []).append(
                {
                    "requisition_id": str(req.id),
                    "title": req.title,
                    "days_open": days_open,
                    "urgency": req.urgency,
                    "headcount": req.headcount or 1,
                    "applicant_count": req.applicant_count or 0,
                }
            )

        for dept_name, reqs in dept_reqs.items():
            avg_days = sum(r["days_open"] for r in reqs) / len(reqs)
            max_days = max(r["days_open"] for r in reqs)
            total_headcount_needed = sum(r["headcount"] for r in reqs)

            severity = self._determine_severity(
                org_id, "time_to_fill", avg_days, higher_is_worse=True
            )
            if severity is None:
                continue

            if self._has_active_alert(org_id, "hiring_bottleneck", dept_name):
                continue

            threshold = self._get_threshold(org_id, "time_to_fill", severity)

            # Sort requisitions by days open descending for the report
            reqs_sorted = sorted(reqs, key=lambda r: r["days_open"], reverse=True)
            overdue_reqs = [r for r in reqs_sorted if r["days_open"] >= threshold]

            new_alerts.append(
                self._create_alert(
                    org_id=org_id,
                    alert_type="hiring_bottleneck",
                    severity=severity,
                    title=f"Hiring bottleneck in {dept_name}",
                    description=(
                        f"{len(reqs)} open requisition(s) in {dept_name} with an "
                        f"average of {avg_days:.0f} days open (longest: {max_days} days). "
                        f"{total_headcount_needed} total positions to fill. "
                        f"Threshold: {threshold:.0f} days."
                    ),
                    metric_name="time_to_fill",
                    metric_value=round(avg_days, 1),
                    threshold_value=threshold,
                    affected_unit=dept_name,
                    affected_unit_type="department",
                    trend_direction="declining" if avg_days > threshold * 1.2 else "stable",
                    trend_period_days=90,
                    contributing_factors={
                        "department": dept_name,
                        "open_requisition_count": len(reqs),
                        "total_headcount_needed": total_headcount_needed,
                        "avg_days_open": round(avg_days, 1),
                        "max_days_open": max_days,
                        "overdue_requisitions": overdue_reqs[:10],
                    },
                    recommendations=[
                        "Review sourcing channels and expand candidate pipeline",
                        f"Assess whether job descriptions for {dept_name} roles are competitive",
                        "Consider engaging external recruiting agencies for critical roles",
                        "Evaluate interview process for unnecessary delays or bottlenecks",
                        "Check if compensation ranges are aligned with market rates",
                    ],
                )
            )

        return new_alerts

    def _detect_concentration_risk(self, org_id: UUID) -> List[OrgHealthAlert]:
        """Detect if any single department holds a disproportionate share of headcount.

        Flags departments that contain more than the configured percentage
        (default 40%) of total active headcount, indicating organizational
        fragility if that unit experiences disruption.
        """
        new_alerts: List[OrgHealthAlert] = []

        total_active = (
            self.db.query(func.count(Employee.id))
            .filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.active,
            )
            .scalar()
        ) or 0

        if total_active == 0:
            return new_alerts

        dept_counts = (
            self.db.query(
                Employee.department,
                func.count(Employee.id).label("dept_count"),
            )
            .filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.active,
            )
            .group_by(Employee.department)
            .all()
        )

        for dept_name, dept_count in dept_counts:
            concentration_pct = (dept_count / total_active) * 100.0

            severity = self._determine_severity(
                org_id,
                "concentration_risk",
                concentration_pct,
                higher_is_worse=True,
            )
            if severity is None:
                continue

            if self._has_active_alert(org_id, "concentration_risk", dept_name):
                continue

            threshold = self._get_threshold(org_id, "concentration_risk", severity)

            new_alerts.append(
                self._create_alert(
                    org_id=org_id,
                    alert_type="concentration_risk",
                    severity=severity,
                    title=f"Headcount concentration risk in {dept_name}",
                    description=(
                        f"{dept_name} accounts for {concentration_pct:.1f}% of "
                        f"total active headcount ({dept_count} of {total_active} "
                        f"employees). This exceeds the {severity.value} threshold "
                        f"of {threshold:.0f}% and represents a single-point-of-failure risk."
                    ),
                    metric_name="concentration_risk",
                    metric_value=round(concentration_pct, 2),
                    threshold_value=threshold,
                    affected_unit=dept_name,
                    affected_unit_type="department",
                    trend_direction=None,
                    contributing_factors={
                        "department": dept_name,
                        "department_headcount": dept_count,
                        "total_headcount": total_active,
                        "concentration_pct": round(concentration_pct, 2),
                        "all_departments": {
                            d: {
                                "count": c,
                                "pct": round(c / total_active * 100.0, 2),
                            }
                            for d, c in dept_counts
                        },
                    },
                    recommendations=[
                        f"Evaluate whether {dept_name} responsibilities can be distributed",
                        "Create cross-training and knowledge-sharing programs",
                        "Develop succession plans for key roles in the department",
                        "Consider organizational restructuring to reduce concentration",
                        "Ensure business-continuity plans account for department-level disruption",
                    ],
                )
            )

        return new_alerts
