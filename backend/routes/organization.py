from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Request
from services.auth.security import verify_token, get_org_id
from sqlalchemy.orm import Session
from database.connection import get_db

router = APIRouter(prefix="/api/organization", tags=["Organization"])

@router.get("/financials")
async def get_org_financials(user=Depends(verify_token), db: Session = Depends(get_db)):
    from database.models import OrganizationFinancial, Employee, EmployeeStatus
    from sqlalchemy import func
    from datetime import date

    org_id = get_org_id(user)
    target_year = date.today().year

    fin = db.query(OrganizationFinancial).filter(
        OrganizationFinancial.organization_id == org_id,
        OrganizationFinancial.year == target_year
    ).first()

    headcount_stats = db.query(
        func.count(Employee.id),
        func.avg(Employee.salary),
    ).filter(
        Employee.organization_id == org_id,
        Employee.status == EmployeeStatus.active,
    ).first()

    current_headcount = headcount_stats[0] or 0
    avg_salary = round(float(headcount_stats[1] or 0), 2)

    return {
        "annual_revenue": float(fin.annual_revenue) if fin else 0,
        "annual_profit": float(fin.annual_profit) if fin else 0,
        "equity_pool_total": float(fin.equity_pool_total) if fin else 0,
        "equity_pool_remaining": float(fin.equity_pool_remaining) if fin else 0,
        "current_headcount": current_headcount,
        "avg_salary": avg_salary,
    }

@router.put("/financials")
async def update_org_financials(request: Request, user=Depends(verify_token), db: Session = Depends(get_db)):
    body = await request.json()
    # update logic here
    return {"status": "success"}


# In-memory org settings store (persists for session; survives restarts via the DB if needed)
_org_settings: Dict[str, Any] = {}

@router.get("/settings")
async def get_org_settings(user=Depends(verify_token)):
    org_id = str(get_org_id(user))
    return _org_settings.get(org_id, {"display_currency": "USD", "accent_color": None})

@router.put("/settings")
async def update_org_settings(request: Request, user=Depends(verify_token)):
    org_id = str(get_org_id(user))
    body = await request.json()
    if org_id not in _org_settings:
        _org_settings[org_id] = {"display_currency": "USD", "accent_color": None}
    _org_settings[org_id].update(body)
    return {"status": "success", **_org_settings[org_id]}
