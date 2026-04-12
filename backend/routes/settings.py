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
    """Get the stamp configuration for the user's workspace."""
    ws_id = current_user.get("workspace_id")
    query = {"workspace_id": ws_id} if ws_id else {}
    config = await db.stamp_config.find_one(query, {"_id": 0})
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
    """Set the stamp configuration for the user's workspace."""
    valid_modes = ['spend', 'visit', 'manual']
    if request.stamp_mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Modo inválido. Use: {', '.join(valid_modes)}")
    
    ws_id = current_user.get("workspace_id")
    query = {"workspace_id": ws_id} if ws_id else {}
    await db.stamp_config.update_one(
        query,
        {"$set": {
            "workspace_id": ws_id,
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
    ws_id = current_user.get("workspace_id")
    config_query = {"workspace_id": ws_id} if ws_id else {}
    config = await db.stamp_config.find_one(config_query, {"_id": 0})
    threshold = config.get("spend_threshold", 10000) if config else 10000
    
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
    ws_id = current_user.get("workspace_id")
    config_query = {"workspace_id": ws_id} if ws_id else {}
    config = await db.stamp_config.find_one(config_query, {"_id": 0})
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
            "workspace_id": ws_id,
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
    """Get the discount tier configuration for the user's workspace."""
    ws_id = current_user.get("workspace_id")
    query = {"workspace_id": ws_id} if ws_id else {"type": "global"}
    config = await db.discount_tiers.find_one(query, {"_id": 0})
    if config and config.get("tiers"):
        return DiscountTiersResponse(success=True, tiers=config["tiers"])
    return DiscountTiersResponse(success=True, tiers=[])

@router.post("/discount-tiers")
async def save_discount_tiers(request: DiscountTiersRequest, current_user: dict = Depends(get_current_user)):
    """Save the discount tier configuration for the user's workspace."""
    tiers_data = [t.model_dump() for t in request.tiers]
    tiers_data.sort(key=lambda x: x["threshold"])
    
    ws_id = current_user.get("workspace_id")
    query = {"workspace_id": ws_id} if ws_id else {"type": "global"}
    await db.discount_tiers.update_one(
        query,
        {"$set": {
            "type": "global",
            "workspace_id": ws_id,
            "tiers": tiers_data,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return DiscountTiersResponse(success=True, tiers=tiers_data)


# ============ TIER PROGRESS TRACKING (for discount/cashback cards) ============

class TierProgressResponse(BaseModel):
    success: bool
    card_id: str
    accumulated_amount: float = 0
    current_tier: Optional[str] = None
    next_tier: Optional[str] = None
    next_threshold: Optional[float] = None
    amount_to_next: Optional[float] = None

@router.get("/tier-progress/{card_id}")
async def get_tier_progress(card_id: str, current_user: dict = Depends(get_current_user)):
    """Get accumulated purchase amount for a card (for tier tracking)."""
    progress = await db.tier_progress.find_one({"card_id": str(card_id)}, {"_id": 0})
    accumulated = progress.get("accumulated_amount", 0) if progress else 0
    
    # Get tier config filtered by workspace
    ws_id = current_user.get("workspace_id")
    tier_query = {"workspace_id": ws_id} if ws_id else {"type": "global"}
    config = await db.discount_tiers.find_one(tier_query, {"_id": 0})
    tiers = sorted(config.get("tiers", []), key=lambda x: x["threshold"]) if config else []
    
    current_tier = None
    next_tier = None
    next_threshold = None
    amount_to_next = None
    
    for i in range(len(tiers) - 1, -1, -1):
        if accumulated >= tiers[i]["threshold"]:
            current_tier = tiers[i]["name"]
            if i < len(tiers) - 1:
                next_tier = tiers[i + 1]["name"]
                next_threshold = tiers[i + 1]["threshold"]
                amount_to_next = max(0, tiers[i + 1]["threshold"] - accumulated)
            break
    
    if not current_tier and tiers:
        current_tier = tiers[0]["name"]
        if len(tiers) > 1:
            next_tier = tiers[1]["name"]
            next_threshold = tiers[1]["threshold"]
            amount_to_next = max(0, tiers[1]["threshold"] - accumulated)
    
    return TierProgressResponse(
        success=True,
        card_id=str(card_id),
        accumulated_amount=accumulated,
        current_tier=current_tier,
        next_tier=next_tier,
        next_threshold=next_threshold,
        amount_to_next=amount_to_next
    )

@router.post("/tier-progress/{card_id}/add")
async def add_tier_progress(card_id: str, amount: float, current_user: dict = Depends(get_current_user)):
    """Add a purchase amount to the tier progress tracker."""
    progress = await db.tier_progress.find_one({"card_id": str(card_id)})
    current_amount = progress.get("accumulated_amount", 0) if progress else 0
    new_amount = current_amount + amount
    
    ws_id = current_user.get("workspace_id")
    await db.tier_progress.update_one(
        {"card_id": str(card_id)},
        {"$set": {
            "card_id": str(card_id),
            "workspace_id": ws_id,
            "accumulated_amount": new_amount,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Get tier config filtered by workspace
    tier_query = {"workspace_id": ws_id} if ws_id else {"type": "global"}
    config = await db.discount_tiers.find_one(tier_query, {"_id": 0})
    tiers = sorted(config.get("tiers", []), key=lambda x: x["threshold"]) if config else []
    
    current_tier = None
    next_tier = None
    next_threshold = None
    amount_to_next = None
    
    for i in range(len(tiers) - 1, -1, -1):
        if new_amount >= tiers[i]["threshold"]:
            current_tier = tiers[i]["name"]
            if i < len(tiers) - 1:
                next_tier = tiers[i + 1]["name"]
                next_threshold = tiers[i + 1]["threshold"]
                amount_to_next = max(0, tiers[i + 1]["threshold"] - new_amount)
            break
    
    if not current_tier and tiers:
        current_tier = tiers[0]["name"]
        if len(tiers) > 1:
            next_tier = tiers[1]["name"]
            next_threshold = tiers[1]["threshold"]
            amount_to_next = max(0, tiers[1]["threshold"] - new_amount)
    
    return TierProgressResponse(
        success=True,
        card_id=str(card_id),
        accumulated_amount=new_amount,
        current_tier=current_tier,
        next_tier=next_tier,
        next_threshold=next_threshold,
        amount_to_next=amount_to_next
    )
