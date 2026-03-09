"""
Compensation Planning Service

Handles compensation planning, budget management, and salary changes.
"""

from datetime import datetime, date
from typing import Optional, List, Dict, Any
from uuid import UUID
import uuid

from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from database.models import (
    CompensationPlan, CompensationChange, CompensationBand,
    CompensationPlanHistory, ExchangeRate, Employee,
    PlanningPeriod, Organization
)


class CompensationService:
    """Service for compensation planning and budget management."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Exchange Rates ====================

    def get_exchange_rate(
        self,
        from_currency: str,
        to_currency: str,
        as_of_date: Optional[date] = None
    ) -> Optional[float]:
        """Get the most recent exchange rate for a currency pair."""
        if from_currency == to_currency:
            return 1.0

        as_of = as_of_date or date.today()

        result = self.db.execute(
            select(ExchangeRate)
            .where(
                ExchangeRate.from_currency == from_currency,
                ExchangeRate.to_currency == to_currency,
                ExchangeRate.effective_date <= as_of
            )
            .order_by(ExchangeRate.effective_date.desc())
            .limit(1)
        ).scalar_one_or_none()

        return result.rate if result else None

    def set_exchange_rate(
        self,
        from_currency: str,
        to_currency: str,
        rate: float,
        effective_date: date,
        source: str = "manual"
    ) -> ExchangeRate:
        """Set or update an exchange rate."""
        # Check if rate exists for this date
        existing = self.db.execute(
            select(ExchangeRate).where(
                ExchangeRate.from_currency == from_currency,
                ExchangeRate.to_currency == to_currency,
                ExchangeRate.effective_date == effective_date
            )
        ).scalar_one_or_none()

        if existing:
            existing.rate = rate
            existing.source = source
            self.db.commit()
            return existing

        exchange_rate = ExchangeRate(
            id=uuid.uuid4(),
            from_currency=from_currency,
            to_currency=to_currency,
            rate=rate,
            effective_date=effective_date,
            source=source
        )
        self.db.add(exchange_rate)
        self.db.commit()
        return exchange_rate

    def get_exchange_rates(
        self,
        base_currency: str = "USD"
    ) -> List[Dict[str, Any]]:
        """Get all current exchange rates relative to base currency."""
        today = date.today()

        # Get distinct currency pairs
        subq = (
            select(
                ExchangeRate.from_currency,
                ExchangeRate.to_currency,
                func.max(ExchangeRate.effective_date).label("max_date")
            )
            .where(ExchangeRate.effective_date <= today)
            .group_by(ExchangeRate.from_currency, ExchangeRate.to_currency)
            .subquery()
        )

        rates = self.db.execute(
            select(ExchangeRate)
            .join(
                subq,
                and_(
                    ExchangeRate.from_currency == subq.c.from_currency,
                    ExchangeRate.to_currency == subq.c.to_currency,
                    ExchangeRate.effective_date == subq.c.max_date
                )
            )
        ).scalars().all()

        return [
            {
                "from_currency": r.from_currency,
                "to_currency": r.to_currency,
                "rate": r.rate,
                "effective_date": r.effective_date.isoformat(),
                "source": r.source
            }
            for r in rates
        ]

    def convert_currency(
        self,
        amount: float,
        from_currency: str,
        to_currency: str,
        as_of_date: Optional[date] = None
    ) -> Optional[float]:
        """Convert an amount from one currency to another."""
        rate = self.get_exchange_rate(from_currency, to_currency, as_of_date)
        if rate is None:
            return None
        return amount * rate

    # ==================== Compensation Plans ====================

    def create_compensation_plan(
        self,
        organization_id: UUID,
        period_id: UUID,
        department: str,
        currency: str = "USD",
        job_level: Optional[str] = None,
        location: Optional[str] = None
    ) -> CompensationPlan:
        """Create a new compensation plan for a department."""
        plan = CompensationPlan(
            id=uuid.uuid4(),
            organization_id=organization_id,
            period_id=period_id,
            department=department,
            job_level=job_level,
            location=location,
            currency=currency,
            base_currency="USD"
        )
        self.db.add(plan)
        self.db.commit()
        return plan

    def get_compensation_plan(self, plan_id: UUID) -> Optional[CompensationPlan]:
        """Get a compensation plan by ID."""
        return self.db.execute(
            select(CompensationPlan).where(CompensationPlan.id == plan_id)
        ).scalar_one_or_none()

    def get_plans_by_period(
        self,
        organization_id: UUID,
        period_id: UUID
    ) -> List[CompensationPlan]:
        """Get all compensation plans for a period."""
        return list(self.db.execute(
            select(CompensationPlan)
            .where(
                CompensationPlan.organization_id == organization_id,
                CompensationPlan.period_id == period_id
            )
            .order_by(CompensationPlan.department)
        ).scalars().all())

    def update_compensation_plan(
        self,
        plan_id: UUID,
        updates: Dict[str, Any],
        changed_by: UUID,
        reason: Optional[str] = None
    ) -> Optional[CompensationPlan]:
        """Update a compensation plan and record history."""
        plan = self.get_compensation_plan(plan_id)
        if not plan:
            return None

        # Record old values
        old_values = {
            "merit_increase_pct": plan.merit_increase_pct,
            "promotion_budget": plan.promotion_budget,
            "market_adjustment_budget": plan.market_adjustment_budget,
            "new_hire_budget": plan.new_hire_budget,
            "equity_budget": plan.equity_budget,
        }

        # Apply updates
        for key, value in updates.items():
            if hasattr(plan, key):
                setattr(plan, key, value)

        # Recalculate budget
        plan.calculate_budget()

        # Normalize to base currency
        self._normalize_plan_currency(plan)

        plan.updated_at = datetime.utcnow()

        # Record history
        history = CompensationPlanHistory(
            id=uuid.uuid4(),
            plan_id=plan_id,
            changed_by=changed_by,
            change_type="updated",
            old_values=old_values,
            new_values=updates,
            reason=reason
        )
        self.db.add(history)
        self.db.commit()

        return plan

    def _normalize_plan_currency(self, plan: CompensationPlan):
        """Normalize plan amounts to base currency."""
        if plan.currency == plan.base_currency:
            plan.planned_budget_base_currency = plan.planned_total_budget
            plan.actual_spend_base_currency = plan.actual_total_spend
            plan.exchange_rate_used = 1.0
        else:
            rate = self.get_exchange_rate(plan.currency, plan.base_currency)
            if rate:
                plan.exchange_rate_used = rate
                plan.exchange_rate_date = date.today()
                if plan.planned_total_budget:
                    plan.planned_budget_base_currency = plan.planned_total_budget * rate
                if plan.actual_total_spend:
                    plan.actual_spend_base_currency = plan.actual_total_spend * rate

    def initialize_plans_from_employees(
        self,
        organization_id: UUID,
        period_id: UUID
    ) -> List[CompensationPlan]:
        """Initialize compensation plans from current employee data."""
        # Get current employee salary data by department
        dept_data = self.db.execute(
            select(
                Employee.department,
                Employee.currency,
                func.count(Employee.id).label("headcount"),
                func.sum(Employee.salary).label("total_salary"),
                func.avg(Employee.salary).label("avg_salary"),
                func.sum(Employee.equity_value).label("total_equity")
            )
            .where(
                Employee.organization_id == organization_id,
                Employee.status == "active"
            )
            .group_by(Employee.department, Employee.currency)
        ).all()

        plans = []
        for row in dept_data:
            plan = CompensationPlan(
                id=uuid.uuid4(),
                organization_id=organization_id,
                period_id=period_id,
                department=row.department,
                currency=row.currency or "USD",
                current_headcount=row.headcount,
                current_total_salary=float(row.total_salary) if row.total_salary else 0,
                current_avg_salary=float(row.avg_salary) if row.avg_salary else 0,
                current_total_equity=float(row.total_equity) if row.total_equity else 0,
                base_currency="USD"
            )
            plan.calculate_budget()
            self._normalize_plan_currency(plan)
            self.db.add(plan)
            plans.append(plan)

        self.db.commit()
        return plans

    def sync_actuals_from_employees(
        self,
        organization_id: UUID,
        period_id: UUID
    ) -> int:
        """Sync actual compensation data from employees."""
        plans = self.get_plans_by_period(organization_id, period_id)
        updated_count = 0

        for plan in plans:
            # Build filters based on plan scope
            filters = [
                Employee.organization_id == organization_id,
                Employee.status == "active"
            ]
            if plan.department:
                filters.append(Employee.department == plan.department)
            if plan.location:
                filters.append(Employee.location == plan.location)
            if plan.job_level:
                filters.append(Employee.job_level == plan.job_level)

            # Get current employee data for this plan's scope
            result = self.db.execute(
                select(
                    func.sum(Employee.salary).label("total_salary"),
                    func.avg(Employee.salary).label("avg_salary"),
                    func.sum(Employee.equity_value).label("total_equity"),
                    func.count(Employee.id).label("headcount")
                )
                .where(and_(*filters))
            ).one()

            if result.headcount > 0:
                plan.current_total_salary = float(result.total_salary) if result.total_salary else 0
                plan.current_avg_salary = float(result.avg_salary) if result.avg_salary else 0
                plan.current_total_equity = float(result.total_equity) if result.total_equity else 0
                plan.current_headcount = result.headcount
                
                # Baseline actual spend if not set
                if not plan.actual_total_spend:
                    plan.actual_total_spend = plan.current_total_salary
                
                self._normalize_plan_currency(plan)
                plan.last_synced_at = datetime.utcnow()
                updated_count += 1

        self.db.commit()
        return updated_count

    def get_budget_summary(
        self,
        organization_id: UUID,
        period_id: UUID
    ) -> Dict[str, Any]:
        """Get a summary of compensation budgets for a period."""
        plans = self.get_plans_by_period(organization_id, period_id)

        # Ensure all aggregates use base currency
        total_current = sum((p.current_total_salary or 0) * (p.exchange_rate_used or 1.0) for p in plans)
        total_planned = sum(p.planned_budget_base_currency or 0 for p in plans)
        total_actual = sum(p.actual_spend_base_currency or 0 for p in plans)
        total_equity = sum(p.equity_budget or 0 for p in plans)

        # Get organization equity pool
        org = self.db.execute(
            select(Organization).where(Organization.id == organization_id)
        ).scalar_one_or_none()

        return {
            "period_id": str(period_id),
            "total_current_salary": total_current,
            "total_planned_budget": total_planned,
            "total_actual_spend": total_actual,
            "total_equity_budget": total_equity,
            "equity_pool_total": org.equity_pool_total if org else 0,
            "equity_pool_remaining": org.equity_pool_remaining if org else 0,
            "budget_variance": total_actual - total_planned if total_actual else None,
            "budget_variance_pct": ((total_actual - total_planned) / total_planned * 100) if total_planned and total_actual else None,
            "plans_count": len(plans),
            "by_department": [
                {
                    "department": p.department,
                    "currency": p.currency,
                    "current_salary": p.current_total_salary,
                    "current_salary_base": (p.current_total_salary or 0) * (p.exchange_rate_used or 1.0),
                    "planned_budget": p.planned_total_budget,
                    "actual_spend": p.actual_total_spend,
                    "equity_budget": p.equity_budget,
                    "planned_budget_base": p.planned_budget_base_currency,
                    "actual_spend_base": p.actual_spend_base_currency,
                    "variance": (p.actual_spend_base_currency - p.planned_budget_base_currency) if p.actual_spend_base_currency and p.planned_budget_base_currency else None
                }
                for p in plans
            ]
        }

    # ==================== Compensation Changes ====================

    def propose_compensation_change(
        self,
        organization_id: UUID,
        employee_id: UUID,
        change_type: str,
        new_salary: float,
        effective_date: date,
        proposed_by: UUID,
        plan_id: Optional[UUID] = None,
        reason: Optional[str] = None,
        new_equity_shares: Optional[float] = None,
        new_equity_value: Optional[float] = None
    ) -> CompensationChange:
        """Propose a salary or equity change for an employee."""
        # Get current salary and equity
        employee = self.db.execute(
            select(Employee).where(Employee.id == employee_id)
        ).scalar_one_or_none()

        if not employee:
            raise ValueError("Employee not found")

        change = CompensationChange(
            id=uuid.uuid4(),
            employee_id=employee_id,
            organization_id=organization_id,
            plan_id=plan_id,
            change_type=change_type,
            current_salary=employee.salary,
            new_salary=new_salary,
            current_equity_shares=employee.equity_shares or 0.0,
            new_equity_shares=new_equity_shares if new_equity_shares is not None else (employee.equity_shares or 0.0),
            current_equity_value=employee.equity_value or 0.0,
            new_equity_value=new_equity_value if new_equity_value is not None else (employee.equity_value or 0.0),
            currency=employee.currency or "USD",
            effective_date=effective_date,
            reason=reason,
            status="proposed",
            proposed_by=proposed_by
        )
        change.calculate_change()
        self.db.add(change)
        self.db.commit()
        return change

    def approve_compensation_change(
        self,
        change_id: UUID,
        approved_by: UUID
    ) -> Optional[CompensationChange]:
        """Approve a proposed compensation change."""
        change = self.db.execute(
            select(CompensationChange).where(CompensationChange.id == change_id)
        ).scalar_one_or_none()

        if not change or change.status != "proposed":
            return None

        change.status = "approved"
        change.approved_by = approved_by
        change.approved_at = datetime.utcnow()
        self.db.commit()
        return change

    def reject_compensation_change(
        self,
        change_id: UUID,
        rejected_by: UUID,
        reason: Optional[str] = None
    ) -> Optional[CompensationChange]:
        """Reject a proposed compensation change."""
        change = self.db.execute(
            select(CompensationChange).where(CompensationChange.id == change_id)
        ).scalar_one_or_none()

        if not change or change.status != "proposed":
            return None

        change.status = "rejected"
        change.approved_by = rejected_by
        change.approved_at = datetime.utcnow()
        if reason:
            change.reason = f"{change.reason or ''}\nRejection reason: {reason}"
        self.db.commit()
        return change

    def apply_compensation_change(
        self,
        change_id: UUID
    ) -> Optional[CompensationChange]:
        """Apply an approved compensation change to the employee."""
        change = self.db.execute(
            select(CompensationChange).where(CompensationChange.id == change_id)
        ).scalar_one_or_none()

        if not change or change.status != "approved":
            return None

        # Update employee salary
        employee = self.db.execute(
            select(Employee).where(Employee.id == change.employee_id)
        ).scalar_one_or_none()

        if employee:
            employee.salary = change.new_salary
            employee.equity_shares = change.new_equity_shares
            employee.equity_value = change.new_equity_value
            employee.updated_at = datetime.utcnow()

        change.status = "applied"
        change.applied_at = datetime.utcnow()
        self.db.commit()
        return change

    def get_pending_changes(
        self,
        organization_id: UUID,
        plan_id: Optional[UUID] = None
    ) -> List[CompensationChange]:
        """Get all pending compensation changes."""
        query = select(CompensationChange).where(
            CompensationChange.organization_id == organization_id,
            CompensationChange.status == "proposed"
        )
        if plan_id:
            query = query.where(CompensationChange.plan_id == plan_id)

        return list(self.db.execute(
            query.order_by(CompensationChange.created_at)
        ).scalars().all())

    def get_changes_by_employee(
        self,
        employee_id: UUID
    ) -> List[CompensationChange]:
        """Get all compensation changes for an employee."""
        return list(self.db.execute(
            select(CompensationChange)
            .where(CompensationChange.employee_id == employee_id)
            .order_by(CompensationChange.created_at.desc())
        ).scalars().all())

    # ==================== Compensation Bands ====================

    def create_compensation_band(
        self,
        organization_id: UUID,
        job_family: str,
        job_level: str,
        min_salary: float,
        mid_salary: float,
        max_salary: float,
        currency: str = "USD",
        location: Optional[str] = None,
        effective_date: Optional[date] = None
    ) -> CompensationBand:
        """Create a compensation band."""
        band = CompensationBand(
            id=uuid.uuid4(),
            organization_id=organization_id,
            job_family=job_family,
            job_level=job_level,
            location=location,
            currency=currency,
            min_salary=min_salary,
            mid_salary=mid_salary,
            max_salary=max_salary,
            effective_date=effective_date or date.today()
        )
        self.db.add(band)
        self.db.commit()
        return band

    def get_compensation_bands(
        self,
        organization_id: UUID,
        job_family: Optional[str] = None,
        job_level: Optional[str] = None
    ) -> List[CompensationBand]:
        """Get compensation bands, optionally filtered."""
        query = select(CompensationBand).where(
            CompensationBand.organization_id == organization_id
        )

        if job_family:
            query = query.where(CompensationBand.job_family == job_family)
        if job_level:
            query = query.where(CompensationBand.job_level == job_level)

        return list(self.db.execute(
            query.order_by(CompensationBand.job_family, CompensationBand.job_level)
        ).scalars().all())

    def get_employee_compa_ratio(
        self,
        employee: Employee
    ) -> Optional[float]:
        """Calculate an employee's compa-ratio (salary / band midpoint)."""
        band = self.db.execute(
            select(CompensationBand)
            .where(
                CompensationBand.organization_id == employee.organization_id,
                CompensationBand.job_level == employee.job_level,
                or_(
                    CompensationBand.location == employee.location,
                    CompensationBand.location.is_(None)
                )
            )
            .order_by(CompensationBand.location.desc().nullslast())
            .limit(1)
        ).scalar_one_or_none()

        if band and band.mid_salary and employee.salary:
            return employee.salary / band.mid_salary

        return None

    # ==================== Analytics ====================

    def get_salary_distribution(
        self,
        organization_id: UUID,
        group_by: str = "department"
    ) -> List[Dict[str, Any]]:
        """Get salary distribution statistics grouped by a dimension."""
        group_column = getattr(Employee, group_by, Employee.department)

        results = self.db.execute(
            select(
                group_column.label("group_value"),
                func.count(Employee.id).label("count"),
                func.min(Employee.salary).label("min_salary"),
                func.max(Employee.salary).label("max_salary"),
                func.avg(Employee.salary).label("avg_salary"),
                func.sum(Employee.salary).label("total_salary")
            )
            .where(
                Employee.organization_id == organization_id,
                Employee.status == "active",
                Employee.salary.isnot(None)
            )
            .group_by(group_column)
            .order_by(group_column)
        ).all()

        return [
            {
                "group": row.group_value,
                "count": row.count,
                "min_salary": float(row.min_salary) if row.min_salary else None,
                "max_salary": float(row.max_salary) if row.max_salary else None,
                "avg_salary": float(row.avg_salary) if row.avg_salary else None,
                "total_salary": float(row.total_salary) if row.total_salary else None
            }
            for row in results
        ]

    def bulk_salary_increase(
        self,
        organization_id: UUID,
        increase_pct: float,
        change_type: str = "merit",
        scope: str = "company",
        scope_value: Optional[str] = None,
        effective_date: Optional[date] = None,
        preview: bool = False
    ) -> Dict[str, Any]:
        """Apply a percentage salary increase to a group of employees and plans."""
        # 1. Identify affected employees
        filters = [
            Employee.organization_id == organization_id,
            Employee.status == "active",
            Employee.salary.isnot(None)
        ]
        if scope == "department" and scope_value:
            filters.append(Employee.department == scope_value)
        elif scope == "location" and scope_value:
            filters.append(Employee.location == scope_value)
        elif scope == "team" and scope_value:
            filters.append(Employee.team == scope_value)

        employees = self.db.execute(
            select(Employee).where(and_(*filters))
        ).scalars().all()

        current_total = sum(e.salary for e in employees)
        cost_increase = current_total * (increase_pct / 100.0)
        new_total = current_total + cost_increase

        if preview:
            return {
                "employees_affected": len(employees),
                "current_total": current_total,
                "new_total": new_total,
                "cost_increase": cost_increase,
            }

        # 2. Update Employee Salaries
        for emp in employees:
            emp.salary = emp.salary * (1 + (increase_pct / 100.0))
            emp.updated_at = datetime.utcnow()

        # 3. Update Compensation Plans (active periods)
        # Find active or draft planning periods
        active_periods = self.db.execute(
            select(PlanningPeriod).where(
                PlanningPeriod.organization_id == organization_id,
                PlanningPeriod.status.in_(["active", "draft"])
            )
        ).scalars().all()

        for period in active_periods:
            plans = self.get_plans_by_period(organization_id, period.id)
            for plan in plans:
                # Only update plans that match the scope
                match = False
                if scope == "company": match = True
                elif scope == "department" and plan.department == scope_value: match = True
                elif scope == "location" and plan.location == scope_value: match = True
                # If plan has no specific scope, it's a dept-wide plan usually
                
                if match:
                    if change_type == "merit":
                        plan.merit_increase_pct = (plan.merit_increase_pct or 0) + increase_pct
                    elif change_type == "market_adjustment":
                        plan.market_adjustment_budget = (plan.market_adjustment_budget or 0) + (plan.current_total_salary * increase_pct / 100.0)
                    elif change_type == "promotion":
                        plan.promotion_budget = (plan.promotion_budget or 0) + (plan.current_total_salary * increase_pct / 100.0)
                    
                    plan.calculate_budget()
                    self._normalize_plan_currency(plan)

        self.db.commit()
        return {
            "employees_affected": len(employees),
            "current_total": current_total,
            "new_total": new_total,
            "cost_increase": cost_increase,
        }
