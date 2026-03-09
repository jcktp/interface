from typing import Dict, Any, Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id
from services.query_service import QueryService, QueryValidationError

router = APIRouter(prefix="/api/queries", tags=["Query Editor"])


def _serialize_query(q) -> Dict[str, Any]:
    return {
        "id": str(q.id),
        "name": q.name,
        "description": q.description,
        "sql_query": q.sql_query,
        "is_public": q.is_public,
        "tags": q.tags or [],
        "created_by": str(q.created_by) if q.created_by else None,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "updated_at": q.updated_at.isoformat() if q.updated_at else None,
    }


def _serialize_execution(e) -> Dict[str, Any]:
    return {
        "id": str(e.id),
        "sql_query": e.sql_query,
        "status": e.status,
        "rows_returned": e.rows_returned,
        "execution_time_ms": e.execution_time_ms,
        "error_message": e.error_message,
        "started_at": e.started_at.isoformat() if e.started_at else None,
        "completed_at": e.completed_at.isoformat() if e.completed_at else None,
    }


@router.get("/schema")
async def get_schema(user=Depends(verify_token), db: Session = Depends(get_db)):
    service = QueryService(db)
    schema = service.get_schema()
    return {"status": "success", "schema": schema}


@router.post("/execute")
async def execute_query(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = UUID(user.get("id"))
    sql = data.get("sql", "").strip()
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query is required")

    saved_query_id = data.get("saved_query_id")
    if saved_query_id:
        saved_query_id = UUID(saved_query_id)

    service = QueryService(db)
    result = service.execute_query(org_id, user_id, sql, saved_query_id)
    return {"status": "success", **result}


@router.get("/history")
async def get_history(
    limit: int = Query(20, le=100),
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = UUID(user.get("id"))
    service = QueryService(db)
    history = service.get_execution_history(org_id, user_id, limit=limit)
    return {"status": "success", "history": [_serialize_execution(e) for e in history]}


@router.get("")
async def list_saved_queries(user=Depends(verify_token), db: Session = Depends(get_db)):
    org_id = get_org_id(user)
    user_id = UUID(user.get("id"))
    service = QueryService(db)
    queries = service.get_saved_queries(org_id, user_id)
    return {"status": "success", "queries": [_serialize_query(q) for q in queries]}


@router.post("")
async def save_query(
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    org_id = get_org_id(user)
    user_id = UUID(user.get("id"))
    name = data.get("name", "").strip()
    sql = data.get("sql_query", data.get("sql", "")).strip()

    if not name:
        raise HTTPException(status_code=400, detail="Query name is required")
    if not sql:
        raise HTTPException(status_code=400, detail="SQL query is required")

    service = QueryService(db)
    try:
        query = service.save_query(
            organization_id=org_id,
            user_id=user_id,
            name=name,
            sql=sql,
            description=data.get("description"),
            tags=data.get("tags"),
            is_public=data.get("is_public", False),
        )
        return {"status": "success", "query": _serialize_query(query)}
    except QueryValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{query_id}")
async def update_query(
    query_id: str,
    data: Dict[str, Any],
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    user_id = UUID(user.get("id"))
    service = QueryService(db)
    try:
        updated = service.update_saved_query(UUID(query_id), user_id, data)
        if not updated:
            raise HTTPException(status_code=404, detail="Query not found")
        return {"status": "success", "query": _serialize_query(updated)}
    except QueryValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{query_id}")
async def delete_query(
    query_id: str,
    user=Depends(verify_token),
    db: Session = Depends(get_db),
):
    service = QueryService(db)
    deleted = service.delete_saved_query(UUID(query_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Query not found")
    return {"status": "success"}
