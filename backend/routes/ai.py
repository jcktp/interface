import os
from typing import Dict, Any, List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from database.connection import get_db
from database.models import AIConversation
from services.auth.security import verify_token, get_org_id
from services.ai_qa_service import AIQAService

router = APIRouter(prefix="/api/ai", tags=["AI Q&A"])

class AskRequest(BaseModel):
    question: str
    conversation_id: Optional[str] = None

@router.post("/ask")
async def ask_ai(req: AskRequest, user=Depends(verify_token), db: Session = Depends(get_db)):
    org_id = get_org_id(user)
    user_id = UUID(user["id"])
    
    service = AIQAService(db)
    try:
        result = service.ask(
            org_id=org_id,
            user_id=user_id,
            question=req.question,
            conversation_id=UUID(req.conversation_id) if req.conversation_id else None
        )
        return {
            "status": "success",
            "data": result
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI Service error: {str(e)}")

@router.get("/conversations")
async def list_conversations(user=Depends(verify_token), db: Session = Depends(get_db)):
    org_id = get_org_id(user)
    user_id = UUID(user["id"])
    service = AIQAService(db)
    conversations = service.get_conversations(org_id, user_id)
    
    return {
        "status": "success",
        "data": {
            "conversations": conversations
        }
    }

@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: str, user=Depends(verify_token), db: Session = Depends(get_db)):
    org_id = get_org_id(user)
    service = AIQAService(db)
    
    try:
        messages = service.get_messages(UUID(conversation_id), org_id)
        return {
            "status": "success",
            "data": {
                "messages": messages
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user=Depends(verify_token), db: Session = Depends(get_db)):
    org_id = get_org_id(user)
    user_id = UUID(user["id"])
    
    convo = db.query(AIConversation).filter(
        AIConversation.id == conversation_id,
        AIConversation.organization_id == org_id,
        AIConversation.user_id == user_id
    ).first()
    
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(convo)
    db.commit()
    
    return {"status": "success", "message": "Conversation deleted"}
