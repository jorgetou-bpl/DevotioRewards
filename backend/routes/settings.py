# Settings routes

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from models import SettingsUpdate, SettingsResponse
from utils.config import db
from utils.auth import get_current_user

router = APIRouter(tags=["settings"])

@router.get("/settings", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    """Get user settings."""
    settings = await db.settings.find_one({"user_id": current_user["id"]}, {"_id": 0, "user_id": 0})
    return SettingsResponse(**(settings or {}))

@router.put("/settings", response_model=SettingsResponse)
async def update_settings(settings_data: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    """Update user settings."""
    update_data = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    if update_data:
        await db.settings.update_one(
            {"user_id": current_user["id"]}, 
            {"$set": update_data}, 
            upsert=True
        )
    settings = await db.settings.find_one({"user_id": current_user["id"]}, {"_id": 0, "user_id": 0})
    return SettingsResponse(**(settings or {}))

# ============ TEMPLATE ACCRUAL MODE PREFERENCES ============

class AccrualModeRequest(BaseModel):
    mode: str  # 'spend', 'visit', or 'points'

class AccrualModeResponse(BaseModel):
    success: bool
    template_id: str
    mode: Optional[str] = None

@router.get("/templates/{template_id}/accrual-mode")
async def get_template_accrual_mode(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get the saved accrual mode preference for a template."""
    pref = await db.template_accrual_modes.find_one(
        {"template_id": str(template_id)},
        {"_id": 0}
    )
    if pref:
        return AccrualModeResponse(success=True, template_id=str(template_id), mode=pref.get("mode"))
    return AccrualModeResponse(success=True, template_id=str(template_id), mode=None)

@router.post("/templates/{template_id}/accrual-mode")
async def set_template_accrual_mode(
    template_id: str, 
    request: AccrualModeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save the accrual mode preference for a template."""
    valid_modes = ['spend', 'visit', 'points']
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Modo inválido. Use: {', '.join(valid_modes)}")
    
    await db.template_accrual_modes.update_one(
        {"template_id": str(template_id)},
        {"$set": {
            "template_id": str(template_id),
            "mode": request.mode,
            "updated_by": current_user.get("email", ""),
            "updated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
        }},
        upsert=True
    )
    return AccrualModeResponse(success=True, template_id=str(template_id), mode=request.mode)
