from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id, get_user_id
from services.kpi_service import KPIService
from uuid import UUID

router = APIRouter(prefix="/api/kpis", tags=["KPIs"])

@router.get("/dashboard")
async def get_kpi_dashboard(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = KPIService(db)
    return {"status": "success", "data": service.get_dashboard(org_id)}

@router.get("/definitions")
async def get_kpi_definitions(
    category: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = KPIService(db)
    return {"status": "success", "data": service.get_definitions(org_id, category)}

@router.get("/targets/by-level")
async def get_kpi_targets_by_level(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = KPIService(db)
    return {"status": "success", "data": service.get_targets_by_level(org_id)}


@router.get("/targets")
async def get_kpi_targets(
    kpi_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = KPIService(db)
    return {"status": "success", "data": service.get_targets(org_id, UUID(kpi_id) if kpi_id else None, status)}

@router.post("/definitions")
async def create_kpi_definition(
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    service = KPIService(db)
    definition = service.create_definition(org_id, user_id, data)
    return {"status": "success", "definition": {"id": str(definition.id), "name": definition.name}}


@router.post("/targets")
async def create_kpi_target(
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    service = KPIService(db)
    target = service.create_target(org_id, user_id, data)
    return {"status": "success", "target": {"id": str(target.id)}}


@router.put("/targets/{target_id}")
async def update_kpi_target(
    target_id: str,
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = KPIService(db)
    target = service.update_target(UUID(target_id), org_id, data)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return {"status": "success"}


@router.post("/targets/{target_id}/approve")
async def approve_kpi_target(
    target_id: str,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    service = KPIService(db)
    target = service.approve_target(UUID(target_id), org_id, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return {"status": "success"}


@router.post("/targets/{target_id}/reject")
async def reject_kpi_target(
    target_id: str,
    data: Dict[str, Any] = {},
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    service = KPIService(db)
    target = service.reject_target(UUID(target_id), org_id, user_id, data.get("reason", ""))
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    return {"status": "success"}


@router.post("/calculate")
async def calculate_kpis(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = KPIService(db)
    measurements = service.calculate_measurements(org_id)
    return {"status": "success", "count": len(measurements)}
