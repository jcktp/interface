import os
import json
import secrets
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from utils.jwt import get_password_hash as _gph, verify_password as _vp

security = HTTPBearer(auto_error=False)
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production")

# Redis integration
import redis as _redis
REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
try:
    _redis_client = _redis.from_url(REDIS_URL, decode_responses=True)
    _redis_client.ping()
    REDIS_AVAILABLE = True
except Exception:
    _redis_client = None
    REDIS_AVAILABLE = False

# Fallback store
active_tokens: Dict[str, Dict[str, Any]] = {}
TOKEN_TTL_SECONDS = 24 * 60 * 60

def _store_token(token: str, user_info: dict, expires_at: datetime):
    data = {"user": user_info, "expires_at": expires_at.isoformat()}
    if REDIS_AVAILABLE and _redis_client:
        _redis_client.setex(f"token:{token}", TOKEN_TTL_SECONDS, json.dumps(data))
    else:
        active_tokens[token] = {"user": user_info, "expires_at": expires_at}

def _get_token(token: str) -> Optional[Dict[str, Any]]:
    if REDIS_AVAILABLE and _redis_client:
        raw = _redis_client.get(f"token:{token}")
        if not raw: return None
        data = json.loads(raw)
        data["expires_at"] = datetime.fromisoformat(data["expires_at"])
        return data
    return active_tokens.get(token)

def _delete_token(token: str):
    if REDIS_AVAILABLE and _redis_client:
        _redis_client.delete(f"token:{token}")
    else:
        active_tokens.pop(token, None)

# Deterministic IDs for Demo
DEMO_ORG_ID = "00000000-0000-4000-a000-000000000001"
DEMO_USER_ID_1 = "00000000-0000-4000-a000-000000000010"
DEMO_USER_ID_2 = "00000000-0000-4000-a000-000000000020"

DEMO_USERS = {
    "demo@interface.app": {
        "id": DEMO_USER_ID_1,
        "email": "demo@interface.app",
        "name": "Demo User",
        "password_hash": _gph("demo123"),
        "role": "hr_manager",
        "department": "Human Resources",
        "organization_id": DEMO_ORG_ID,
    },
    "admin@interface.app": {
        "id": DEMO_USER_ID_2,
        "email": "admin@interface.app",
        "name": "Admin User",
        "password_hash": _gph("admin123"),
        "role": "super_admin",
        "department": "Administration",
        "organization_id": DEMO_ORG_ID,
    },
}

def get_org_id(user: Dict[str, Any]):
    from uuid import UUID
    raw = user.get("organization_id") or user.get("id") or DEMO_ORG_ID
    try: return UUID(str(raw))
    except: return UUID(DEMO_ORG_ID)

def get_user_id(user: Dict[str, Any]):
    from uuid import UUID
    raw = user.get("user_id") or user.get("id") or DEMO_USER_ID_2
    try: return UUID(str(raw))
    except: return UUID(DEMO_USER_ID_2)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    token = credentials.credentials
    token_data = _get_token(token)
    if not token_data:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if datetime.utcnow() > token_data["expires_at"]:
        _delete_token(token)
        raise HTTPException(status_code=401, detail="Token expired")
    return token_data["user"]
