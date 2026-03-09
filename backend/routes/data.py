import os
import subprocess
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import verify_token, get_org_id

router = APIRouter(prefix="/api/data", tags=["Data Management"])

@router.post("/restore-snapshot")
async def restore_snapshot(user=Depends(verify_token)):
    """Restores the database from a pre-built SQL snapshot."""
    snapshot_path = "/app/backend/data/snapshot.sql"
    
    if not os.path.exists(snapshot_path):
        raise HTTPException(status_code=404, detail="Snapshot file not found")

    try:
        # Use psql to execute the snapshot
        # Environment variables for PG are usually set in docker-compose
        db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/hr_analytics")
        
        # Command to restore: clear public schema and then run the SQL
        # We wrap it in a command that drops and recreates schema to ensure a clean slate
        cmd = f"psql {db_url} -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' && psql {db_url} < {snapshot_path}"
        
        process = subprocess.Popen(cmd, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        stdout, stderr = process.communicate()

        if process.returncode != 0:
            raise Exception(f"Restore failed: {stderr.decode()}")

        return {"status": "success", "message": "Database restored from snapshot"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    data_type: str = Form("employees"),
    user=Depends(verify_token)
):
    return {"status": "success", "message": f"File {file.filename} uploaded for {data_type}"}

@router.post("/clean")
async def clean_data(data: Dict[str, Any], user=Depends(verify_token)):
    return {"status": "success", "cleaned_data": []}
