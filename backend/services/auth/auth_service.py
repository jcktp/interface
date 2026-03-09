from typing import Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from database.models import User, UserRole, Organization
from utils.jwt import verify_password, create_access_token
from .security import verify_token, get_org_id, get_user_id

class AuthService:
    @staticmethod
    def login(db: Session, email: str, password: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            return None, "Invalid email or user is inactive"
        if not verify_password(password, user.password_hash):
            return None, "Invalid password"
        user_data = {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role.value if hasattr(user.role, 'value') else user.role,
            "organization_id": str(user.organization_id) if user.organization_id else None,
            "custom_permissions": user.custom_permissions,
        }
        token = create_access_token(data={"sub": user.email, "org": str(user.organization_id)})
        return {"access_token": token, "user": user_data}, None
