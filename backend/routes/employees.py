from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import distinct
from database.connection import get_db
from database.models import Employee
from services.auth.security import verify_token, get_org_id
from services.crud import EmployeeCRUD
from uuid import UUID

router = APIRouter(prefix="/api/employees", tags=["Employees"])

@router.get("/departments")
async def list_departments(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    rows = db.query(distinct(Employee.department)).filter(
        Employee.organization_id == org_id,
        Employee.department.isnot(None),
    ).all()
    return {"departments": sorted([r[0] for r in rows if r[0]])}


@router.get("/locations")
async def list_locations(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    rows = db.query(distinct(Employee.location)).filter(
        Employee.organization_id == org_id,
        Employee.location.isnot(None),
    ).all()
    return {"locations": sorted([r[0] for r in rows if r[0]])}


@router.get("")
async def list_employees(
    skip: int = 0,
    limit: int = 50,
    departments: Optional[str] = None,
    locations: Optional[str] = None,
    status: Optional[str] = None,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    # EmployeeCRUD.get_all handles list retrieval
    employees = EmployeeCRUD.get_all(
        db, org_id, skip=skip, limit=limit, 
        department=departments, status=status, location=locations
    )
    total = EmployeeCRUD.get_count(db, org_id, status=status)
    return {"employees": employees, "total": total}

@router.get("/{employee_id}")
async def get_employee(
    employee_id: str,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    try:
        emp = EmployeeCRUD.get_by_id(db, org_id, UUID(employee_id))
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        return emp
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid employee ID format")

@router.post("")
async def create_employee(
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    return EmployeeCRUD.create(db, org_id, data)

@router.put("/{employee_id}")
async def update_employee(
    employee_id: str,
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    try:
        emp = EmployeeCRUD.update(db, org_id, UUID(employee_id), data)
        if not emp:
            raise HTTPException(status_code=404, detail="Employee not found")
        return emp
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid employee ID format")
