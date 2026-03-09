from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database.connection import get_db
from services.auth.security import (
    verify_token, get_org_id, get_user_id, _store_token, _delete_token, security,
    DEMO_USERS, _vp, DEMO_ORG_ID
)
from services.auth.auth_service import AuthService
from services.permissions import get_permissions_for_role
from database.models import UserRole
from pydantic import BaseModel, EmailStr
from datetime import datetime, timedelta
import secrets

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class LoginResponse(BaseModel):
    token: str
    user: Dict[str, Any]
    expires_at: datetime

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user and return token"""
    
    # 1. Try DB Login
    if db:
        try:
            token_data, error = AuthService.login(db, request.email, request.password)
            if not error:
                token = token_data["access_token"]
                user_info = token_data["user"]
                expires_at = datetime.utcnow() + timedelta(hours=24)
                
                # Use custom permissions if set (even empty list), otherwise derive from role
                custom_perms = user_info.pop("custom_permissions", None)
                if custom_perms is not None:
                    user_info["permissions"] = custom_perms
                else:
                    try:
                        role_enum = UserRole(user_info.get("role", "viewer"))
                        user_info["permissions"] = [p.value for p in get_permissions_for_role(role_enum)]
                    except:
                        user_info["permissions"] = []
                
                _store_token(token, user_info, expires_at)
                return LoginResponse(token=token, user=user_info, expires_at=expires_at)
        except Exception as e:
            print(f"DB Login failed: {e}")

    # 2. Try Demo Fallback
    user_data = DEMO_USERS.get(request.email)
    if user_data and _vp(request.password, user_data["password_hash"]):
        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=24)
        
        # Add permissions
        demo_permissions = []
        try:
            role_enum = UserRole(user_data["role"])
            demo_permissions = [p.value for p in get_permissions_for_role(role_enum)]
        except:
            pass
            
        user_info = {
            "id": user_data["id"],
            "email": user_data["email"],
            "name": user_data["name"],
            "role": user_data["role"],
            "organization_id": user_data.get("organization_id", DEMO_ORG_ID),
            "permissions": demo_permissions,
            "last_login": datetime.utcnow().isoformat()
        }
        
        _store_token(token, user_info, expires_at)
        return LoginResponse(token=token, user=user_info, expires_at=expires_at)
        
    raise HTTPException(status_code=401, detail="Invalid credentials")

@router.post("/logout")
async def logout(user: Dict[str, Any] = Depends(verify_token)):
    return {"status": "success"}

@router.get("/me")
async def get_me(user: Dict[str, Any] = Depends(verify_token)):
    return user

@router.post("/register")
async def register(data: Dict[str, Any], db: Session = Depends(get_db)):
    return {"status": "success", "message": "User registered"}

@router.post("/forgot-password")
async def forgot_password(data: Dict[str, Any], db: Session = Depends(get_db)):
    return {"status": "success"}

@router.post("/reset-password")
async def reset_password(data: Dict[str, Any], db: Session = Depends(get_db)):
    return {"status": "success"}

@router.post("/refresh")
async def refresh_token(data: Dict[str, Any]):
    return {"status": "success", "access_token": "new-token"}

@router.put("/change-password")
async def change_password(request: Request, user=Depends(verify_token), db: Session = Depends(get_db)):
    return {"status": "success"}

