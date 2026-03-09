from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id, get_user_id
from services.attendance_service import AttendanceService

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

@router.get("/summary")
async def get_attendance_summary(
    days: int = 30,
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = AttendanceService(db)
    return service.get_summary(org_id, days, departments, locations, start_date, end_date)

@router.get("/trends")
async def get_attendance_trends(
    period: str = "weekly",
    months: int = 3,
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = AttendanceService(db)
    return service.get_trends(org_id, period, months, departments, locations, start_date, end_date)

@router.get("/hierarchy")
async def get_attendance_hierarchy(
    days: int = 30,
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = AttendanceService(db)
    return service.get_hierarchy(org_id, days, departments, locations, start_date, end_date)

@router.get("/compliance")
async def get_compliance_report(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = AttendanceService(db)
    result = service.get_compliance_report(org_id)
    # result is now {policy_metrics: {...}, report: [...]}
    return result

@router.post("/import")
async def import_attendance(
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = AttendanceService(db)
    return service.import_records(org_id, data.get("records", []))

@router.get("/policy")
async def get_policy(user=Depends(verify_token), db: Session = Depends(get_db)):
    from database.models import AttendancePolicy
    org_id = get_org_id(user)
    return {"status": "success", "data": db.query(AttendancePolicy).filter(AttendancePolicy.organization_id == org_id).first()}

@router.put("/policy")
async def update_policy(data: Dict[str, Any], user=Depends(verify_token), db: Session = Depends(get_db)):
    return {"status": "success"}

@router.get("/countries")
async def list_countries():
    from utils.static_data import COUNTRY_HOLIDAYS
    return {"status": "success", "data": COUNTRY_HOLIDAYS}

@router.get("/holidays/{country_code}")
async def get_holidays(country_code: str):
    from utils.static_data import COUNTRY_HOLIDAYS
    return {"status": "success", "data": COUNTRY_HOLIDAYS.get(country_code, {}).get("holidays", [])}

