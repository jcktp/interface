from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id
from services.recruitment_service import RecruitmentService

router = APIRouter(prefix="/api/recruitment", tags=["Recruitment"])

@router.get("/quality-of-hire")
async def get_quality_of_hire(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = RecruitmentService(db)
    data = service.get_quality_of_hire(org_id, departments, locations, start_date, end_date)
    return {"status": "success", "data": data}

@router.get("/quality-of-hire/analytics")
async def get_quality_of_hire_analytics(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = RecruitmentService(db)
    data = service.get_quality_of_hire_analytics(org_id, departments, locations, start_date, end_date)
    return {"status": "success", "data": data}

@router.get("/source-analysis")
async def get_source_analysis(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = RecruitmentService(db)
    data = service.get_source_analysis(org_id, departments, locations, start_date, end_date)
    return {"status": "success", "data": data}

@router.get("/cost-per-hire")
async def get_cost_per_hire(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = RecruitmentService(db)
    data = service.get_cost_per_hire(org_id, departments, locations, start_date, end_date)
    return {"status": "success", "data": data}

@router.get("/capacity/scenarios")
async def list_capacity_scenarios(
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    from database.models import RecruitmentCapacityScenario
    org_id = get_org_id(user)
    scenarios = db.query(RecruitmentCapacityScenario).filter(
        RecruitmentCapacityScenario.organization_id == org_id
    ).order_by(RecruitmentCapacityScenario.updated_at.desc()).all()
    return {"status": "success", "data": scenarios}

@router.post("/capacity/scenarios")
async def create_capacity_scenario(
    data: Dict[str, Any],
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    from database.models import RecruitmentCapacityScenario
    from services.auth.security import get_user_id
    org_id = get_org_id(user)
    user_id = get_user_id(user)
    
    scenario = RecruitmentCapacityScenario(
        id=uuid4(),
        organization_id=org_id,
        created_by=user_id,
        **data
    )
    db.add(scenario)
    db.commit()
    db.refresh(scenario)
    return {"status": "success", "data": scenario}

@router.delete("/capacity/scenarios/{scenario_id}")
async def delete_capacity_scenario(
    scenario_id: str,
    user: Dict[str, Any] = Depends(verify_token),
    db: Session = Depends(get_db)
):
    from database.models import RecruitmentCapacityScenario
    org_id = get_org_id(user)
    db.query(RecruitmentCapacityScenario).filter(
        RecruitmentCapacityScenario.id == scenario_id,
        RecruitmentCapacityScenario.organization_id == org_id
    ).delete()
    db.commit()
    return {"status": "success"}

@router.get("/goals")
async def list_goals(year: int = 2026, user=Depends(verify_token), db: Session = Depends(get_db)):
    from database.models import RecruiterGoal
    org_id = get_org_id(user)
    return {"status": "success", "data": db.query(RecruiterGoal).filter(RecruiterGoal.organization_id == org_id, RecruiterGoal.year == year).all()}

recruiter_router = APIRouter(prefix="/api", tags=["Recruiter"])

@recruiter_router.get("/recruiter-goals")
async def get_recruiter_goals(year: int = 2026, user=Depends(verify_token), db: Session = Depends(get_db)):
    from database.models import RecruiterGoal
    org_id = get_org_id(user)
    return {"status": "success", "data": db.query(RecruiterGoal).filter(RecruiterGoal.organization_id == org_id, RecruiterGoal.year == year).all()}

@recruiter_router.put("/recruiter-goals/{goal_id}")
async def update_recruiter_goal(
    goal_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db)
):
    from database.models import RecruiterGoal
    org_id = get_org_id(user)
    goal = db.query(RecruiterGoal).filter(RecruiterGoal.id == goal_id, RecruiterGoal.organization_id == org_id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Recruiter goal not found")
    
    for key, value in data.items():
        if hasattr(goal, key):
            setattr(goal, key, value)
    
    db.commit()
    return {"status": "success"}

@recruiter_router.get("/candidates/pipeline/stats")
async def get_pipeline_stats(
    departments: Optional[str] = Query(None),
    locations: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    from services.crud import CandidateCRUD
    org_id = get_org_id(user)
    pipeline = CandidateCRUD.get_pipeline_stats(db, org_id, departments, locations, start_date, end_date)
    source_effectiveness = CandidateCRUD.get_source_effectiveness(db, org_id, departments, locations, start_date, end_date)
    return {"status": "success", "data": {"pipeline": pipeline, "source_effectiveness": source_effectiveness}}

@recruiter_router.get("/requisitions")
async def list_requisitions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    from database.models import JobRequisition, RequisitionStatus
    org_id = get_org_id(user)
    query = db.query(JobRequisition).filter(JobRequisition.organization_id == org_id)
    if status and status in RequisitionStatus.__members__:
        query = query.filter(JobRequisition.status == RequisitionStatus[status])
    if department:
        query = query.filter(JobRequisition.department == department)
    total = query.count()
    data = query.offset(skip).limit(limit).all()
    return {"status": "success", "data": data, "total": total}

@recruiter_router.get("/candidates")
async def list_candidates(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    from database.models import Candidate, CandidateStatus
    org_id = get_org_id(user)
    query = db.query(Candidate).filter(Candidate.organization_id == org_id)
    if status and status in CandidateStatus.__members__:
        query = query.filter(Candidate.status == CandidateStatus[status])
    if department:
        query = query.filter(Candidate.department == department)
    if source:
        query = query.filter(Candidate.source == source)
    total = query.count()
    data = query.offset(skip).limit(limit).all()
    return {"status": "success", "data": data, "total": total}

