"""Attendance Service for 2Model.

Manages attendance records, targets, compliance reporting,
and bulk import functionality.
"""

from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from uuid import UUID, uuid4

from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, and_, case, literal
from utils.filters import apply_global_filters

from database.models import (
    AttendanceRecord, AttendanceStatus, AttendanceTarget,
    Employee, EmployeeStatus,
)


class AttendanceService:
    """Manages attendance tracking and compliance."""

    def __init__(self, db: Session):
        self.db = db

    def get_summary(
        self, 
        org_id: UUID, 
        days: int = 30,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get attendance summary for the period."""
        
        # Build base filter
        base_q = self.db.query(AttendanceRecord).filter(AttendanceRecord.organization_id == org_id)
        
        if start_date or end_date:
            base_q = apply_global_filters(base_q, AttendanceRecord, start_date=start_date, end_date=end_date)
        else:
            since = date.today() - timedelta(days=days)
            base_q = base_q.filter(AttendanceRecord.record_date >= since)
            
        # Join with employees for department/location filtering
        if departments or locations:
            base_q = base_q.join(Employee, AttendanceRecord.employee_id == Employee.id)
            base_q = apply_global_filters(base_q, Employee, departments=departments, locations=locations)

        total = base_q.with_entities(func.count(AttendanceRecord.id)).scalar() or 0

        counts = base_q.with_entities(
            AttendanceRecord.status,
            func.count(AttendanceRecord.id),
        ).group_by(AttendanceRecord.status).all()

        by_status = {}
        for status_key, count in counts:
            # Handle potential string or enum keys
            key_name = status_key.value if hasattr(status_key, 'value') else str(status_key)
            by_status[key_name] = count

        in_office = by_status.get("in_office", 0)
        remote = by_status.get("remote", 0)
        absent = by_status.get("absent", 0)
        leave = by_status.get("leave", 0)
        holiday = by_status.get("holiday", 0)
        present = in_office + remote
        
        # Calculate standard rate
        attendance_rate = (present / (total - holiday) * 100) if (total - holiday) > 0 else 0
        
        # Percentage of presence that was in office (as requested by user)
        office_attendance_pct = (in_office / present * 100) if present > 0 else 0

        # Get unique employees with records
        unique_employees = base_q.with_entities(func.count(func.distinct(AttendanceRecord.employee_id))).scalar() or 0

        return {
            "period_days": days,
            "total_records": total,
            "unique_employees": unique_employees,
            "in_office": in_office,
            "remote": remote,
            "absent": absent,
            "on_leave": leave,
            "holiday": holiday,
            "attendance_rate": round(attendance_rate, 1),
            "office_attendance_pct": round(office_attendance_pct, 1),
            "in_office_rate": round((in_office / total * 100) if total > 0 else 0, 1),
            "remote_rate": round((remote / total * 100) if total > 0 else 0, 1),
            "as_of": datetime.utcnow().isoformat(),
        }

    def get_trends(
        self, 
        org_id: UUID, 
        period: str = "weekly", 
        months: int = 3,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get attendance trends over time."""
        
        if period == "daily":
            group_expr = AttendanceRecord.record_date
        else:
            # Weekly: truncate to week
            group_expr = func.date_trunc('week', AttendanceRecord.record_date)

        query = self.db.query(
            group_expr.label("period"),
            func.count(AttendanceRecord.id).label("total"),
            func.count(case((AttendanceRecord.status.in_([
                AttendanceStatus.in_office, AttendanceStatus.remote, 'in_office', 'remote'
            ]), 1))).label("present"),
            func.count(case((AttendanceRecord.status.in_([AttendanceStatus.in_office, 'in_office']), 1))).label("in_office"),
            func.count(case((AttendanceRecord.status.in_([AttendanceStatus.remote, 'remote']), 1))).label("remote_count"),
        ).filter(AttendanceRecord.organization_id == org_id)
        
        # Apply filters
        if start_date or end_date:
            query = apply_global_filters(query, AttendanceRecord, start_date=start_date, end_date=end_date)
        else:
            since = date.today() - timedelta(days=months * 30)
            query = query.filter(AttendanceRecord.record_date >= since)
            
        if departments or locations:
            query = query.join(Employee, AttendanceRecord.employee_id == Employee.id)
            query = apply_global_filters(query, Employee, departments=departments, locations=locations)

        results = query.group_by("period").order_by("period").all()

        return [
            {
                "period": row.period.isoformat() if hasattr(row.period, 'isoformat') else str(row.period),
                "total": row.total,
                "present": row.present,
                "in_office": row.in_office,
                "remote": row.remote_count,
                "attendance_rate": round((row.present / row.total * 100) if row.total > 0 else 0, 1),
                "in_office_rate": round((row.in_office / row.total * 100) if row.total > 0 else 0, 1),
                "remote_rate": round((row.remote_count / row.total * 100) if row.total > 0 else 0, 1),
            }
            for row in results
        ]

    def get_targets(self, org_id: UUID) -> List[AttendanceTarget]:
        return (
            self.db.query(AttendanceTarget)
            .filter(AttendanceTarget.organization_id == org_id)
            .order_by(AttendanceTarget.org_unit)
            .all()
        )

    def create_target(self, org_id: UUID, user_id: UUID, data: Dict[str, Any]) -> AttendanceTarget:
        target = AttendanceTarget(
            id=uuid4(),
            organization_id=org_id,
            org_unit=data.get("org_unit", data.get("department", "All")),
            org_unit_type=data.get("org_unit_type", "department"),
            target_days_per_week=data.get("target_days_per_week", 3),
            target_pct=data.get("target_pct", data.get("min_attendance_rate", 80.0)),
            effective_from=data.get("effective_from"),
            effective_to=data.get("effective_to"),
            created_by=user_id,
        )
        self.db.add(target)
        self.db.commit()
        return target

    def update_target(self, target_id: UUID, org_id: UUID, data: Dict[str, Any]) -> AttendanceTarget:
        target = self.db.query(AttendanceTarget).filter(
            AttendanceTarget.id == target_id, AttendanceTarget.organization_id == org_id,
        ).first()
        if not target:
            raise ValueError("Target not found")
        for key in ["target_days_per_week", "target_pct", "org_unit", "org_unit_type", "effective_from", "effective_to"]:
            if key in data:
                setattr(target, key, data[key])
        target.updated_at = datetime.utcnow()
        self.db.commit()
        return target

    def get_compliance_report(self, org_id: UUID) -> Dict[str, Any]:
        """Compare actual attendance against targets by department. Returns policy_metrics + report."""
        targets = self.get_targets(org_id)
        thirty_days_ago = date.today() - timedelta(days=30)

        report = []
        for target in targets:
            dept_filter = [
                AttendanceRecord.organization_id == org_id,
                AttendanceRecord.record_date >= thirty_days_ago,
            ]
            if target.org_unit and target.org_unit != "All":
                dept_filter.append(Employee.department == target.org_unit)

            stats = (
                self.db.query(
                    func.count(AttendanceRecord.id).label("total"),
                    func.count(case((AttendanceRecord.status.in_([AttendanceStatus.in_office, AttendanceStatus.remote]), 1))).label("present"),
                    func.count(case((AttendanceRecord.status == AttendanceStatus.in_office, 1))).label("in_office"),
                )
                .join(Employee, AttendanceRecord.employee_id == Employee.id)
                .filter(*dept_filter)
                .first()
            )

            target_rate = target.target_pct or 80.0
            actual_rate = (stats.present / stats.total * 100) if stats and stats.total > 0 else 0
            compliant = actual_rate >= target_rate

            report.append({
                "department": target.org_unit or "Organization-wide",
                "target_rate": target_rate,
                "target_days": target.target_days_per_week,
                "actual_rate": round(actual_rate, 1),
                "in_office_count": stats.in_office if stats else 0,
                "total_records": stats.total if stats else 0,
                "compliant": compliant,
                "gap": round(actual_rate - target_rate, 1),
            })

        # Compute org-wide policy metrics from last 30 days
        org_stats = (
            self.db.query(
                func.count(AttendanceRecord.id).label("total"),
                func.count(case((AttendanceRecord.status.in_([AttendanceStatus.in_office, 'in_office']), 1))).label("in_office"),
                func.count(case((AttendanceRecord.status.in_([AttendanceStatus.remote, 'remote']), 1))).label("remote"),
                func.count(case((AttendanceRecord.status.in_([AttendanceStatus.leave, 'leave']), 1))).label("leave"),
                func.count(func.distinct(AttendanceRecord.employee_id)).label("unique_emps"),
            )
            .filter(
                AttendanceRecord.organization_id == org_id,
                AttendanceRecord.record_date >= thirty_days_ago,
            )
            .first()
        )

        total = org_stats.total or 1
        unique_emps = org_stats.unique_emps or 1
        # Working weeks in 30 days ≈ 4.3
        weeks = 4.3
        avg_office_days = round((org_stats.in_office / unique_emps) / weeks, 1) if unique_emps > 0 else 0
        avg_remote_days = round((org_stats.remote / unique_emps) / weeks, 1) if unique_emps > 0 else 0

        # % of total records that are in_office (office compliance)
        office_compliance = round(org_stats.in_office / total * 100, 1) if total > 0 else 0
        # % of working records (non-holiday) spent on leave
        pto_pct = round(org_stats.leave / total * 100, 1) if total > 0 else 0

        # Active headcount
        current_headcount = self.db.query(func.count(Employee.id)).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        ).scalar() or 0

        policy_metrics = {
            "office_compliance_pct": office_compliance,
            "pto_usage_pct": pto_pct,
            "avg_office_days_per_week": avg_office_days,
            "avg_remote_days_per_week": avg_remote_days,
            "current_headcount": current_headcount,
        }

        return {"policy_metrics": policy_metrics, "report": report}

    def get_hierarchy(
        self, 
        org_id: UUID, 
        days: int = 30,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get attendance data in a department -> manager -> employee hierarchy."""
        
        # 1. Aggregate attendance records in a subquery for performance
        att_filter = [AttendanceRecord.organization_id == org_id]
        if start_date:
            att_filter.append(AttendanceRecord.record_date >= start_date)
        if end_date:
            att_filter.append(AttendanceRecord.record_date <= end_date)
        if not (start_date or end_date):
            since = date.today() - timedelta(days=days)
            att_filter.append(AttendanceRecord.record_date >= since)

        att_subq = self.db.query(
            AttendanceRecord.employee_id,
            func.count(AttendanceRecord.id).label("total_records"),
            func.count(case((AttendanceRecord.status.in_([
                AttendanceStatus.in_office, AttendanceStatus.remote, 'in_office', 'remote'
            ]), 1))).label("present"),
            func.count(case((AttendanceRecord.status.in_([AttendanceStatus.in_office, 'in_office']), 1))).label("in_office"),
            func.count(case((AttendanceRecord.status.in_([AttendanceStatus.remote, 'remote']), 1))).label("remote"),
            func.count(case((AttendanceRecord.status.in_([AttendanceStatus.absent, 'absent']), 1))).label("absent"),
            func.count(case((AttendanceRecord.status.in_([AttendanceStatus.leave, 'leave']), 1))).label("leave"),
        ).filter(*att_filter).group_by(AttendanceRecord.employee_id).subquery()

        # 2. Query employees and join with the pre-aggregated attendance
        Manager = aliased(Employee)
        query = self.db.query(
            Employee.department,
            Employee.team,
            Employee.id.label("employee_id"),
            Employee.first_name,
            Employee.last_name,
            Employee.job_title,
            Employee.manager_id,
            Manager.first_name.label("manager_first_name"),
            Manager.last_name.label("manager_last_name"),
            func.coalesce(att_subq.c.total_records, 0).label("total_records"),
            func.coalesce(att_subq.c.present, 0).label("present"),
            func.coalesce(att_subq.c.in_office, 0).label("in_office"),
            func.coalesce(att_subq.c.remote, 0).label("remote"),
            func.coalesce(att_subq.c.absent, 0).label("absent"),
            func.coalesce(att_subq.c.leave, 0).label("leave"),
        ).select_from(Employee).outerjoin(
            att_subq, Employee.id == att_subq.c.employee_id
        ).outerjoin(
            Manager, Employee.manager_id == Manager.id
        ).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active
        )

        query = apply_global_filters(query, Employee, departments=departments, locations=locations)
        rows = query.all()

        # Fetch bank holidays for rate calculation
        from database.models import AttendancePolicy
        policy = self.db.query(AttendancePolicy).filter(AttendancePolicy.organization_id == org_id).first()
        bank_holidays = policy.bank_holidays if policy else []
        bh_dates = [h.get('date') if isinstance(h, dict) else str(h) for h in bank_holidays]

        # Calculate working days in the period
        s_dt = start_date if start_date else (date.today() - timedelta(days=days))
        e_dt = end_date if end_date else date.today()
        if isinstance(s_dt, str): s_dt = date.fromisoformat(s_dt)
        if isinstance(e_dt, str): e_dt = date.fromisoformat(e_dt)
        
        working_days_count = 0
        curr = s_dt
        while curr <= e_dt:
            if curr.weekday() < 5 and curr.isoformat() not in bh_dates:
                working_days_count += 1
            curr += timedelta(days=1)
        
        working_days_count = max(working_days_count, 1)

        def _rate(present: int, num_employees: int) -> float:
            # expected = num_employees * working_days_count
            expected = num_employees * working_days_count
            if expected <= 0: return 0.0
            val = (present / expected) * 100
            return round(min(100.0, val), 1)

        def _blank_agg(name: str) -> Dict[str, Any]:
            return {"name": name, "total": 0, "present": 0, "in_office": 0,
                    "remote": 0, "absent": 0, "leave": 0, "employee_count": 0}

        # Build hierarchy: department -> team -> manager -> employees
        dept_map: Dict[str, Dict[str, Any]] = {}
        for row in rows:
            dept = row.department or "Unassigned"
            team = row.team or "General"
            mgr_id = str(row.manager_id) if row.manager_id else "__no_manager__"
            mgr_name = (
                f"{row.manager_first_name} {row.manager_last_name}"
                if row.manager_first_name else "No Manager"
            )

            if dept not in dept_map:
                dept_map[dept] = {**_blank_agg(dept), "teams": {}}
            d = dept_map[dept]

            if team not in d["teams"]:
                d["teams"][team] = {**_blank_agg(team), "managers": {}}
            t = d["teams"][team]

            mgr_key = f"{team}::{mgr_id}"
            if mgr_key not in t["managers"]:
                t["managers"][mgr_key] = {**_blank_agg(mgr_name), "id": mgr_id, "employees": []}
            m = t["managers"][mgr_key]

            emp = {
                "id": str(row.employee_id),
                "name": f"{row.first_name} {row.last_name}",
                "job_title": row.job_title,
                "total": row.total_records,
                "present": row.present,
                "in_office": row.in_office,
                "remote": row.remote,
                "absent": row.absent,
                "leave": row.leave,
                "attendance_rate": _rate(row.present, 1),
                "office_rate": _rate(row.in_office, 1),
            }
            m["employees"].append(emp)

            for agg in (m, t, d):
                agg["total"] += row.total_records
                agg["present"] += row.present
                agg["in_office"] += row.in_office
                agg["remote"] += row.remote
                agg["absent"] += row.absent
                agg["leave"] += row.leave
                agg["employee_count"] += 1

        # Convert to sorted list structure
        result = []
        for dept in sorted(dept_map.values(), key=lambda x: x["name"]):
            teams_list = []
            for t in sorted(dept["teams"].values(), key=lambda x: x["name"]):
                mgrs_list = []
                for mgr in sorted(t["managers"].values(), key=lambda x: x["name"]):
                    mgr["attendance_rate"] = _rate(mgr["present"], mgr["employee_count"])
                    mgr["office_rate"] = _rate(mgr["in_office"], mgr["employee_count"])
                    mgr["employees"] = sorted(mgr["employees"], key=lambda x: x["name"])
                    mgrs_list.append({k: v for k, v in mgr.items() if k != "managers"})
                teams_list.append({
                    "name": t["name"],
                    "total": t["total"], "present": t["present"],
                    "in_office": t["in_office"], "remote": t["remote"],
                    "absent": t["absent"], "leave": t["leave"],
                    "employee_count": t["employee_count"],
                    "attendance_rate": _rate(t["present"], t["employee_count"]),
                    "office_rate": _rate(t["in_office"], t["employee_count"]),
                    "managers": mgrs_list,
                })

            dept_entry = {
                "name": dept["name"],
                "total": dept["total"], "present": dept["present"],
                "in_office": dept["in_office"], "remote": dept["remote"],
                "absent": dept["absent"], "leave": dept["leave"],
                "employee_count": dept["employee_count"],
                "attendance_rate": _rate(dept["present"], dept["employee_count"]),
                "office_rate": _rate(dept["in_office"], dept["employee_count"]),
                "teams": teams_list,
            }
            result.append(dept_entry)

        return result

    def import_records(self, org_id: UUID, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Bulk import attendance records with upsert behavior."""
        created = 0
        updated = 0
        errors = []

        for rec in records:
            try:
                employee_id = UUID(rec["employee_id"])
                rec_date = rec["date"] if isinstance(rec["date"], date) else datetime.strptime(rec["date"], "%Y-%m-%d").date()
                status_str = rec.get("status", "in_office")
                att_status = AttendanceStatus(status_str)

                # Check for existing record (upsert)
                existing = self.db.query(AttendanceRecord).filter(
                    AttendanceRecord.organization_id == org_id,
                    AttendanceRecord.employee_id == employee_id,
                    AttendanceRecord.record_date == rec_date,
                ).first()

                if existing:
                    existing.status = att_status
                    existing.updated_at = datetime.utcnow()
                    updated += 1
                else:
                    new_rec = AttendanceRecord(
                        id=uuid4(),
                        organization_id=org_id,
                        employee_id=employee_id,
                        date=rec_date,
                        status=att_status,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    )
                    self.db.add(new_rec)
                    created += 1
            except Exception as e:
                errors.append(f"Row error: {str(e)}")

        self.db.commit()
        return {"created": created, "updated": updated, "errors": errors}
