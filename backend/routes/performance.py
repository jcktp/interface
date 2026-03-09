from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id
from services.performance_service import PerformanceService

router = APIRouter(prefix="/api/performance", tags=["Performance"])

@router.get("/dashboard")
async def get_performance_dashboard(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = PerformanceService(db)
    data = service.get_dashboard_data(org_id, departments, locations, start_date, end_date)
    return {"status": "success", "data": data}

@router.get("/hierarchy")
async def get_performance_hierarchy(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = PerformanceService(db)
    data = service.get_performance_hierarchy(org_id, departments, locations)
    return {"status": "success", "data": data}
