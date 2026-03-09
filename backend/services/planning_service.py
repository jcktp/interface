"""Workforce Planning Service."""

from datetime import datetime, date
from typing import Optional, List
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.models import (
    PlanningPeriod,
    WorkforcePlan,
    WorkforcePlanHistory,
    RequisitionPlanLink,
    PlanningScenario,
    ScenarioAdjustment,
    Employee,
    EmployeeStatus,
)


class PlanningService:
    """Service for workforce planning operations."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Planning Periods ====================

    def create_period(
        self,
        organization_id: str,
        name: str,
        start_date: date,
        end_date: date,
        period_type: str = "quarter",
        description: Optional[str] = None,
        created_by: Optional[str] = None,
    ) -> PlanningPeriod:
        """Create a new planning period."""
        period = PlanningPeriod(
            id=uuid4(),
            organization_id=organization_id,
            name=name,
            description=description,
            start_date=start_date,
            end_date=end_date,
            period_type=period_type,
            status="draft",
            created_by=created_by,
        )
        self.db.add(period)
        self.db.commit()
        return period

    def get_period(self, period_id: str) -> Optional[PlanningPeriod]:
        """Get a planning period by ID."""
        return self.db.query(PlanningPeriod).filter(
            PlanningPeriod.id == period_id
        ).first()

    def get_org_periods(
        self,
        organization_id: str,
        status: Optional[str] = None,
    ) -> List[PlanningPeriod]:
        """Get all planning periods for an organization."""
        query = self.db.query(PlanningPeriod).filter(
            PlanningPeriod.organization_id == organization_id
        )
        if status:
            query = query.filter(PlanningPeriod.status == status)
        return query.order_by(PlanningPeriod.start_date.desc()).all()

    def update_period(
        self,
        period_id: str,
        **updates,
    ) -> PlanningPeriod:
        """Update a planning period."""
        period = self.get_period(period_id)
        if not period:
            raise ValueError("Planning period not found")

        for key, value in updates.items():
            if hasattr(period, key) and value is not None:
                setattr(period, key, value)

        self.db.commit()
        return period

    def activate_period(
        self,
        period_id: str,
        approved_by: str,
    ) -> PlanningPeriod:
        """Activate a planning period."""
        period = self.get_period(period_id)
        if not period:
            raise ValueError("Planning period not found")

        period.status = "active"
        period.approved_by = approved_by
        period.approved_at = datetime.utcnow()
        self.db.commit()
        return period

    def close_period(self, period_id: str) -> PlanningPeriod:
        """Close a planning period."""
        period = self.get_period(period_id)
        if not period:
            raise ValueError("Planning period not found")

        period.status = "closed"
        self.db.commit()
        return period

    # ==================== Workforce Plans ====================

    def create_plan(
        self,
        period_id: str,
        organization_id: str,
        department: str,
        created_by: Optional[str] = None,
        **kwargs,
    ) -> WorkforcePlan:
        """Create a new workforce plan row."""
        plan = WorkforcePlan(
            id=uuid4(),
            period_id=period_id,
            organization_id=organization_id,
            department=department,
            **kwargs,
        )

        # Auto-calculate ending headcount
        plan.planned_ending_headcount = (
            (plan.starting_headcount or 0) +
            (plan.planned_hires or 0) -
            (plan.planned_attrition or 0) +
            (plan.planned_transfers_in or 0) -
            (plan.planned_transfers_out or 0)
        )

        self.db.add(plan)

        # Log history
        if created_by:
            self._log_plan_change(
                plan_id=plan.id,
                changed_by=created_by,
                change_type="created",
                new_values=self._plan_to_dict(plan),
            )

        self.db.commit()
        return plan

    def get_plan(self, plan_id: str) -> Optional[WorkforcePlan]:
        """Get a workforce plan by ID."""
        return self.db.query(WorkforcePlan).filter(
            WorkforcePlan.id == plan_id
        ).first()

    def get_period_plans(
        self,
        period_id: str,
        department: Optional[str] = None,
    ) -> List[WorkforcePlan]:
        """Get all plans for a planning period."""
        query = self.db.query(WorkforcePlan).filter(
            WorkforcePlan.period_id == period_id
        )
        if department:
            query = query.filter(WorkforcePlan.department == department)
        return query.order_by(WorkforcePlan.department).all()

    def update_plan(
        self,
        plan_id: str,
        changed_by: str,
        reason: Optional[str] = None,
        **updates,
    ) -> WorkforcePlan:
        """Update a workforce plan."""
        plan = self.get_plan(plan_id)
        if not plan:
            raise ValueError("Workforce plan not found")

        old_values = self._plan_to_dict(plan)

        for key, value in updates.items():
            if hasattr(plan, key) and value is not None:
                setattr(plan, key, value)

        # Recalculate ending headcount
        plan.planned_ending_headcount = (
            (plan.starting_headcount or 0) +
            (plan.planned_hires or 0) -
            (plan.planned_attrition or 0) +
            (plan.planned_transfers_in or 0) -
            (plan.planned_transfers_out or 0)
        )

        # Calculate variance if actuals exist
        plan.calculate_variance()

        new_values = self._plan_to_dict(plan)

        # Log history
        self._log_plan_change(
            plan_id=plan.id,
            changed_by=changed_by,
            change_type="updated",
            old_values=old_values,
            new_values=new_values,
            reason=reason,
        )

        self.db.commit()
        return plan

    def bulk_update_plans(
        self,
        updates: List[dict],
        changed_by: str,
        reason: Optional[str] = None,
    ) -> List[WorkforcePlan]:
        """Bulk update multiple workforce plans."""
        updated_plans = []
        for update in updates:
            plan_id = update.pop("plan_id", None)
            if plan_id:
                plan = self.update_plan(
                    plan_id=plan_id,
                    changed_by=changed_by,
                    reason=reason,
                    **update,
                )
                updated_plans.append(plan)
        return updated_plans

    def _plan_to_dict(self, plan: WorkforcePlan) -> dict:
        """Convert plan to dictionary for history logging."""
        return {
            "starting_headcount": plan.starting_headcount,
            "planned_hires": plan.planned_hires,
            "planned_attrition": plan.planned_attrition,
            "planned_transfers_in": plan.planned_transfers_in,
            "planned_transfers_out": plan.planned_transfers_out,
            "planned_ending_headcount": plan.planned_ending_headcount,
            "avg_salary": plan.avg_salary,
            "total_compensation_budget": plan.total_compensation_budget,
        }

    def _log_plan_change(
        self,
        plan_id: str,
        changed_by: str,
        change_type: str,
        old_values: Optional[dict] = None,
        new_values: Optional[dict] = None,
        reason: Optional[str] = None,
    ):
        """Log a plan change to history."""
        history = WorkforcePlanHistory(
            id=uuid4(),
            plan_id=plan_id,
            changed_by=changed_by,
            change_type=change_type,
            old_values=old_values,
            new_values=new_values,
            reason=reason,
        )
        self.db.add(history)

    # ==================== Sync Actuals ====================

    def sync_actuals(
        self,
        period_id: str,
        organization_id: str,
    ) -> dict:
        """Sync actual numbers from employee data."""
        period = self.get_period(period_id)
        if not period:
            raise ValueError("Planning period not found")

        plans = self.get_period_plans(period_id)
        updated_count = 0

        for plan in plans:
            # Get current headcount by department
            actual_headcount = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == organization_id,
                Employee.department == plan.department,
                Employee.status == EmployeeStatus.active,
            ).scalar() or 0

            # Get hires in period
            actual_hires = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == organization_id,
                Employee.department == plan.department,
                Employee.hire_date >= period.start_date,
                Employee.hire_date <= period.end_date,
            ).scalar() or 0

            # Get terminations in period
            actual_attrition = self.db.query(func.count(Employee.id)).filter(
                Employee.organization_id == organization_id,
                Employee.department == plan.department,
                Employee.status == EmployeeStatus.terminated,
                Employee.termination_date >= period.start_date,
                Employee.termination_date <= period.end_date,
            ).scalar() or 0

            # Update plan
            plan.actual_headcount = actual_headcount
            plan.actual_hires = actual_hires
            plan.actual_attrition = actual_attrition
            plan.last_synced_at = datetime.utcnow()

            # Calculate variance
            plan.calculate_variance()
            updated_count += 1

        self.db.commit()

        return {
            "status": "success",
            "plans_updated": updated_count,
            "synced_at": datetime.utcnow().isoformat(),
        }

    # ==================== Variance Report ====================

    def get_variance_report(
        self,
        period_id: str,
        organization_id: str,
    ) -> dict:
        """Generate variance report for a planning period."""
        plans = self.get_period_plans(period_id)

        total_planned_hires = sum(p.planned_hires or 0 for p in plans)
        total_actual_hires = sum(p.actual_hires or 0 for p in plans)
        total_planned_attrition = sum(p.planned_attrition or 0 for p in plans)
        total_actual_attrition = sum(p.actual_attrition or 0 for p in plans)
        total_planned_headcount = sum(p.planned_ending_headcount or 0 for p in plans)
        total_actual_headcount = sum(p.actual_headcount or 0 for p in plans)

        by_department = []
        for plan in plans:
            by_department.append({
                "department": plan.department,
                "planned_headcount": plan.planned_ending_headcount,
                "actual_headcount": plan.actual_headcount,
                "headcount_variance": plan.headcount_variance,
                "planned_hires": plan.planned_hires,
                "actual_hires": plan.actual_hires,
                "hires_variance": plan.hires_variance,
                "planned_attrition": plan.planned_attrition,
                "actual_attrition": plan.actual_attrition,
                "attrition_variance": plan.attrition_variance,
            })

        return {
            "summary": {
                "total_planned_headcount": total_planned_headcount,
                "total_actual_headcount": total_actual_headcount,
                "headcount_variance": total_actual_headcount - total_planned_headcount,
                "total_planned_hires": total_planned_hires,
                "total_actual_hires": total_actual_hires,
                "hires_variance": total_actual_hires - total_planned_hires,
                "total_planned_attrition": total_planned_attrition,
                "total_actual_attrition": total_actual_attrition,
                "attrition_variance": total_actual_attrition - total_planned_attrition,
            },
            "by_department": by_department,
        }

    # ==================== Actionable Planning ====================

    def promote_plan_to_requisitions(
        self,
        period_id: str,
        organization_id: str,
    ) -> List[Any]:
        """Convert planned hires from a period into actual open requisitions.
        This makes the planning points "trickle down" into recruitment action.
        """
        from database.models import JobRequisition, RequisitionStatus
        
        period = self.get_period(period_id)
        if not period:
            raise ValueError("Planning period not found")
            
        plans = self.get_period_plans(period_id)
        new_reqs = []
        
        for plan in plans:
            hires_to_create = (plan.planned_hires or 0)
            
            # Check how many reqs are already linked to this plan to avoid duplicates
            linked_reqs_count = self.db.query(func.count(RequisitionPlanLink.id)).filter(
                RequisitionPlanLink.plan_id == plan.id
            ).scalar() or 0
            
            hires_to_create -= linked_reqs_count
            
            if hires_to_create <= 0:
                continue
                
            for i in range(hires_to_create):
                req = JobRequisition(
                    id=uuid4(),
                    organization_id=organization_id,
                    title=f"Planned Hire: {plan.department} - Role {i+1}",
                    department=plan.department,
                    status=RequisitionStatus.open,
                    open_date=date.today(),
                    target_fill_date=period.end_date,
                    salary_min=plan.avg_salary * 0.9 if plan.avg_salary else None,
                    salary_max=plan.avg_salary * 1.1 if plan.avg_salary else None,
                    source_system="workforce_planning",
                    urgency="medium",
                    headcount=1
                )
                self.db.add(req)
                
                # Link the req back to the plan
                link = RequisitionPlanLink(
                    id=uuid4(),
                    requisition_id=req.id,
                    plan_id=plan.id,
                )
                self.db.add(link)
                new_reqs.append(req)
                
        self.db.commit()
        return new_reqs

    # ==================== Initialize Plans ====================

    def initialize_plans_from_headcount(
        self,
        period_id: str,
        organization_id: str,
        created_by: str,
    ) -> List[WorkforcePlan]:
        """Initialize workforce plans based on current headcount by department."""
        # Get current headcount by department
        headcount_by_dept = self.db.query(
            Employee.department,
            func.count(Employee.id).label('count')
        ).filter(
            Employee.organization_id == organization_id,
            Employee.status == EmployeeStatus.active,
        ).group_by(Employee.department).all()

        plans = []
        for dept, count in headcount_by_dept:
            plan = self.create_plan(
                period_id=period_id,
                organization_id=organization_id,
                department=dept,
                starting_headcount=count,
                actual_headcount=count,
                created_by=created_by,
            )
            plans.append(plan)

        return plans

    # ==================== Plan History ====================

    def get_plan_history(
        self,
        plan_id: str,
        limit: int = 50,
    ) -> List[WorkforcePlanHistory]:
        """Get history for a workforce plan."""
        return self.db.query(WorkforcePlanHistory).filter(
            WorkforcePlanHistory.plan_id == plan_id
        ).order_by(WorkforcePlanHistory.created_at.desc()).limit(limit).all()

    # ==================== Scenarios ====================

    def create_scenario(
        self,
        period_id: str,
        organization_id: str,
        name: str,
        description: Optional[str] = None,
        is_baseline: bool = False,
        created_by: Optional[str] = None,
    ) -> PlanningScenario:
        """Create a planning scenario."""
        scenario = PlanningScenario(
            id=uuid4(),
            period_id=period_id,
            organization_id=organization_id,
            name=name,
            description=description,
            is_baseline=is_baseline,
            created_by=created_by,
        )
        self.db.add(scenario)
        self.db.commit()
        return scenario

    def get_period_scenarios(
        self,
        period_id: str,
    ) -> List[PlanningScenario]:
        """Get all scenarios for a planning period."""
        return self.db.query(PlanningScenario).filter(
            PlanningScenario.period_id == period_id
        ).all()

    def add_scenario_adjustment(
        self,
        scenario_id: str,
        plan_id: str,
        **adjustments,
    ) -> ScenarioAdjustment:
        """Add an adjustment to a scenario."""
        adjustment = ScenarioAdjustment(
            id=uuid4(),
            scenario_id=scenario_id,
            plan_id=plan_id,
            **adjustments,
        )
        self.db.add(adjustment)
        self.db.commit()
        return adjustment

    def get_scenario_impact(
        self,
        scenario_id: str,
    ) -> dict:
        """Calculate the impact of a scenario vs baseline."""
        scenario = self.db.query(PlanningScenario).filter(
            PlanningScenario.id == scenario_id
        ).first()

        if not scenario:
            raise ValueError("Scenario not found")

        adjustments = self.db.query(ScenarioAdjustment).filter(
            ScenarioAdjustment.scenario_id == scenario_id
        ).all()

        total_hires_change = sum(a.hires_adjustment or 0 for a in adjustments)
        total_attrition_change = sum(a.attrition_adjustment or 0 for a in adjustments)
        total_budget_change = sum(a.budget_adjustment or 0 for a in adjustments)

        return {
            "scenario_name": scenario.name,
            "total_hires_change": total_hires_change,
            "total_attrition_change": total_attrition_change,
            "net_headcount_change": total_hires_change - total_attrition_change,
            "total_budget_change": total_budget_change,
            "adjustment_count": len(adjustments),
        }
