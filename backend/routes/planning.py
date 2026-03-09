from typing import Dict, Any, Optional
from datetime import datetime
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database.connection import get_db
from database.models import PlanningPeriod, WorkforcePlan, Employee, EmployeeStatus
from services.auth.security import verify_token, get_org_id, get_user_id

router = APIRouter(prefix="/api/planning", tags=["Planning"])


def _serialize_period(p) -> Dict[str, Any]:
    return {
        "id": str(p.id),
        "name": p.name,
        "description": p.description,
        "start_date": p.start_date.isoformat() if p.start_date else None,
        "end_date": p.end_date.isoformat() if p.end_date else None,
        "status": p.status,
        "period_type": p.period_type or "quarter",
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _serialize_plan(wp) -> Dict[str, Any]:
    return {
        "id": str(wp.id),
        "period_id": str(wp.period_id),
        "department": wp.department,
        "job_family": wp.job_family,
        "location": wp.location,
        "starting_headcount": wp.starting_headcount or 0,
        "planned_hires": wp.planned_hires or 0,
        "planned_attrition": wp.planned_attrition or 0,
        "planned_transfers_in": wp.planned_transfers_in or 0,
        "planned_transfers_out": wp.planned_transfers_out or 0,
        "planned_ending_headcount": wp.planned_ending_headcount or 0,
        "actual_headcount": wp.actual_headcount,
        "actual_hires": wp.actual_hires or 0,
        "actual_attrition": wp.actual_attrition or 0,
        "headcount_variance": wp.headcount_variance,
        "hires_variance": wp.hires_variance,
        "attrition_variance": wp.attrition_variance,
        "avg_salary": wp.avg_salary,
        "total_compensation_budget": wp.total_compensation_budget,
        "notes": wp.notes,
        "last_synced_at": wp.last_synced_at.isoformat() if wp.last_synced_at else None,
    }


@router.get("/periods")
async def list_planning_periods(
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    periods = (
        db.query(PlanningPeriod)
        .filter(PlanningPeriod.organization_id == org_id)
        .order_by(PlanningPeriod.start_date.desc())
        .all()
    )
    return {"status": "success", "periods": [_serialize_period(p) for p in periods]}


@router.post("/periods")
async def create_planning_period(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    name = data.get("name", "").strip()
    start_date = data.get("start_date")
    end_date = data.get("end_date")
    if not name or not start_date or not end_date:
        raise HTTPException(status_code=400, detail="name, start_date, and end_date are required")

    from datetime import date
    period = PlanningPeriod(
        organization_id=org_id,
        name=name,
        description=data.get("description"),
        start_date=date.fromisoformat(start_date),
        end_date=date.fromisoformat(end_date),
        status=data.get("status", "draft"),
        period_type=data.get("period_type", "quarter"),
        created_by=user_id,
    )
    db.add(period)
    db.commit()
    db.refresh(period)
    return {"status": "success", "period": _serialize_period(period)}


@router.put("/periods/{period_id}")
async def update_planning_period(
    period_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    period = db.query(PlanningPeriod).filter(
        PlanningPeriod.id == UUID(period_id),
        PlanningPeriod.organization_id == org_id,
    ).first()
    if not period:
        raise HTTPException(status_code=404, detail="Planning period not found")

    from datetime import date as dt_date
    for field in ("name", "description", "status", "period_type"):
        if field in data:
            setattr(period, field, data[field])
    if "start_date" in data and data["start_date"]:
        period.start_date = dt_date.fromisoformat(data["start_date"])
    if "end_date" in data and data["end_date"]:
        period.end_date = dt_date.fromisoformat(data["end_date"])
    period.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(period)
    return {"status": "success", "period": _serialize_period(period)}


@router.get("/periods/{period_id}")
async def get_planning_period(
    period_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    period = db.query(PlanningPeriod).filter(
        PlanningPeriod.id == UUID(period_id),
        PlanningPeriod.organization_id == org_id,
    ).first()
    if not period:
        raise HTTPException(status_code=404, detail="Planning period not found")
    plans = db.query(WorkforcePlan).filter(WorkforcePlan.period_id == UUID(period_id)).all()
    return {
        "status": "success",
        "period": _serialize_period(period),
        "plans": [_serialize_plan(wp) for wp in plans],
    }


@router.post("/periods/{period_id}/initialize")
async def initialize_period_plans(
    period_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Create one WorkforcePlan per department based on current active headcount."""
    org_id = get_org_id(user)
    period = db.query(PlanningPeriod).filter(
        PlanningPeriod.id == UUID(period_id),
        PlanningPeriod.organization_id == org_id,
    ).first()
    if not period:
        raise HTTPException(status_code=404, detail="Planning period not found")

    # Delete existing plans for this period first
    db.query(WorkforcePlan).filter(WorkforcePlan.period_id == UUID(period_id)).delete()

    # Get current headcount and salary per department
    dept_rows = (
        db.query(
            Employee.department,
            func.count(Employee.id).label("headcount"),
            func.avg(Employee.salary).label("avg_salary"),
        )
        .filter(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
            Employee.department.isnot(None),
        )
        .group_by(Employee.department)
        .all()
    )

    plans_created = 0
    for row in dept_rows:
        hc = row.headcount or 0
        avg_sal = round(float(row.avg_salary or 0), 2)
        # Estimate ~10% planned hires, ~5% planned attrition
        planned_hires = max(1, round(hc * 0.10))
        planned_attrition = max(1, round(hc * 0.05))
        planned_ending = hc + planned_hires - planned_attrition
        wp = WorkforcePlan(
            id=uuid4(),
            period_id=UUID(period_id),
            organization_id=org_id,
            department=row.department,
            starting_headcount=hc,
            planned_hires=planned_hires,
            planned_attrition=planned_attrition,
            planned_transfers_in=0,
            planned_transfers_out=0,
            planned_ending_headcount=planned_ending,
            avg_salary=avg_sal,
            total_compensation_budget=round(planned_ending * avg_sal, 2),
            actual_headcount=hc,
        )
        db.add(wp)
        plans_created += 1

    db.commit()
    return {"status": "success", "plans_created": plans_created}


@router.post("/sync-actuals")
async def sync_actuals(
    period_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Update actual_headcount, actual_hires, actual_attrition from employees table."""
    org_id = get_org_id(user)
    period = db.query(PlanningPeriod).filter(
        PlanningPeriod.id == UUID(period_id),
        PlanningPeriod.organization_id == org_id,
    ).first()
    if not period:
        raise HTTPException(status_code=404, detail="Planning period not found")

    plans = db.query(WorkforcePlan).filter(
        WorkforcePlan.period_id == UUID(period_id),
        WorkforcePlan.organization_id == org_id,
    ).all()

    plans_updated = 0
    for plan in plans:
        if not plan.department:
            continue

        # Count active employees in this dept
        active_hc = db.query(func.count(Employee.id)).filter(
            Employee.organization_id == org_id,
            Employee.department == plan.department,
            Employee.status == EmployeeStatus.active,
        ).scalar() or 0

        # Count hires in this period (hire_date in range)
        actual_hires = db.query(func.count(Employee.id)).filter(
            Employee.organization_id == org_id,
            Employee.department == plan.department,
            Employee.hire_date >= period.start_date,
            Employee.hire_date <= period.end_date,
        ).scalar() or 0

        # Count terminations in this period
        actual_attrition = db.query(func.count(Employee.id)).filter(
            Employee.organization_id == org_id,
            Employee.department == plan.department,
            Employee.status == EmployeeStatus.terminated,
            Employee.termination_date >= period.start_date,
            Employee.termination_date <= period.end_date,
        ).scalar() or 0

        plan.actual_headcount = active_hc
        plan.actual_hires = actual_hires
        plan.actual_attrition = actual_attrition
        plan.headcount_variance = active_hc - (plan.planned_ending_headcount or 0)
        plan.hires_variance = actual_hires - (plan.planned_hires or 0)
        plan.attrition_variance = actual_attrition - (plan.planned_attrition or 0)
        plan.last_synced_at = datetime.utcnow()
        plans_updated += 1

    db.commit()
    return {"status": "success", "plans_updated": plans_updated}


@router.put("/plans/{plan_id}")
async def update_workforce_plan(
    plan_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    plan = db.query(WorkforcePlan).filter(
        WorkforcePlan.id == UUID(plan_id),
        WorkforcePlan.organization_id == org_id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Workforce plan not found")

    for field in (
        "planned_hires", "planned_attrition", "planned_transfers_in",
        "planned_transfers_out", "planned_ending_headcount",
        "avg_salary", "total_compensation_budget", "notes",
    ):
        if field in data:
            setattr(plan, field, data[field])

    plan.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(plan)
    return {"status": "success", "plan": _serialize_plan(plan)}


@router.post("/periods/{period_id}/activate")
async def activate_planning_period(
    period_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    period = db.query(PlanningPeriod).filter(
        PlanningPeriod.id == UUID(period_id),
        PlanningPeriod.organization_id == org_id,
    ).first()
    if not period:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Planning period not found")
    period.status = "active"
    period.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Period activated"}


@router.post("/periods/{period_id}/deactivate")
async def deactivate_planning_period(
    period_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    period = db.query(PlanningPeriod).filter(
        PlanningPeriod.id == UUID(period_id),
        PlanningPeriod.organization_id == org_id,
    ).first()
    if not period:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Planning period not found")
    period.status = "closed"
    period.updated_at = datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Period closed"}


@router.delete("/periods/{period_id}")
async def delete_planning_period(
    period_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    period = db.query(PlanningPeriod).filter(
        PlanningPeriod.id == UUID(period_id),
        PlanningPeriod.organization_id == org_id,
    ).first()
    if not period:
        raise HTTPException(status_code=404, detail="Planning period not found")
    db.delete(period)
    db.commit()
    return {"status": "success"}
