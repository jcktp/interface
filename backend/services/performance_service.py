from typing import Dict, Any, List, Optional
from datetime import date, timedelta, datetime
from uuid import UUID
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func, case, desc, extract, or_
from database.models import Employee, EmployeeStatus
from dateutil.relativedelta import relativedelta

class PerformanceService:
    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_data(self, org_id: UUID, departments=None, locations=None, start_date=None, end_date=None) -> Dict[str, Any]:
        # 1. Base query
        active_q = self.db.query(Employee).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active)
        if departments:
            active_q = active_q.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            active_q = active_q.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))

        # 2. Summary stats
        stats = active_q.with_entities(
            func.avg(Employee.performance_rating).label("avg_perf"),
            func.avg(Employee.engagement_score).label("avg_eng"),
            func.count(Employee.id).label("total_rated")
        ).filter(Employee.performance_rating.isnot(None)).first()

        # Compute retention rate: employees hired > 12 months ago still active
        # vs those hired > 12 months ago but now terminated
        cutoff_12mo = date.today() - relativedelta(months=12)
        active_tenured = active_q.filter(Employee.hire_date <= cutoff_12mo).count()
        terminated_tenured = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.terminated,
            Employee.hire_date <= cutoff_12mo,
            Employee.termination_date >= cutoff_12mo,
        )
        if departments:
            terminated_tenured = terminated_tenured.filter(
                Employee.department.in_([d.strip() for d in departments.split(',')])
            )
        if locations:
            terminated_tenured = terminated_tenured.filter(
                Employee.location.in_([l.strip() for l in locations.split(',')])
            )
        terminated_count = terminated_tenured.count()
        cohort_total = active_tenured + terminated_count
        retention_rate = round(active_tenured / cohort_total * 100, 1) if cohort_total > 0 else 100.0

        summary = {
            "avg_performance_rating": round(float(stats.avg_perf or 0), 2),
            "avg_engagement_score": round(float(stats.avg_eng or 0), 2),
            "total_employees_rated": stats.total_rated or 0,
            "retention_rate": retention_rate,
        }

        # 3. Distribution
        dist_rows = active_q.with_entities(
            case(
                (Employee.performance_rating >= 4.5, "top"),
                (Employee.performance_rating >= 3.5, "good"),
                (Employee.performance_rating >= 2.5, "mid"),
                else_="low"
            ).label("bucket"),
            func.count(Employee.id)
        ).filter(Employee.performance_rating.isnot(None)).group_by("bucket").all()
        
        dist_dict = {row.bucket: row[1] for row in dist_rows}
        total = summary["total_employees_rated"] or 1
        
        distribution = {
            "top_performers": {"count": dist_dict.get("top", 0), "pct": round(dist_dict.get("top", 0) / total * 100, 1)},
            "good_performers": {"count": dist_dict.get("good", 0), "pct": round(dist_dict.get("good", 0) / total * 100, 1)},
            "mid_performers": {"count": dist_dict.get("mid", 0), "pct": round(dist_dict.get("mid", 0) / total * 100, 1)},
            "low_performers": {"count": dist_dict.get("low", 0), "pct": round(dist_dict.get("low", 0) / total * 100, 1)},
        }

        # 4. Dimension breakdowns
        def get_group_stats(column):
            rows = active_q.with_entities(
                column.label("name"),
                func.count(Employee.id).label("headcount"),
                func.avg(Employee.performance_rating).label("avg_perf"),
                func.avg(Employee.engagement_score).label("avg_eng"),
                func.avg(Employee.salary).label("avg_sal"),
                func.sum(case((Employee.performance_rating >= 4.5, 1), else_=0)).label("top_count"),
                func.sum(case((Employee.performance_rating < 2.5, 1), else_=0)).label("low_count"),
            ).filter(Employee.performance_rating.isnot(None)).group_by(column).all()
            return [
                {
                    "department": r.name or "Unknown",
                    "headcount": r.headcount,
                    "avg_performance": round(float(r.avg_perf or 0), 2),
                    "avg_engagement": round(float(r.avg_eng or 0), 2),
                    "avg_salary": round(float(r.avg_sal or 0), 0),
                    "top_performer_count": int(r.top_count or 0),
                    "low_performer_count": int(r.low_count or 0),
                } for r in rows
            ]

        # 5. Top/Low Employees
        top_emps = active_q.filter(Employee.performance_rating.isnot(None)).order_by(desc(Employee.performance_rating)).limit(20).all()
        low_emps = active_q.filter(Employee.performance_rating.isnot(None)).order_by(Employee.performance_rating).limit(20).all()

        def fmt_emp(e):
            return {
                "name": f"{e.first_name} {e.last_name}",
                "department": e.department,
                "team": e.team or "General",
                "location": e.location,
                "performance_rating": e.performance_rating,
                "engagement_score": e.engagement_score,
                "tenure": e.tenure or 0,
                "salary": e.salary
            }

        return {
            "summary": summary,
            "distribution": distribution,
            "by_department": get_group_stats(Employee.department),
            "by_team": get_group_stats(Employee.team),
            "by_location": get_group_stats(Employee.location),
            "by_manager": self._get_by_manager(org_id, departments, locations),
            "top_employees": [fmt_emp(e) for e in top_emps],
            "low_employees": [fmt_emp(e) for e in low_emps],
            "satisfaction_trend": self._get_satisfaction_trend(org_id, departments, locations, start_date, end_date)
        }

    def _get_by_manager(self, org_id: UUID, departments=None, locations=None) -> List[Dict[str, Any]]:
        """Aggregate team performance metrics grouped by manager."""
        Manager = aliased(Employee, name="manager")
        Report = aliased(Employee, name="report")

        q = (
            self.db.query(
                (Manager.first_name + " " + Manager.last_name).label("manager_name"),
                Manager.department.label("department"),
                func.count(Report.id).label("direct_reports"),
                func.avg(Report.performance_rating).label("avg_perf"),
                func.avg(Report.engagement_score).label("avg_eng"),
                func.sum(
                    case((Report.performance_rating >= 4.5, 1), else_=0)
                ).label("top_performers"),
                func.sum(
                    case((Report.performance_rating < 2.5, 1), else_=0)
                ).label("low_performers"),
            )
            .join(Report, Report.manager_id == Manager.id)
            .filter(
                Manager.organization_id == org_id,
                Manager.status == EmployeeStatus.active,
                Report.organization_id == org_id,
                Report.status == EmployeeStatus.active,
                Report.performance_rating.isnot(None),
            )
        )

        if departments:
            dept_list = [d.strip() for d in departments.split(',')]
            q = q.filter(Report.department.in_(dept_list))
        if locations:
            loc_list = [l.strip() for l in locations.split(',')]
            q = q.filter(Report.location.in_(loc_list))

        q = q.group_by(Manager.id, Manager.first_name, Manager.last_name, Manager.department)
        q = q.order_by(desc("avg_perf")).limit(100)

        return [
            {
                "manager_name": r.manager_name,
                "department": r.department or "Unknown",
                "direct_reports": r.direct_reports,
                "avg_team_performance": round(float(r.avg_perf or 0), 2),
                "avg_team_engagement": round(float(r.avg_eng or 0), 2),
                "top_performers": int(r.top_performers or 0),
                "low_performers": int(r.low_performers or 0),
            }
            for r in q.all()
        ]

    def _get_satisfaction_trend(self, org_id: UUID, departments=None, locations=None, start_date=None, end_date=None) -> List[Dict[str, Any]]:
        """Monthly avg engagement & performance over the selected date range, grouped by hire_date month."""
        from datetime import date as date_type
        from dateutil.relativedelta import relativedelta

        # Determine range — default to last 12 months
        today = date_type.today()
        if start_date and start_date != 'all':
            try:
                range_start = date_type.fromisoformat(start_date)
            except Exception:
                range_start = today.replace(day=1) - relativedelta(months=11)
        else:
            range_start = today.replace(day=1) - relativedelta(months=11)

        if end_date and end_date != 'all':
            try:
                range_end = date_type.fromisoformat(end_date)
            except Exception:
                range_end = today
        else:
            range_end = today

        # Base: all active employees (engagement/performance are current, not historical)
        # Group by the month they were hired to approximate a cohort-style trend,
        # but actually we want a time-series of the org's avg over months.
        # Since we don't store historical snapshots, we use hire_date month bucketing
        # as a proxy for tenure cohorts — and emit one row per calendar month in range.

        q = (
            self.db.query(
                extract('year', Employee.hire_date).label('yr'),
                extract('month', Employee.hire_date).label('mo'),
                func.avg(Employee.engagement_score).label('avg_eng'),
                func.avg(Employee.performance_rating).label('avg_perf'),
            )
            .filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.active,
                Employee.hire_date.isnot(None),
                Employee.hire_date >= range_start,
                Employee.hire_date <= range_end,
            )
        )

        if departments:
            q = q.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            q = q.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))

        q = q.group_by('yr', 'mo').order_by('yr', 'mo')
        rows = q.all()

        result = []
        for r in rows:
            yr, mo = int(r.yr), int(r.mo)
            label = date_type(yr, mo, 1).strftime('%Y-%m-%d')
            result.append({
                "month": label,
                "avg_engagement": round(float(r.avg_eng or 0), 2),
                "avg_performance": round(float(r.avg_perf or 0), 2),
            })

        return result

    def get_performance_hierarchy(self, org_id: UUID, departments=None, locations=None) -> List[Dict[str, Any]]:
        """Get a deep hierarchical view: Department -> Team -> Manager -> Employee."""

        # 1. Base query
        employees = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
            Employee.performance_rating.isnot(None)
        )
        if departments:
            employees = employees.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            employees = employees.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))
        all_emps = employees.all()

        def _avg(lst, attr):
            vals = [getattr(e, attr) for e in lst if getattr(e, attr) is not None]
            return round(sum(vals) / len(vals), 2) if vals else 0.0

        # Map managers lookup (any employee who is someone's manager_id)
        manager_ids = {e.manager_id for e in all_emps if e.manager_id}
        all_managers = {e.id: e for e in all_emps if e.id in manager_ids}

        # Group by dept → team → manager
        from collections import defaultdict
        dept_team_mgr: dict = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
        for e in all_emps:
            dept = e.department or "Unknown"
            team = e.team or "General"
            mgr_id = e.manager_id  # may be None
            dept_team_mgr[dept][team][mgr_id].append(e)

        hierarchy = []
        for dept_name, teams in dept_team_mgr.items():
            dept_emps = [e for team_mgrs in teams.values() for reports in team_mgrs.values() for e in reports]
            teams_list = []
            for team_name, mgr_groups in teams.items():
                team_emps = [e for reports in mgr_groups.values() for e in reports]
                managers_list = []
                for mgr_id, reports in mgr_groups.items():
                    mgr_obj = all_managers.get(mgr_id)
                    mgr_name = f"{mgr_obj.first_name} {mgr_obj.last_name}" if mgr_obj else "No Manager"
                    mgr_job_title = mgr_obj.job_title if mgr_obj else None
                    managers_list.append({
                        "id": str(mgr_id) if mgr_id else f"none_{team_name}",
                        "name": mgr_name,
                        "job_title": mgr_job_title,
                        "employee_count": len(reports),
                        "avg_performance": _avg(reports, "performance_rating"),
                        "avg_engagement": _avg(reports, "engagement_score"),
                        "employees": [
                            {
                                "id": str(r.id),
                                "name": f"{r.first_name} {r.last_name}",
                                "job_title": r.job_title,
                                "performance_rating": r.performance_rating,
                                "engagement_score": r.engagement_score,
                                "tenure": r.tenure,
                            } for r in reports
                        ]
                    })
                managers_list.sort(key=lambda x: x["avg_performance"], reverse=True)
                teams_list.append({
                    "name": team_name,
                    "employee_count": len(team_emps),
                    "avg_performance": _avg(team_emps, "performance_rating"),
                    "avg_engagement": _avg(team_emps, "engagement_score"),
                    "managers": managers_list,
                })
            teams_list.sort(key=lambda x: x["avg_performance"], reverse=True)
            hierarchy.append({
                "name": dept_name,
                "employee_count": len(dept_emps),
                "avg_performance": _avg(dept_emps, "performance_rating"),
                "avg_engagement": _avg(dept_emps, "engagement_score"),
                "teams": teams_list,
            })
        return sorted(hierarchy, key=lambda x: x["avg_performance"], reverse=True)
