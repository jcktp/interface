from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id
from services.ml_service import MLService

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])


def _serialize_model(m) -> Dict[str, Any]:
    return {
        "id": str(m.id),
        "name": m.name,
        "description": m.description,
        "model_type": m.model_type,
        "algorithm": m.algorithm,
        "status": m.status,
        "is_active": m.is_active,
        "hyperparameters": m.hyperparameters,
        "feature_config": m.feature_config,
        "target_column": m.target_column,
        "metrics": m.metrics,
        "feature_importance": m.feature_importance,
        "confusion_matrix": m.confusion_matrix,
        "training_samples": m.training_samples,
        "test_samples": m.test_samples,
        "model_version": m.model_version,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "updated_at": m.updated_at.isoformat() if m.updated_at else None,
        "trained_at": m.trained_at.isoformat() if m.trained_at else None,
        "activated_at": m.activated_at.isoformat() if m.activated_at else None,
    }


def _serialize_job(j) -> Dict[str, Any]:
    return {
        "id": str(j.id),
        "model_id": str(j.model_id),
        "status": j.status,
        "progress": j.progress,
        "current_step": j.current_step,
        "metrics": j.metrics,
        "feature_importance": j.feature_importance,
        "confusion_matrix": j.confusion_matrix,
        "training_logs": j.training_logs,
        "total_samples": j.total_samples,
        "train_samples": j.train_samples,
        "test_samples": j.test_samples,
        "error_message": j.error_message,
        "started_at": j.started_at.isoformat() if j.started_at else None,
        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
        "duration_seconds": j.duration_seconds,
    }


def _serialize_prediction(p) -> Dict[str, Any]:
    return {
        "id": str(p.id),
        "model_id": str(p.model_id),
        "prediction_type": p.prediction_type,
        "input_count": p.input_count,
        "results_summary": p.results_summary,
        "high_risk_count": p.high_risk_count,
        "medium_risk_count": p.medium_risk_count,
        "low_risk_count": p.low_risk_count,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


# ==================== Model CRUD ====================

@router.get("/models")
async def list_models(
    model_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = MLService(db)
    models = service.get_models(org_id, model_type=model_type, status=status)
    return {"status": "success", "models": [_serialize_model(m) for m in models]}


@router.post("/models")
async def create_model(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = UUID(user.get("id"))
    name = data.get("name", "").strip()
    model_type = data.get("model_type", "").strip()
    if not name or not model_type:
        raise HTTPException(status_code=400, detail="name and model_type are required")

    service = MLService(db)
    model = service.create_model(
        organization_id=org_id,
        user_id=user_id,
        name=name,
        model_type=model_type,
        algorithm=data.get("algorithm", "xgboost"),
        description=data.get("description"),
        hyperparameters=data.get("hyperparameters"),
        feature_config=data.get("feature_config"),
    )
    return {"status": "success", "model": _serialize_model(model)}


@router.get("/models/{model_id}")
async def get_model(model_id: str, user=Depends(verify_token), db: Session = Depends(get_db)):
    service = MLService(db)
    model = service.get_model(UUID(model_id))
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"status": "success", "model": _serialize_model(model)}


@router.put("/models/{model_id}")
async def update_model(
    model_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    service = MLService(db)
    model = service.update_model(UUID(model_id), data)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"status": "success", "model": _serialize_model(model)}


@router.delete("/models/{model_id}")
async def delete_model(model_id: str, user=Depends(verify_token), db: Session = Depends(get_db)):
    service = MLService(db)
    deleted = service.delete_model(UUID(model_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"status": "success"}


# ==================== Training ====================

@router.post("/models/{model_id}/train")
async def train_model(
    model_id: str,
    data: Dict[str, Any] = {},
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    user_id = UUID(user.get("id"))
    service = MLService(db)
    try:
        job = service.start_training(UUID(model_id), user_id)
        return {"status": "success", "job": _serialize_job(job)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/models/{model_id}/training-status")
async def get_training_status(
    model_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    service = MLService(db)
    jobs = service.get_training_jobs(UUID(model_id), limit=1)
    if not jobs:
        raise HTTPException(status_code=404, detail="No training jobs found")
    return {"status": "success", "job": _serialize_job(jobs[0])}


@router.post("/models/{model_id}/activate")
async def activate_model(model_id: str, user=Depends(verify_token), db: Session = Depends(get_db)):
    service = MLService(db)
    model = service.activate_model(UUID(model_id))
    if not model:
        raise HTTPException(status_code=400, detail="Model not found or not trained")
    return {"status": "success", "model": _serialize_model(model)}


# ==================== Predictions ====================

@router.post("/models/{model_id}/predict")
async def run_predictions(
    model_id: str,
    data: Dict[str, Any] = {},
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = UUID(user.get("id"))
    service = MLService(db)
    try:
        prediction = service.run_predictions(
            model_id=UUID(model_id),
            organization_id=org_id,
            user_id=user_id,
            prediction_type=data.get("prediction_type", "batch"),
        )
        response = {
            "status": "success", 
            "prediction": _serialize_prediction(prediction),
            "predictions": prediction.results_summary.get("predictions", []),
            "top_risk_factors": prediction.results_summary.get("top_risk_factors", [])
        }
        # Expose projected_headcount at top level so the dashboard can find it
        if prediction.results_summary and prediction.results_summary.get("projected_headcount_6m"):
            response["projected_headcount"] = prediction.results_summary["projected_headcount_6m"]
        return response
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/models/{model_id}/predictions")
async def get_predictions(
    model_id: str,
    limit: int = Query(20, le=100),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    service = MLService(db)
    predictions = service.get_predictions(org_id, model_id=UUID(model_id), limit=limit)
    return {"status": "success", "predictions": [_serialize_prediction(p) for p in predictions]}


# ==================== Employee Risk Scores ====================

@router.get("/models/{model_id}/employee-scores")
async def get_employee_risk_scores(
    model_id: str,
    limit: int = Query(50, le=200),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Return per-employee attrition risk scores for a trained attrition model."""
    from sqlalchemy import select
    from database.models import Employee, MLModel, EmployeeStatus

    org_id = get_org_id(user)
    service = MLService(db)
    model = service.get_model(UUID(model_id))
    if not model or model.model_type != 'attrition':
        raise HTTPException(status_code=400, detail="Model not found or not an attrition model")
    if model.status not in ['trained', 'active']:
        raise HTTPException(status_code=400, detail="Model has not been trained yet")

    employees = db.execute(
        select(Employee).where(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        )
    ).scalars().all()

    scored = []
    for emp in employees:
        risk_score = service._calculate_attrition_risk_score(emp)
        risk_level = "high" if risk_score >= 0.65 else ("medium" if risk_score >= 0.40 else "low")
        scored.append({
            "employee_id": str(emp.id),
            "name": emp.name,
            "department": emp.department,
            "job_level": emp.job_level,
            "tenure": emp.tenure,
            "engagement_score": emp.engagement_score,
            "performance_rating": emp.performance_rating,
            "risk_score": risk_score,
            "risk_level": risk_level,
        })

    scored.sort(key=lambda x: x["risk_score"], reverse=True)
    return {"status": "success", "scores": scored[:limit], "total": len(scored)}


# ==================== Headcount Forecast ====================

@router.get("/models/{model_id}/forecast")
async def get_headcount_forecast(
    model_id: str,
    months: int = Query(12, le=24),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    """Generate a simple headcount forecast for trained headcount/cost models."""
    from sqlalchemy import select, func
    from database.models import Employee, MLModel, EmployeeStatus
    from datetime import date, timedelta
    import math

    org_id = get_org_id(user)
    service = MLService(db)
    model = service.get_model(UUID(model_id))
    if not model or model.status not in ['trained', 'active']:
        raise HTTPException(status_code=400, detail="Model not trained")

    current_headcount = db.execute(
        select(func.count(Employee.id)).where(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        )
    ).scalar() or 0

    avg_salary = db.execute(
        select(func.avg(Employee.salary)).where(
            Employee.organization_id == org_id,
            Employee.status == EmployeeStatus.active,
        )
    ).scalar() or 75000

    # Simple linear growth projection with slight seasonality
    forecast = []
    today = date.today()
    for i in range(1, months + 1):
        target_date = (today.replace(day=1) + timedelta(days=i * 31)).replace(day=1)
        growth_factor = 1 + (0.008 * i)  # ~1% monthly growth
        seasonal = 1 + 0.02 * math.sin(2 * math.pi * target_date.month / 12)
        projected_headcount = int(current_headcount * growth_factor * seasonal)
        projected_cost = round(projected_headcount * avg_salary / 12, 0)
        forecast.append({
            "month": target_date.strftime("%b %Y"),
            "date": target_date.isoformat(),
            "headcount": projected_headcount,
            "lower_bound": int(projected_headcount * 0.92),
            "upper_bound": int(projected_headcount * 1.08),
            "projected_cost": projected_cost,
        })

    return {"status": "success", "current_headcount": current_headcount, "forecast": forecast}


# ==================== Comparison & Config ====================

@router.post("/compare")
async def compare_models(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    model_ids = [UUID(mid) for mid in data.get("model_ids", [])]
    if len(model_ids) < 2:
        raise HTTPException(status_code=400, detail="At least 2 model IDs required")
    service = MLService(db)
    result = service.compare_models(model_ids)
    return {"status": "success", **result}


@router.get("/hyperparameters/{algorithm}")
async def get_hyperparameters(
    algorithm: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    service = MLService(db)
    options = service.get_hyperparameter_options(algorithm)
    if not options:
        raise HTTPException(status_code=404, detail="Algorithm not found")
    return {"status": "success", "options": options, "parameters": options}
