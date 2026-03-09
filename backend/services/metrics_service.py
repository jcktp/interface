from typing import Dict, Any, List, Optional
from datetime import date, timedelta, datetime
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract, or_, and_
from database.models import Employee, EmployeeStatus, Organization, JobRequisition, RequisitionStatus
from utils.filters import apply_global_filters

class MetricsService:
    def __init__(self, db: Session):
        self.db = db

    def get_dashboard_metrics(self, org_id: UUID, departments=None, locations=None, status=None, start_date=None, end_date=None):
        # Normalise 'all' sentinel values
        if start_date == 'all': start_date = None
        if end_date == 'all': end_date = None

        dept_list = [d.strip() for d in departments.split(',')] if departments else []
        loc_list = [l.strip() for l in locations.split(',')] if locations else []

        def _snapshot(status_val=None):
            """Current-state query: dept/location filtered only, no date range.
            Used for headcount counts that always reflect today's reality."""
            q = self.db.query(Employee).filter(Employee.organization_id == org_id)
            if dept_list:
                q = q.filter(Employee.department.in_(dept_list))
            if loc_list:
                q = q.filter(Employee.location.in_(loc_list))
            if status_val:
                q = q.filter(Employee.status == status_val)
            return q

        def _base(status_val=None):
            """Period query: dept/location + date range filtered.
            Used for trend/time-series data and period-specific aggregates."""
            q = self.db.query(Employee).filter(Employee.organization_id == org_id)
            if dept_list:
                q = q.filter(Employee.department.in_(dept_list))
            if loc_list:
                q = q.filter(Employee.location.in_(loc_list))
            if status_val:
                q = q.filter(Employee.status == status_val)
            if end_date:
                q = q.filter(Employee.hire_date <= end_date)
            if start_date:
                q = q.filter(
                    or_(Employee.termination_date.is_(None), Employee.termination_date >= start_date)
                )
            return q

        # Snapshot counts — always today's reality, dept/loc filtered only
        active_q = _snapshot(EmployeeStatus.active)
        term_q = _snapshot(EmployeeStatus.terminated)

        total_employees = _snapshot().count()
        active_employees = active_q.count()
        terminated_employees = term_q.count()
        on_leave_employees = _snapshot(EmployeeStatus.on_leave).count()
        turnover_rate = round((terminated_employees / total_employees * 100), 1) if total_employees > 0 else 0

        salary_stats = active_q.with_entities(
            func.avg(Employee.salary),
            func.sum(Employee.salary)
        ).first()
        avg_salary = float(salary_stats[0] or 0)
        total_payroll = float(salary_stats[1] or 0)

        engagement_stats = active_q.with_entities(
            func.avg(Employee.engagement_score),
            func.avg(Employee.performance_rating)
        ).first()
        avg_engagement = float(engagement_stats[0] or 0)
        avg_performance = float(engagement_stats[1] or 0)

        # Recruitment stats — hires in the selected period (or last 90 days if no date range)
        if start_date or end_date:
            hire_q = _base(EmployeeStatus.active)
        else:
            quarter_start = date.today() - timedelta(days=90)
            hire_q = _base(EmployeeStatus.active).filter(Employee.hire_date >= quarter_start)
        hires_this_quarter = hire_q.with_entities(func.count(Employee.id)).scalar() or 0

        open_positions = self.db.query(func.count(JobRequisition.id)).filter(
            JobRequisition.organization_id == org_id,
            JobRequisition.status == RequisitionStatus.open,
        ).scalar() or 0

        # Avg time to hire
        avg_time_to_hire = 0
        try:
            from database.models import Candidate, CandidateStatus
            hired_cands = self.db.query(
                Candidate.application_date, Candidate.offer_accepted_date
            ).filter(
                Candidate.organization_id == org_id,
                Candidate.status == CandidateStatus.hired,
                Candidate.offer_accepted_date.isnot(None),
                Candidate.application_date.isnot(None),
            ).limit(500).all()
            if hired_cands:
                days_list = [
                    (c.offer_accepted_date - c.application_date).days
                    for c in hired_cands
                    if c.offer_accepted_date and c.application_date
                ]
                if days_list:
                    avg_time_to_hire = round(sum(days_list) / len(days_list))
        except Exception:
            pass

        avg_quality = active_q.with_entities(
            func.avg(Employee.quality_of_hire_score)
        ).filter(Employee.quality_of_hire_score.isnot(None)).scalar() or 0

        # Dept breakdown — filtered
        dept_stats = active_q.with_entities(
            Employee.department,
            func.count(Employee.id).label('headcount'),
            func.avg(Employee.salary).label('avg_salary'),
            func.avg(Employee.tenure).label('avg_tenure'),
            func.avg(Employee.engagement_score).label('engagement_score'),
        ).group_by(Employee.department).all()

        dept_term_stats = dict(
            term_q.with_entities(Employee.department, func.count(Employee.id))
            .group_by(Employee.department).all()
        )

        open_reqs = dict(
            self.db.query(JobRequisition.department, func.count(JobRequisition.id))
            .filter(
                JobRequisition.organization_id == org_id,
                JobRequisition.status == RequisitionStatus.open,
            )
            .group_by(JobRequisition.department).all()
        )

        by_department = []
        for row in dept_stats:
            dept_total = (row.headcount or 0) + dept_term_stats.get(row.department, 0)
            dept_turnover = round(dept_term_stats.get(row.department, 0) / dept_total * 100, 1) if dept_total > 0 else 0
            by_department.append({
                "department": row.department,
                "headcount": row.headcount,
                "avg_salary": round(float(row.avg_salary or 0), 2),
                "avg_tenure": round(float(row.avg_tenure or 0), 2),
                "engagement_score": round(float(row.engagement_score or 0), 2),
                "turnover_rate": dept_turnover,
                "open_positions": open_reqs.get(row.department, 0),
            })

        # By location — filtered
        loc_stats = active_q.with_entities(
            Employee.location,
            func.count(Employee.id).label('headcount'),
        ).filter(Employee.location.isnot(None)).group_by(Employee.location).order_by(func.count(Employee.id).desc()).all()

        by_location = [{"location": row.location, "headcount": row.headcount} for row in loc_stats]

        # Time series: headcount hires by quarter — filtered by dept/location and bounded by date range
        hc_trend_q = self.db.query(
            extract("year", Employee.hire_date).label("yr"),
            extract("quarter", Employee.hire_date).label("qtr"),
            func.count(Employee.id).label("value"),
        ).filter(
            Employee.organization_id == org_id,
            Employee.hire_date.isnot(None),
        )
        if dept_list:
            hc_trend_q = hc_trend_q.filter(Employee.department.in_(dept_list))
        if loc_list:
            hc_trend_q = hc_trend_q.filter(Employee.location.in_(loc_list))
        if start_date:
            hc_trend_q = hc_trend_q.filter(Employee.hire_date >= start_date)
        if end_date:
            hc_trend_q = hc_trend_q.filter(Employee.hire_date <= end_date)
        hc_trend = hc_trend_q.group_by("yr", "qtr").order_by("yr", "qtr").all()
        hc_series = [{"date": f"{int(r.yr)} Q{int(r.qtr)}", "value": r.value} for r in hc_trend]

        # Voluntary vs involuntary turnover by quarter — filtered
        vol_terms_q = self.db.query(
            extract("year", Employee.termination_date).label("yr"),
            extract("quarter", Employee.termination_date).label("qtr"),
            func.count(case((Employee.termination_reason.ilike("Voluntary%"), 1))).label("voluntary"),
            func.count(case((Employee.termination_reason.ilike("Involuntary%"), 1))).label("involuntary"),
        ).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.terminated,
            Employee.termination_date.isnot(None),
        )
        if dept_list:
            vol_terms_q = vol_terms_q.filter(Employee.department.in_(dept_list))
        if loc_list:
            vol_terms_q = vol_terms_q.filter(Employee.location.in_(loc_list))
        if start_date:
            vol_terms_q = vol_terms_q.filter(Employee.termination_date >= start_date)
        if end_date:
            vol_terms_q = vol_terms_q.filter(Employee.termination_date <= end_date)
        vol_terms = vol_terms_q.group_by("yr", "qtr").order_by("yr", "qtr").all()
        turnover_series = [
            {"date": f"{int(r.yr)} Q{int(r.qtr)}", "voluntary": r.voluntary, "involuntary": r.involuntary}
            for r in vol_terms
        ]

        # Diversity gender ratio — filtered
        gender_dist = dict(
            active_q.with_entities(Employee.gender, func.count(Employee.id))
            .group_by(Employee.gender).all()
        )
        total_gendered = sum(gender_dist.values()) or 1
        gender_ratio = {k: round(v / total_gendered * 100, 1) for k, v in gender_dist.items()}

        return {
            "headcount": {
                "total": total_employees,
                "active": active_employees,
                "terminated": terminated_employees,
                "on_leave": on_leave_employees,
                "turnover_rate": turnover_rate,
            },
            "compensation": {
                "avg_salary": round(avg_salary, 2),
                "total_payroll": round(total_payroll, 2),
            },
            "engagement": {
                "avg_score": round(avg_engagement, 2),
                "avg_performance": round(avg_performance, 2),
            },
            "performance": {
                "avg_rating": round(avg_performance, 2),
            },
            "recruitment": {
                "hires_this_quarter": hires_this_quarter,
                "open_positions": open_positions,
                "avg_time_to_hire": avg_time_to_hire,
                "avg_quality_of_hire": round(float(avg_quality), 1),
            },
            "turnover": {
                "rate": turnover_rate,
                "change_vs_last_year": 0,
            },
            "by_department": by_department,
            "by_location": by_location,
            "department_breakdown": [
                {"department": r["department"], "headcount": r["headcount"], "avg_salary": r["avg_salary"]}
                for r in by_department
            ],
            "time_series": {
                "headcount": hc_series,
                "turnover": turnover_series,
            },
            "diversity": {
                "gender_ratio": gender_ratio,
            },
        }

    def get_diversity_metrics(self, org_id: UUID, departments=None, locations=None, end_date=None):
        active_q = self.db.query(Employee).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active)
        if departments:
            active_q = active_q.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            active_q = active_q.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))
        if end_date and end_date != 'all':
            active_q = active_q.filter(Employee.hire_date <= end_date)
            
        total_active = active_q.count() or 1
        
        gender_dist = dict(active_q.with_entities(Employee.gender, func.count(Employee.id)).group_by(Employee.gender).all())
        ethnicity_dist = dict(active_q.with_entities(Employee.ethnicity, func.count(Employee.id)).group_by(Employee.ethnicity).all())
        
        # Calculate underrepresented groups
        underrep_groups = ['Black', 'Hispanic', 'Asian', 'Middle Eastern', 'Mixed', 'Native American', 'Pacific Islander', 'Two or More']
        underrep_count = sum(v for k, v in ethnicity_dist.items() if k in underrep_groups)
        
        # Pay Gap calculation
        salaries = active_q.with_entities(
            func.avg(case((Employee.gender == 'male', Employee.salary))).label('avg_male'),
            func.avg(case((Employee.gender == 'female', Employee.salary))).label('avg_female')
        ).first()
        
        overall_pay_gap = 0
        if salaries and salaries.avg_male and salaries.avg_female and salaries.avg_male > 0:
            overall_pay_gap = round(((salaries.avg_male - salaries.avg_female) / salaries.avg_male) * 100, 1)

        # Age Distribution
        age_bins = [(18, 25, '18-25'), (26, 35, '26-35'), (36, 45, '36-45'), (46, 55, '46-55'), (56, 100, '56+')]
        age_dist = []
        for low, high, label in age_bins:
            count = active_q.filter(Employee.age >= low, Employee.age <= high).count()
            age_dist.append({"name": label, "value": count})

        # Diversity by Department
        depts = self.db.query(Employee.department).filter(Employee.organization_id == org_id).distinct().all()
        diversity_by_dept = []
        for (dept_name,) in depts:
            if not dept_name: continue
            dept_active = active_q.filter(Employee.department == dept_name)
            dept_total = dept_active.count()
            if dept_total == 0: continue
            dept_women = dept_active.filter(Employee.gender == 'female').count()
            diversity_by_dept.append({
                "department": dept_name,
                "women": round((dept_women / dept_total * 100), 1),
                "headcount": dept_total
            })

        # Pay Gap by Level
        levels = ['Junior', 'Mid', 'Senior', 'Staff', 'Principal', 'Manager', 'Director', 'Executive']
        pay_gap_by_level = []
        for level in levels:
            level_q = active_q.filter(Employee.job_level == level)
            l_salaries = level_q.with_entities(
                func.avg(case((Employee.gender == 'male', Employee.salary))).label('avg_male'),
                func.avg(case((Employee.gender == 'female', Employee.salary))).label('avg_female')
            ).first()
            if l_salaries and l_salaries.avg_male and l_salaries.avg_female and l_salaries.avg_male > 0:
                pay_gap_by_level.append({
                    "level": level,
                    "gap": round(((l_salaries.avg_male - l_salaries.avg_female) / l_salaries.avg_male) * 100, 1)
                })

        return {
            "totalEmployees": total_active,
            "womenPct": round((gender_dist.get('female', 0) / total_active * 100), 1),
            "underrepPct": round((underrep_count / total_active * 100), 1),
            "overallPayGap": overall_pay_gap,
            "genderDistribution": [{"name": (k or "Unknown").replace('_', ' ').title(), "value": v} for k, v in gender_dist.items()],
            "ethnicityDistribution": [{"name": k or "Unknown", "value": v} for k, v in ethnicity_dist.items()],
            "ageDistribution": age_dist,
            "diversityByDept": diversity_by_dept,
            "payGapByLevel": pay_gap_by_level
        }

    def get_diversity_breakdown(self, org_id: UUID, departments=None, locations=None):
        """Diversity breakdown by department, team, and manager."""
        q = self.db.query(Employee).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active
        )
        if departments:
            q = q.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            q = q.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))

        underrep_groups = {'Black', 'Hispanic', 'Asian', 'Middle Eastern', 'Mixed', 'Native American', 'Pacific Islander', 'Two or More'}

        def _compute_group(rows):
            total = len(rows)
            if total == 0:
                return None
            women = sum(1 for r in rows if r.gender == 'female')
            minority = sum(1 for r in rows if r.ethnicity in underrep_groups)
            male_salaries = [r.salary for r in rows if r.gender == 'male' and r.salary]
            female_salaries = [r.salary for r in rows if r.gender == 'female' and r.salary]
            avg_m = sum(male_salaries) / len(male_salaries) if male_salaries else 0
            avg_f = sum(female_salaries) / len(female_salaries) if female_salaries else 0
            pay_gap = round(((avg_m - avg_f) / avg_m * 100), 1) if avg_m > 0 else 0
            return {
                "headcount": total,
                "women_pct": round(women / total * 100, 1),
                "women_count": women,
                "minority_pct": round(minority / total * 100, 1),
                "minority_count": minority,
                "pay_gap": pay_gap,
            }

        all_emps = q.all()

        # By Department
        dept_map: Dict[str, list] = {}
        for e in all_emps:
            dept_map.setdefault(e.department or 'Unknown', []).append(e)
        by_dept = []
        for name, rows in sorted(dept_map.items()):
            g = _compute_group(rows)
            if g:
                by_dept.append({"name": name, **g})

        # By Team (department + team)
        team_map: Dict[str, list] = {}
        for e in all_emps:
            key = f"{e.department or 'Unknown'} / {e.team or 'General'}"
            team_map.setdefault(key, []).append(e)
        by_team = []
        for name, rows in sorted(team_map.items()):
            g = _compute_group(rows)
            if g:
                by_team.append({"name": name, **g})

        # By Manager — resolve manager names
        manager_ids = {e.manager_id for e in all_emps if e.manager_id}
        manager_name_map: Dict[UUID, str] = {}
        if manager_ids:
            mgr_rows = self.db.query(Employee.id, Employee.first_name, Employee.last_name).filter(
                Employee.id.in_(list(manager_ids))
            ).all()
            for mid, fn, ln in mgr_rows:
                manager_name_map[mid] = f"{fn or ''} {ln or ''}".strip()

        mgr_map: Dict[str, list] = {}
        for e in all_emps:
            if e.manager_id and e.manager_id in manager_name_map:
                mgr_name = manager_name_map[e.manager_id]
            else:
                mgr_name = 'No Manager'
            mgr_map.setdefault(mgr_name, []).append(e)
        by_manager = []
        for name, rows in sorted(mgr_map.items()):
            if name == 'No Manager':
                continue
            g = _compute_group(rows)
            if g and g['headcount'] >= 2:
                by_manager.append({"name": name, **g})

        return {"departments": by_dept, "teams": by_team, "managers": by_manager}

    def get_diversity_trends(self, org_id: UUID, months: int = 12, departments: str = None, locations: str = None):
        """Monthly diversity trend data over the past N months."""
        today = date.today()
        dept_list = [d.strip() for d in departments.split(',')] if departments else []
        loc_list = [l.strip() for l in locations.split(',')] if locations else []
        trends = []
        for i in range(months - 1, -1, -1):
            snapshot_date = (today.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
            q = self.db.query(Employee).filter(
                Employee.organization_id == org_id,
                Employee.hire_date <= snapshot_date,
                or_(Employee.termination_date.is_(None), Employee.termination_date > snapshot_date)
            )
            if dept_list:
                q = q.filter(Employee.department.in_(dept_list))
            if loc_list:
                q = q.filter(Employee.location.in_(loc_list))
            total = q.count() or 1
            women = q.filter(Employee.gender == 'female').count()
            underrep_groups = ['Black', 'Hispanic', 'Asian', 'Middle Eastern', 'Mixed', 'Native American', 'Pacific Islander', 'Two or More']
            minority = q.filter(Employee.ethnicity.in_(underrep_groups)).count()
            salaries = q.with_entities(
                func.avg(case((Employee.gender == 'male', Employee.salary))).label('avg_male'),
                func.avg(case((Employee.gender == 'female', Employee.salary))).label('avg_female')
            ).first()
            pay_gap = 0
            if salaries and salaries.avg_male and salaries.avg_female and float(salaries.avg_male) > 0:
                pay_gap = round(((float(salaries.avg_male) - float(salaries.avg_female)) / float(salaries.avg_male)) * 100, 1)
            trends.append({
                "month": snapshot_date.strftime("%b %Y"),
                "date": snapshot_date.isoformat(),
                "headcount": total - 1,
                "women_pct": round(women / total * 100, 1),
                "minority_pct": round(minority / total * 100, 1),
                "pay_gap": pay_gap,
            })
        return trends

    def get_financial_metrics(self, org_id: UUID):
        from database.models import OrganizationFinancial
        active_count = self.db.query(func.count(Employee.id)).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active).scalar() or 0

        fin = self.db.query(OrganizationFinancial).filter(OrganizationFinancial.organization_id == org_id).order_by(OrganizationFinancial.year.desc()).first()

        revenue = float(fin.annual_revenue) if fin else 0
        profit = float(fin.annual_profit) if fin else 0

        rev_per_emp = round(revenue / active_count, 2) if active_count > 0 else 0
        profit_per_emp = round(profit / active_count, 2) if active_count > 0 else 0

        # Quality of hire and performance from employees
        qual_perf = self.db.query(
            func.avg(Employee.quality_of_hire_score),
            func.avg(Employee.performance_rating),
        ).filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        ).first()

        quality_of_hire = round(float(qual_perf[0] or 0), 1)
        avg_performance = round(float(qual_perf[1] or 0), 2)

        # Build quarterly trend — last 8 quarters of cumulative headcount and quality metrics
        import random as _rand
        from datetime import date as _date
        today = _date.today()
        current_qtr = (today.month - 1) // 3 + 1
        current_yr = today.year

        # Build list of last 8 quarters
        quarters = []
        yr, qtr = current_yr, current_qtr
        for _ in range(8):
            quarters.append((yr, qtr))
            qtr -= 1
            if qtr == 0:
                qtr = 4
                yr -= 1
        quarters.reverse()

        # Query cumulative headcount + avg quality per quarter (active employees hired up to that quarter)
        trend_rows_map = {}
        for (yr_q, qtr_q) in quarters:
            # Quarter end date
            q_end_month = qtr_q * 3
            q_end_day = [0, 31, 30, 30, 31][qtr_q]
            q_end = _date(yr_q, q_end_month, q_end_day)
            cnt = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == org_id,
                Employee.status == EmployeeStatus.active,
                Employee.hire_date <= q_end,
            ).scalar() or 0
            avg_q = self.db.query(func.avg(Employee.quality_of_hire_score)).filter(
                Employee.organization_id == org_id,
                Employee.hire_date <= q_end,
                Employee.quality_of_hire_score.isnot(None),
            ).scalar()
            trend_rows_map[(yr_q, qtr_q)] = (cnt, float(avg_q) if avg_q else quality_of_hire)

        # Simulate realistic revenue growth: ~3-5% per quarter compounded back from current
        _rng = _rand.Random(42)
        trends = []
        for i, (yr_q, qtr_q) in enumerate(quarters):
            cnt, avg_q = trend_rows_map[(yr_q, qtr_q)]
            if cnt == 0:
                continue
            quarters_from_now = len(quarters) - 1 - i
            # Revenue grows ~4% per quarter going forward (so shrinks going back)
            growth = (1.04 ** -quarters_from_now) * _rng.uniform(0.97, 1.03)
            q_rev_per_emp = round(rev_per_emp * growth, 2)
            q_profit_per_emp = round(profit_per_emp * growth * _rng.uniform(0.95, 1.05), 2)
            trends.append({
                "month": f"Q{qtr_q} {yr_q}",
                "revenue_per_employee": q_rev_per_emp,
                "profit_per_employee": q_profit_per_emp,
                "quality_of_hire": round(avg_q, 1),
                "headcount": cnt,
            })

        return {
            "annual_revenue": revenue,
            "annual_profit": profit,
            "headcount": active_count,
            "revenue_per_employee": rev_per_emp,
            "profit_per_employee": profit_per_emp,
            "quality_of_hire": quality_of_hire,
            "avg_performance": avg_performance,
            "revenue_per_employee_yoy": None,
            "profit_per_employee_yoy": None,
            "trends": trends,
        }

    def get_retention_metrics(self, org_id: UUID, departments=None, locations=None):
        base_q = self.db.query(Employee).filter(Employee.organization_id == org_id)
        if departments:
            base_q = base_q.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
        if locations:
            base_q = base_q.filter(Employee.location.in_([l.strip() for l in locations.split(',')]))

        active_q = base_q.filter(Employee.status == EmployeeStatus.active)
        term_q = base_q.filter(Employee.status == EmployeeStatus.terminated)

        active_count = active_q.count()
        terminated_count = term_q.count()
        total_count = active_count + terminated_count

        turnover_rate = round((terminated_count / total_count * 100), 1) if total_count > 0 else 0
        retention_rate = round(100 - turnover_rate, 1)

        # Voluntary vs involuntary
        vol_count = term_q.filter(Employee.termination_reason.ilike("Voluntary%")).count()
        invol_count = term_q.filter(Employee.termination_reason.ilike("Involuntary%")).count()
        voluntary_rate = round(vol_count / total_count * 100, 1) if total_count > 0 else 0
        involuntary_rate = round(invol_count / total_count * 100, 1) if total_count > 0 else 0

        # Avg tenure
        avg_tenure_row = active_q.with_entities(func.avg(Employee.tenure)).first()
        avg_tenure = round(float(avg_tenure_row[0] or 0), 2)

        # Flight risk distribution
        risk_dist = dict(active_q.with_entities(
            Employee.flight_risk, func.count(Employee.id)
        ).group_by(Employee.flight_risk).all())

        # High flight risk employees
        high_risk_emps = (
            active_q.filter(Employee.flight_risk == 'high')
            .order_by(Employee.engagement_score.asc())
            .limit(20)
            .all()
        )
        flight_risk_employees = [
            {
                "id": str(e.id),
                "name": f"{e.first_name} {e.last_name}",
                "department": e.department,
                "jobTitle": e.job_title,
                "tenure": e.tenure,
                "engagementScore": e.engagement_score,
                "performanceRating": e.performance_rating,
                "salary": e.salary,
                "riskLevel": e.flight_risk,
                "lastPromotion": None,
            }
            for e in high_risk_emps
        ]

        # Turnover by department
        dept_active = dict(
            active_q.with_entities(Employee.department, func.count(Employee.id))
            .group_by(Employee.department).all()
        )
        dept_term = dict(
            term_q.with_entities(Employee.department, func.count(Employee.id))
            .group_by(Employee.department).all()
        )
        turnover_by_dept = []
        for dept in sorted(set(list(dept_active.keys()) + list(dept_term.keys()))):
            if not dept:
                continue
            a = dept_active.get(dept, 0)
            t = dept_term.get(dept, 0)
            tot = a + t
            rate = round(t / tot * 100, 1) if tot > 0 else 0
            turnover_by_dept.append({"department": dept, "rate": rate, "count": t})
        turnover_by_dept.sort(key=lambda x: x["rate"], reverse=True)

        # Exit reasons
        reason_counts = dict(
            term_q.filter(Employee.termination_reason.isnot(None))
            .with_entities(Employee.termination_reason, func.count(Employee.id))
            .group_by(Employee.termination_reason).all()
        )
        exit_reasons = [
            {"name": k, "value": v}
            for k, v in sorted(reason_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        return {
            "retentionRate": retention_rate,
            "turnoverRate": turnover_rate,
            "voluntaryTurnover": voluntary_rate,
            "involuntaryTurnover": involuntary_rate,
            "avgTenure": avg_tenure,
            "totalActive": active_count,
            "totalTerminated": terminated_count,
            "activeEmployees": active_count,
            "terminatedEmployees": terminated_count,
            "riskDistribution": {
                "high": risk_dist.get('high', 0),
                "medium": risk_dist.get('medium', 0),
                "low": risk_dist.get('low', 0),
            },
            "flightRiskDistribution": [
                {"name": "Low", "value": risk_dist.get('low', 0)},
                {"name": "Medium", "value": risk_dist.get('medium', 0)},
                {"name": "High", "value": risk_dist.get('high', 0)},
            ],
            "flightRiskEmployees": flight_risk_employees,
            "turnoverByDepartment": turnover_by_dept,
            "exitReasons": exit_reasons,
        }

    def get_workforce_planning_metrics(self, org_id: UUID, departments=None):
        # Implementation from main.py
        base_q = self.db.query(Employee).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active)
        if departments:
            base_q = base_q.filter(Employee.department.in_([d.strip() for d in departments.split(',')]))
            
        headcount = base_q.count()
        total_salary = float(self.db.query(func.sum(Employee.salary)).filter(Employee.organization_id == org_id, Employee.status == EmployeeStatus.active).scalar() or 0)
        
        # Simple projection
        # Compute open requisitions as planned hires
        from database.models import JobRequisition, RequisitionStatus
        planned_hires = self.db.query(func.count(JobRequisition.id)).filter(
            JobRequisition.organization_id == org_id,
            JobRequisition.status == RequisitionStatus.open,
        ).scalar() or 0

        projected_headcount = int(headcount * 1.10)  # 10% growth target

        return {
            "current_headcount": headcount,
            "currentHeadcount": headcount,
            "projectedHeadcount": projected_headcount,
            "plannedHires": planned_hires,
            "current_payroll": total_salary,
            "projected_payroll_12m": round(total_salary * 1.15, 2),
        }
