# Settings routes

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from models import SettingsUpdate, SettingsResponse
from utils.config import db
from utils.auth import get_current_user
from datetime import datetime, timezone

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

# ============ GLOBAL STAMP CONFIGURATION ============

class StampConfigRequest(BaseModel):
    stamp_mode: str  # 'spend', 'visit', or 'manual'
    spend_threshold: Optional[float] = 10000  # Amount needed per stamp (only for 'spend' mode)

class StampConfigResponse(BaseModel):
    success: bool
    stamp_mode: Optional[str] = None
    spend_threshold: Optional[float] = None

@router.get("/stamp-config")
async def get_stamp_config(current_user: dict = Depends(get_current_user)):
    """Get the global stamp configuration for the business."""
    config = await db.stamp_config.find_one({}, {"_id": 0})
    if config:
        return StampConfigResponse(
            success=True, 
            stamp_mode=config.get("stamp_mode"),
            spend_threshold=config.get("spend_threshold")
        )
    return StampConfigResponse(success=True, stamp_mode=None, spend_threshold=None)

@router.post("/stamp-config")
async def set_stamp_config(
    request: StampConfigRequest,
    current_user: dict = Depends(get_current_user)
):
    """Set the global stamp configuration for the business. Admin only."""
    valid_modes = ['spend', 'visit', 'manual']
    if request.stamp_mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Modo inválido. Use: {', '.join(valid_modes)}")
    
    await db.stamp_config.update_one(
        {},  # Single global config
        {"$set": {
            "stamp_mode": request.stamp_mode,
            "spend_threshold": request.spend_threshold,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return StampConfigResponse(
        success=True, 
        stamp_mode=request.stamp_mode,
        spend_threshold=request.spend_threshold
    )

# ============ STAMP PROGRESS TRACKING (for spend mode) ============

class StampProgressResponse(BaseModel):
    success: bool
    card_id: str
    accumulated_amount: float
    threshold: float
    progress_percent: float
    stamps_to_add: int

@router.get("/stamp-progress/{card_id}")
async def get_stamp_progress(card_id: str, current_user: dict = Depends(get_current_user)):
    """Get the accumulated progress towards the next stamp for a card."""
    # Get global stamp config
    config = await db.stamp_config.find_one({}, {"_id": 0})
    threshold = config.get("spend_threshold", 10000) if config else 10000
    
    # Get card progress
    progress = await db.stamp_progress.find_one({"card_id": card_id}, {"_id": 0})
    accumulated = progress.get("accumulated_amount", 0) if progress else 0
    
    progress_percent = min(100, (accumulated / threshold) * 100) if threshold > 0 else 0
    
    return StampProgressResponse(
        success=True,
        card_id=card_id,
        accumulated_amount=accumulated,
        threshold=threshold,
        progress_percent=round(progress_percent, 1),
        stamps_to_add=0
    )

@router.post("/stamp-progress/{card_id}/add")
async def add_stamp_progress(
    card_id: str,
    amount: float,
    current_user: dict = Depends(get_current_user)
):
    """Add to the accumulated progress for a stamp card. Returns stamps earned if threshold reached."""
    # Get global stamp config
    config = await db.stamp_config.find_one({}, {"_id": 0})
    if not config or config.get("stamp_mode") != "spend":
        raise HTTPException(status_code=400, detail="Stamp config not set to 'spend' mode")
    
    threshold = config.get("spend_threshold", 10000)
    
    # Get current progress
    progress = await db.stamp_progress.find_one({"card_id": card_id})
    current_accumulated = progress.get("accumulated_amount", 0) if progress else 0
    
    # Add new amount
    new_accumulated = current_accumulated + amount
    
    # Calculate how many stamps earned
    stamps_earned = int(new_accumulated // threshold)
    remaining = new_accumulated % threshold
    
    # Update progress with remaining amount
    await db.stamp_progress.update_one(
        {"card_id": card_id},
        {"$set": {
            "card_id": card_id,
            "accumulated_amount": remaining,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    progress_percent = min(100, (remaining / threshold) * 100) if threshold > 0 else 0
    
    return StampProgressResponse(
        success=True,
        card_id=card_id,
        accumulated_amount=remaining,
        threshold=threshold,
        progress_percent=round(progress_percent, 1),
        stamps_to_add=stamps_earned
    )

@router.delete("/stamp-progress/{card_id}")
async def reset_stamp_progress(card_id: str, current_user: dict = Depends(get_current_user)):
    """Reset the accumulated progress for a card (admin use)."""
    await db.stamp_progress.delete_one({"card_id": card_id})
    return {"success": True, "message": f"Progress reset for card {card_id}"}

# ============ CARD ACCRUAL MODE PREFERENCES (for reward cards) ============

class AccrualModeRequest(BaseModel):
    mode: str  # 'spend', 'visit', or 'points'

class AccrualModeResponse(BaseModel):
    success: bool
    card_id: str
    mode: Optional[str] = None

@router.get("/cards/{card_id}/accrual-mode")
async def get_card_accrual_mode(card_id: str, current_user: dict = Depends(get_current_user)):
    """Get the saved accrual mode preference for a specific card."""
    pref = await db.card_accrual_modes.find_one(
        {"card_id": str(card_id)},
        {"_id": 0}
    )
    if pref:
        return AccrualModeResponse(success=True, card_id=str(card_id), mode=pref.get("mode"))
    return AccrualModeResponse(success=True, card_id=str(card_id), mode=None)

@router.post("/cards/{card_id}/accrual-mode")
async def set_card_accrual_mode(
    card_id: str, 
    request: AccrualModeRequest,
    current_user: dict = Depends(get_current_user)
):
    """Save the accrual mode preference for a specific card."""
    valid_modes = ['spend', 'visit', 'points']
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Modo inválido. Use: {', '.join(valid_modes)}")
    
    await db.card_accrual_modes.update_one(
        {"card_id": str(card_id)},
        {"$set": {
            "card_id": str(card_id),
            "mode": request.mode,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return AccrualModeResponse(success=True, card_id=str(card_id), mode=request.mode)


# ============ DISCOUNT TIER CONFIGURATION ============

class DiscountTier(BaseModel):
    name: str
    threshold: float  # Amount to spend to reach this tier
    percentage: float  # Discount percentage for this tier

class DiscountTiersRequest(BaseModel):
    tiers: List[DiscountTier]

class DiscountTiersResponse(BaseModel):
    success: bool
    tiers: List[dict] = []

@router.get("/discount-tiers")
async def get_discount_tiers(current_user: dict = Depends(get_current_user)):
    """Get the discount tier configuration for the business."""
    config = await db.discount_tiers.find_one({"type": "global"}, {"_id": 0})
    if config and config.get("tiers"):
        return DiscountTiersResponse(success=True, tiers=config["tiers"])
    return DiscountTiersResponse(success=True, tiers=[])

@router.post("/discount-tiers")
async def save_discount_tiers(request: DiscountTiersRequest, current_user: dict = Depends(get_current_user)):
    """Save the discount tier configuration for the business."""
    tiers_data = [t.model_dump() for t in request.tiers]
    # Sort by threshold ascending
    tiers_data.sort(key=lambda x: x["threshold"])
    
    await db.discount_tiers.update_one(
        {"type": "global"},
        {"$set": {
            "type": "global",
            "tiers": tiers_data,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return DiscountTiersResponse(success=True, tiers=tiers_data)
