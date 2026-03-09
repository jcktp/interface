from typing import Dict, Any, Optional, List
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException, Request
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id, get_user_id
from services.compensation_service import CompensationService
from pydantic import BaseModel

router = APIRouter(prefix="/api/compensation", tags=["Compensation"])

class CompensationChangeCreate(BaseModel):
    employee_id: str
    change_type: str
    new_salary: float
    effective_date: str
    plan_id: Optional[str] = None
    reason: Optional[str] = None
    new_equity_shares: Optional[float] = None
    new_equity_value: Optional[float] = None

@router.get("/plans")
async def get_compensation_plans(
    period_id: str,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = CompensationService(db)
    return {"status": "success", "plans": service.get_plans_by_period(org_id, UUID(period_id))}

@router.post("/plans/initialize")
async def initialize_compensation_plans(
    period_id: str,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = CompensationService(db)
    plans = service.initialize_plans_from_employees(org_id, UUID(period_id))
    return {"status": "success", "plans_created": len(plans), "count": len(plans)}

@router.post("/sync-actuals")
async def sync_compensation_actuals(
    period_id: str,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = CompensationService(db)
    count = service.sync_actuals_from_employees(org_id, UUID(period_id))
    return {"status": "success", "plans_updated": count}

@router.get("/budget-summary")
async def get_budget_summary(
    period_id: str,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = CompensationService(db)
    return {"status": "success", "data": service.get_budget_summary(org_id, UUID(period_id))}

@router.post("/changes")
async def propose_compensation_change(
    data: CompensationChangeCreate,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    service = CompensationService(db)
    change = service.propose_compensation_change(
        organization_id=org_id,
        employee_id=UUID(data.employee_id),
        change_type=data.change_type,
        new_salary=data.new_salary,
        new_equity_shares=data.new_equity_shares,
        new_equity_value=data.new_equity_value,
        effective_date=date.fromisoformat(data.effective_date),
        proposed_by=user_id,
        plan_id=UUID(data.plan_id) if data.plan_id else None,
        reason=data.reason
    )
    return {"status": "success", "change_id": str(change.id)}

@router.get("/salary-distribution")
async def get_salary_distribution(
    group_by: str = Query("department"),
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = CompensationService(db)
    data = service.get_salary_distribution(org_id, group_by=group_by)
    return {"status": "success", "data": data}


@router.put("/plans/{plan_id}")
async def update_compensation_plan(
    plan_id: str,
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    user_id = get_user_id(user)
    service = CompensationService(db)
    plan = service.update_compensation_plan(UUID(plan_id), data, changed_by=user_id)
    if not plan:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Compensation plan not found")
    return {"status": "success"}


@router.post("/bulk-increase")
async def bulk_salary_increase(
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    org_id = get_org_id(user)
    service = CompensationService(db)
    
    # Extract params
    increase_pct = float(data.get("increase_pct", 0))
    change_type = data.get("change_type", "merit")
    scope = data.get("scope", "company")
    scope_value = data.get("scope_value")
    preview = data.get("preview", False)
    effective_date_str = data.get("effective_date")
    effective_date = date.fromisoformat(effective_date_str) if effective_date_str else None

    result = service.bulk_salary_increase(
        organization_id=org_id,
        increase_pct=increase_pct,
        change_type=change_type,
        scope=scope,
        scope_value=scope_value,
        effective_date=effective_date,
        preview=preview
    )
    
    return {"status": "success", "data": result, **result}
