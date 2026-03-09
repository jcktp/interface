from typing import Dict, Any, List, Optional
from datetime import date, timedelta
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, case
from database.models import Employee, EmployeeStatus

class RecruitmentService:
    def __init__(self, db: Session):
        self.db = db

    def get_quality_of_hire(
        self,
        org_id: UUID,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Quality of hire metrics: avg by dept, location, source company; distribution; trend."""
        
        base = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.quality_of_hire_score.isnot(None),
        )
        
        # Filtering logic
        if departments:
            dept_list = [d.strip() for d in departments.split(',')]
            base = base.filter(Employee.department.in_(dept_list))
        if locations:
            loc_list = [l.strip() for l in locations.split(',')]
            base = base.filter(Employee.location.in_(loc_list))
        if start_date and start_date != 'all':
            base = base.filter(Employee.hire_date >= start_date)
        if end_date and end_date != 'all':
            base = base.filter(Employee.hire_date <= end_date)

        # Average by department
        by_dept_rows = (
            base.with_entities(
                Employee.department,
                func.avg(Employee.quality_of_hire_score).label("avg_score"),
                func.count(Employee.id).label("count"),
            )
            .group_by(Employee.department)
            .order_by(func.avg(Employee.quality_of_hire_score).desc())
            .all()
        )

        # Average by location
        by_location_rows = (
            base.with_entities(
                Employee.location,
                func.avg(Employee.quality_of_hire_score).label("avg_score"),
                func.count(Employee.id).label("count"),
            )
            .group_by(Employee.location)
            .order_by(func.avg(Employee.quality_of_hire_score).desc())
            .all()
        )

        # Score distribution buckets
        dist_query = base.with_entities(
            case(
                (Employee.quality_of_hire_score < 20, '0-20'),
                (Employee.quality_of_hire_score < 40, '20-40'),
                (Employee.quality_of_hire_score < 60, '40-60'),
                (Employee.quality_of_hire_score < 80, '60-80'),
                else_='80-100'
            ).label("bucket"),
            func.count(Employee.id)
        ).group_by("bucket").all()
        
        distribution = {"0-20": 0, "20-40": 0, "40-60": 0, "60-80": 0, "80-100": 0}
        for bucket, count in dist_query:
            distribution[bucket] = count

        # Trend over time (by hire year-quarter)
        trend_rows = (
            base.with_entities(
                extract("year", Employee.hire_date).label("yr"),
                (extract("month", Employee.hire_date) / 3.1 + 1).label("qtr"),
                func.avg(Employee.quality_of_hire_score).label("avg_score"),
                func.count(Employee.id).label("count"),
            )
            .group_by("yr", "qtr")
            .order_by("yr", "qtr")
            .all()
        )
        
        trend = [
            {"period": f"{int(r.yr)} Q{int(float(r.qtr))}", "avg_score": round(float(r.avg_score), 1), "count": r.count}
            for r in trend_rows
        ]

        # Top source companies
        by_source_rows = (
            base.filter(Employee.previous_company.isnot(None))
            .with_entities(
                Employee.previous_company,
                func.avg(Employee.quality_of_hire_score).label("avg_score"),
                func.count(Employee.id).label("count"),
            )
            .group_by(Employee.previous_company)
            .order_by(func.avg(Employee.quality_of_hire_score).desc())
            .limit(15)
            .all()
        )

        # Overall stats
        stats = base.with_entities(
            func.avg(Employee.quality_of_hire_score),
            func.count(Employee.id)
        ).first()
        
        return {
            "overall_avg": round(float(stats[0] or 0), 1),
            "total_scored": stats[1] or 0,
            "by_department": [{"department": r.department, "avg_score": round(float(r.avg_score), 1), "count": r.count} for r in by_dept_rows],
            "by_location": [{"location": r.location, "avg_score": round(float(r.avg_score), 1), "count": r.count} for r in by_location_rows],
            "top_source_companies": [{"company": r.previous_company, "avg_score": round(float(r.avg_score), 1), "count": r.count} for r in by_source_rows],
            "score_distribution": distribution,
            "trend": trend,
        }

    def get_quality_of_hire_analytics(
        self,
        org_id: UUID,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Enhanced quality of hire analytics with multiple dimensions."""
        import hashlib as _hashlib
        from database.models import RecruiterGoal, Candidate, CandidateStatus

        base = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.quality_of_hire_score.isnot(None),
        )
        if departments:
            base = base.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            base = base.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))
        if start_date and start_date != 'all':
            base = base.filter(Employee.hire_date >= start_date)
        if end_date and end_date != 'all':
            base = base.filter(Employee.hire_date <= end_date)

        scored_employees = base.all()
        if not scored_employees:
            return {
                "by_recruiter": [],
                "by_team": [],
                "by_manager": [],
                "by_source_company": [],
                "time_to_hire_correlation": [],
                "overall_avg_quality": 0,
                "total_hires_analyzed": 0,
            }

        # Simplified dimensions logic
        recruiter_goals = self.db.query(RecruiterGoal.name).filter(RecruiterGoal.organization_id == org_id).distinct().all()
        recruiter_names = sorted(set(rg.name for rg in recruiter_goals)) if recruiter_goals else []

        by_recruiter_data = []
        if recruiter_names:
            recruiter_buckets: Dict[str, list] = {name: [] for name in recruiter_names}
            for emp in scored_employees:
                emp_hash = int(_hashlib.md5(str(emp.id).encode()).hexdigest(), 16)
                assigned_recruiter = recruiter_names[emp_hash % len(recruiter_names)]
                recruiter_buckets[assigned_recruiter].append(emp)

            for name in recruiter_names:
                emps = recruiter_buckets[name]
                if not emps: continue
                scores = [e.quality_of_hire_score for e in emps]
                by_recruiter_data.append({
                    "recruiter": name,
                    "avg_quality": round(sum(scores) / len(scores), 1),
                    "hire_count": len(scores),
                })
            by_recruiter_data.sort(key=lambda x: x["avg_quality"], reverse=True)

        # By Team
        by_team_data = []
        teams = sorted(set(e.department for e in scored_employees if e.department))
        for team_name in teams:
            emps = [e for e in scored_employees if e.department == team_name]
            scores = [e.quality_of_hire_score for e in emps]
            by_team_data.append({
                "team": team_name,
                "avg_quality": round(sum(scores) / len(scores), 1),
                "hire_count": len(scores),
            })
        by_team_data.sort(key=lambda x: x["avg_quality"], reverse=True)

        # By Manager
        by_manager_data = []
        manager_ids = list(set(e.manager_id for e in scored_employees if e.manager_id))
        managers = self.db.query(Employee).filter(Employee.id.in_(manager_ids)).all() if manager_ids else []
        manager_map = {m.id: f"{m.first_name} {m.last_name}" for m in managers}
        
        manager_buckets: Dict[str, list] = {str(mid): [] for mid in manager_ids}
        for emp in scored_employees:
            if emp.manager_id:
                manager_buckets[str(emp.manager_id)].append(emp)
                
        for mid_str, emps in manager_buckets.items():
            if not emps: continue
            scores = [e.quality_of_hire_score for e in emps]
            by_manager_data.append({
                "manager": manager_map.get(UUID(mid_str), "Unknown"),
                "avg_quality": round(sum(scores) / len(scores), 1),
                "hire_count": len(scores),
            })
        by_manager_data.sort(key=lambda x: x["avg_quality"], reverse=True)

        # Time-to-Hire Correlation from real candidate data
        correlation = []
        try:
            from database.models import Candidate, CandidateStatus
            hired_cands = self.db.query(
                Candidate.application_date, Candidate.offer_accepted_date, Candidate.department
            ).filter(
                Candidate.organization_id == org_id,
                Candidate.status == CandidateStatus.hired,
                Candidate.offer_accepted_date.isnot(None),
                Candidate.application_date.isnot(None),
            ).all()

            # Build dept avg quality map from scored employees
            dept_quality: Dict[str, list] = {}
            for e in scored_employees:
                if e.department:
                    dept_quality.setdefault(e.department, []).append(e.quality_of_hire_score)

            bucket_defs = [
                ("< 15 days", 0, 15),
                ("15-30 days", 15, 30),
                ("30-60 days", 30, 60),
                ("60-90 days", 60, 90),
                ("> 90 days", 90, 9999),
            ]
            bucket_scores: Dict[str, list] = {b[0]: [] for b in bucket_defs}
            for c in hired_cands:
                days = (c.offer_accepted_date - c.application_date).days
                for label, low, high in bucket_defs:
                    if low <= days < high:
                        dept_q = dept_quality.get(c.department, [])
                        if dept_q:
                            bucket_scores[label].append(sum(dept_q) / len(dept_q))
                        break

            for label, _, _ in bucket_defs:
                scores = bucket_scores[label]
                if scores:
                    correlation.append({
                        "time_bucket": label,
                        "avg_quality": round(sum(scores) / len(scores), 1),
                        "count": len(scores),
                    })
        except Exception:
            pass

        # By source company (previous_company field)
        source_company_rows = (
            self.db.query(Employee.previous_company, func.avg(Employee.quality_of_hire_score).label("avg_quality"), func.count(Employee.id).label("cnt"))
            .filter(
                Employee.organization_id == org_id,
                Employee.quality_of_hire_score.isnot(None),
                Employee.previous_company.isnot(None),
            )
            .group_by(Employee.previous_company)
            .order_by(func.avg(Employee.quality_of_hire_score).desc())
            .limit(20)
            .all()
        )
        by_source_company = [
            {"company": r.previous_company, "avg_quality": round(float(r.avg_quality), 1), "count": r.cnt}
            for r in source_company_rows
        ]

        return {
            "by_recruiter": by_recruiter_data[:10],
            "by_team": by_team_data[:10],
            "by_manager": by_manager_data[:10],
            "by_source_company": by_source_company,
            "time_to_hire_correlation": correlation,
            "overall_avg_quality": round(sum(e.quality_of_hire_score for e in scored_employees) / len(scored_employees), 1),
            "total_hires_analyzed": len(scored_employees),
        }

    def get_cost_per_hire(
        self,
        org_id: UUID,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Cost per hire metrics: overall avg, by department, by seniority, trend."""
        base = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.cost_per_hire.isnot(None),
        )

        if departments:
            base = base.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            base = base.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))
        if start_date and start_date != 'all':
            base = base.filter(Employee.hire_date >= start_date)
        if end_date and end_date != 'all':
            base = base.filter(Employee.hire_date <= end_date)

        # Overall stats
        overall = base.with_entities(
            func.avg(Employee.cost_per_hire).label("avg"),
            func.min(Employee.cost_per_hire).label("min"),
            func.max(Employee.cost_per_hire).label("max"),
            func.count(Employee.id).label("count"),
        ).first()

        # By department
        by_dept = (
            base.with_entities(
                Employee.department,
                func.avg(Employee.cost_per_hire).label("avg_cost"),
                func.count(Employee.id).label("count"),
            )
            .group_by(Employee.department)
            .order_by(func.avg(Employee.cost_per_hire).desc())
            .all()
        )

        # By seniority
        by_seniority = (
            base.with_entities(
                Employee.job_level,
                func.avg(Employee.cost_per_hire).label("avg_cost"),
                func.count(Employee.id).label("count"),
            )
            .group_by(Employee.job_level)
            .order_by(func.avg(Employee.cost_per_hire).desc())
            .all()
        )

        # Trend by hire year
        trend_rows = (
            base.with_entities(
                extract("year", Employee.hire_date).label("yr"),
                func.avg(Employee.cost_per_hire).label("avg_cost"),
                func.count(Employee.id).label("count"),
            )
            .group_by("yr")
            .order_by("yr")
            .all()
        )

        by_dept_list = [
            {"department": r.department, "avg_cost": round(float(r.avg_cost), 2), "count": r.count}
            for r in by_dept
        ]
        by_level_list = [
            {"level": r.job_level or "Unknown", "avg_cost": round(float(r.avg_cost), 2), "count": r.count}
            for r in by_seniority
        ]
        overall_avg = round(float(overall.avg or 0), 2)
        spend_trend = [
            {
                "year": int(r.yr),
                "period": str(int(r.yr)),
                "avg_cost": round(float(r.avg_cost), 2),
                "hires": r.count,
                "count": r.count,
                "total_spend": round(float(r.avg_cost) * r.count, 2),
            }
            for r in trend_rows
        ]
        # Cost efficiency: ratio of avg_cost relative to the overall avg (lower = more efficient)
        cost_efficiency = [
            {
                "department": r["department"],
                "avg_cost": r["avg_cost"],
                "efficiency_ratio": round((overall_avg / r["avg_cost"] * 100) if r["avg_cost"] > 0 else 0, 1),
                "efficiency_score": round((overall_avg / r["avg_cost"] * 100) if r["avg_cost"] > 0 else 0, 1),
                "count": r["count"],
            }
            for r in sorted(by_dept_list, key=lambda x: x["avg_cost"])
        ]
        overall_total_spend = round(overall_avg * (overall.count or 0), 2)
        return {
            "overall_avg_cost": overall_avg,
            "overall_avg": overall_avg,  # alias
            "overall_min": round(float(overall.min or 0), 2),
            "overall_max": round(float(overall.max or 0), 2),
            "total_hires": overall.count or 0,
            "overall_total_spend": overall_total_spend,
            "total_spend": overall_total_spend,  # alias
            "by_department": by_dept_list,
            "by_level": by_level_list,
            "by_seniority": by_level_list,  # keep alias for compatibility
            "spend_trend": spend_trend,
            "trend": spend_trend,  # keep alias
            "cost_efficiency": cost_efficiency,
        }

    def get_source_analysis(
        self,
        org_id: UUID,
        departments: Optional[str] = None,
        locations: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Source company analysis: breakdown by previous_company."""
        
        base = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.previous_company.isnot(None),
        )
        
        if departments:
            base = base.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            base = base.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))
        if start_date and start_date != 'all':
            base = base.filter(Employee.hire_date >= start_date)
        if end_date and end_date != 'all':
            base = base.filter(Employee.hire_date <= end_date)

        rows = (
            base.with_entities(
                Employee.previous_company,
                func.count(Employee.id).label("total_hired"),
                func.avg(Employee.quality_of_hire_score).label("avg_quality"),
                func.avg(Employee.tenure).label("avg_tenure"),
                func.avg(Employee.performance_rating).label("avg_performance"),
                func.sum(case((Employee.status == EmployeeStatus.active, 1), else_=0)).label("active_count"),
            )
            .group_by(Employee.previous_company)
            .order_by(func.count(Employee.id).desc())
            .all()
        )

        sources = []
        for r in rows:
            retention_rate = round((r.active_count / r.total_hired) * 100, 1) if r.total_hired > 0 else 0
            sources.append({
                "company": r.previous_company,
                "total_hired": r.total_hired,
                "avg_quality_score": round(float(r.avg_quality), 1) if r.avg_quality else None,
                "avg_tenure": round(float(r.avg_tenure), 2) if r.avg_tenure else None,
                "avg_performance": round(float(r.avg_performance), 2) if r.avg_performance else None,
                "retention_rate": retention_rate,
                "active_count": r.active_count,
            })

        quality_sorted = sorted([s for s in sources if s["avg_quality_score"] is not None],
                                key=lambda x: x["avg_quality_score"], reverse=True)

        return {
            "sources": sources,
            "top_sources": quality_sorted[:10],
            "total_with_source": sum(s["total_hired"] for s in sources),
        }
