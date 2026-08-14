# Settings routes

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from models import SettingsUpdate, SettingsResponse
from utils.config import db
from utils.auth import get_current_user, require_super_admin, require_workspace_admin
from datetime import datetime, timezone

router = APIRouter(tags=["settings"])

def resolve_workspace_id(current_user: dict, workspace_id: Optional[str] = None) -> Optional[str]:
    """Resolve which workspace a business-configuration request applies to.
    Only super_admin may target a workspace other than their own — this is
    what lets Devotio configure card settings for a specific client business
    from the Super Admin Dashboard instead of only their own workspace."""
    if workspace_id and current_user.get("role") == "super_admin":
        return workspace_id
    return current_user.get("workspace_id")

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
async def get_stamp_config(workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get the stamp configuration for the user's workspace (or, for
    super_admin, an explicitly targeted workspace)."""
    ws_id = resolve_workspace_id(current_user, workspace_id)
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
    workspace_id: Optional[str] = None,
    current_user: dict = Depends(require_super_admin)
):
    """Set the stamp configuration for a workspace. Devotio-only."""
    valid_modes = ['spend', 'visit', 'manual']
    if request.stamp_mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Modo inválido. Use: {', '.join(valid_modes)}")

    ws_id = resolve_workspace_id(current_user, workspace_id)
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

# ============ GLOBAL REWARD (PUNTOS) ACCRUAL CONFIGURATION ============
# Previously configured per-card on first scan, blocking the operator until a
# choice was made with no way to change it later. Moved to a workspace-level
# setting to match the Sellos pattern — configured once in Config. Tarjetas,
# not decided ad hoc by whoever happens to scan the card first.

class RewardAccrualConfigRequest(BaseModel):
    mode: str  # 'spend', 'visit', or 'points'

class RewardAccrualConfigResponse(BaseModel):
    success: bool
    mode: Optional[str] = None

@router.get("/reward-accrual-config")
async def get_reward_accrual_config(workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get the reward-card accrual mode for the workspace. None means it
    hasn't been configured yet — the scanner blocks accumulation until it is."""
    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id} if ws_id else {}
    config = await db.reward_accrual_config.find_one(query, {"_id": 0})
    return RewardAccrualConfigResponse(success=True, mode=config.get("mode") if config else None)

@router.post("/reward-accrual-config")
async def set_reward_accrual_config(
    request: RewardAccrualConfigRequest,
    workspace_id: Optional[str] = None,
    current_user: dict = Depends(require_super_admin)
):
    """Set the reward-card accrual mode for a workspace. Devotio-only."""
    valid_modes = ['spend', 'visit', 'points']
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Modo inválido. Use: {', '.join(valid_modes)}")

    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id} if ws_id else {}
    await db.reward_accrual_config.update_one(
        query,
        {"$set": {
            "workspace_id": ws_id,
            "mode": request.mode,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return RewardAccrualConfigResponse(success=True, mode=request.mode)

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
    ws_id = current_user.get("workspace_id")
    query = {"card_id": str(card_id)}
    if ws_id:
        query["workspace_id"] = ws_id
    pref = await db.card_accrual_modes.find_one(query, {"_id": 0})
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
    
    ws_id = current_user.get("workspace_id")
    query = {"card_id": str(card_id)}
    if ws_id:
        query["workspace_id"] = ws_id
    await db.card_accrual_modes.update_one(
        query,
        {"$set": {
            "card_id": str(card_id),
            "workspace_id": ws_id,
            "mode": request.mode,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return AccrualModeResponse(success=True, card_id=str(card_id), mode=request.mode)


# ============ DISCOUNT/CASHBACK TIER CONFIGURATION (separate per card type) ============
# Client feedback: "Debe haber una sección de configuración para cada tipo de
# tarjeta por separado. Cashback, Sellos, Puntos, Descuentos" — Cashback and
# Descuento used to share one tier list; each now has its own.

TIER_CARD_TYPES = ['cashback', 'discount']

class DiscountTier(BaseModel):
    name: str
    threshold: float  # Amount to spend to reach this tier
    percentage: float  # Discount/cashback percentage for this tier

class DiscountTiersRequest(BaseModel):
    tiers: List[DiscountTier]

class DiscountTiersResponse(BaseModel):
    success: bool
    card_type: str
    tiers: List[dict] = []

def _validate_tier_card_type(card_type: str) -> None:
    if card_type not in TIER_CARD_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo de tarjeta inválido. Use: {', '.join(TIER_CARD_TYPES)}")

@router.get("/discount-tiers/{card_type}")
async def get_discount_tiers(card_type: str, workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get the tier configuration for 'cashback' or 'discount' cards, for the
    user's workspace (or, for super_admin, an explicitly targeted workspace)."""
    _validate_tier_card_type(card_type)
    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id, "card_type": card_type} if ws_id else {"card_type": card_type}
    config = await db.discount_tiers.find_one(query, {"_id": 0})
    if config and config.get("tiers"):
        return DiscountTiersResponse(success=True, card_type=card_type, tiers=config["tiers"])
    return DiscountTiersResponse(success=True, card_type=card_type, tiers=[])

@router.post("/discount-tiers/{card_type}")
async def save_discount_tiers(card_type: str, request: DiscountTiersRequest, workspace_id: Optional[str] = None, current_user: dict = Depends(require_super_admin)):
    """Save the tier configuration for 'cashback' or 'discount' cards. Devotio-only."""
    _validate_tier_card_type(card_type)
    tiers_data = [t.model_dump() for t in request.tiers]
    tiers_data.sort(key=lambda x: x["threshold"])

    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id, "card_type": card_type} if ws_id else {"card_type": card_type}
    await db.discount_tiers.update_one(
        query,
        {"$set": {
            "card_type": card_type,
            "workspace_id": ws_id,
            "tiers": tiers_data,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return DiscountTiersResponse(success=True, card_type=card_type, tiers=tiers_data)


# ============ TIER PROGRESS TRACKING (for discount/cashback cards) ============

class TierProgressResponse(BaseModel):
    success: bool
    card_id: str
    accumulated_amount: float = 0
    current_tier: Optional[str] = None
    next_tier: Optional[str] = None
    next_threshold: Optional[float] = None
    amount_to_next: Optional[float] = None

def _compute_tier_position(tiers: list, accumulated: float):
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

    return current_tier, next_tier, next_threshold, amount_to_next

@router.get("/tier-progress/{card_id}")
async def get_tier_progress(card_id: str, card_type: str, current_user: dict = Depends(get_current_user)):
    """Get accumulated purchase amount for a card, positioned against its
    card type's own tier list (cashback and discount tiers are separate)."""
    _validate_tier_card_type(card_type)
    progress = await db.tier_progress.find_one({"card_id": str(card_id)}, {"_id": 0})
    accumulated = progress.get("accumulated_amount", 0) if progress else 0

    ws_id = current_user.get("workspace_id")
    tier_query = {"workspace_id": ws_id, "card_type": card_type} if ws_id else {"card_type": card_type}
    config = await db.discount_tiers.find_one(tier_query, {"_id": 0})
    tiers = sorted(config.get("tiers", []), key=lambda x: x["threshold"]) if config else []

    current_tier, next_tier, next_threshold, amount_to_next = _compute_tier_position(tiers, accumulated)

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
async def add_tier_progress(card_id: str, amount: float, card_type: str, current_user: dict = Depends(get_current_user)):
    """Add a purchase amount to the tier progress tracker, positioned against
    the given card type's own tier list."""
    _validate_tier_card_type(card_type)
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

    tier_query = {"workspace_id": ws_id, "card_type": card_type} if ws_id else {"card_type": card_type}
    config = await db.discount_tiers.find_one(tier_query, {"_id": 0})
    tiers = sorted(config.get("tiers", []), key=lambda x: x["threshold"]) if config else []

    current_tier, next_tier, next_threshold, amount_to_next = _compute_tier_position(tiers, new_amount)

    return TierProgressResponse(
        success=True,
        card_id=str(card_id),
        accumulated_amount=new_amount,
        current_tier=current_tier,
        next_tier=next_tier,
        next_threshold=next_threshold,
        amount_to_next=amount_to_next
    )


# ============ COMMENT CONFIGURATION (global — applies to every action) ============

class CommentConfigRequest(BaseModel):
    mode: str  # 'open' or 'invoice_number'

class CommentConfigResponse(BaseModel):
    success: bool
    mode: str = 'open'

@router.get("/comment-config")
async def get_comment_config(workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get the workspace's comment mode. Readable by any authenticated user —
    operators need this to know what the confirmation modal should ask for."""
    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id} if ws_id else {}
    config = await db.comment_config.find_one(query, {"_id": 0})
    return CommentConfigResponse(success=True, mode=config.get("mode", "open") if config else "open")

@router.post("/comment-config")
async def set_comment_config(request: CommentConfigRequest, workspace_id: Optional[str] = None, current_user: dict = Depends(require_super_admin)):
    """Set a workspace's comment mode. Devotio-only."""
    valid_modes = ['open', 'invoice_number']
    if request.mode not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Modo inválido. Use: {', '.join(valid_modes)}")

    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id} if ws_id else {}
    await db.comment_config.update_one(
        query,
        {"$set": {
            "workspace_id": ws_id,
            "mode": request.mode,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return CommentConfigResponse(success=True, mode=request.mode)


# ============ GIFT CARD "AGREGAR" TOGGLE ============

class GiftCardConfigRequest(BaseModel):
    allow_add: bool

class GiftCardConfigResponse(BaseModel):
    success: bool
    allow_add: bool = False

@router.get("/gift-card-config")
async def get_gift_card_config(workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get whether operators can add balance to gift cards. Defaults to False
    (redeem-only) — matches the client's request that adding funds is the
    exception, not the default."""
    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id} if ws_id else {}
    config = await db.gift_card_config.find_one(query, {"_id": 0})
    return GiftCardConfigResponse(success=True, allow_add=config.get("allow_add", False) if config else False)

@router.post("/gift-card-config")
async def set_gift_card_config(request: GiftCardConfigRequest, workspace_id: Optional[str] = None, current_user: dict = Depends(require_super_admin)):
    """Set whether operators can add balance to gift cards for a workspace. Devotio-only."""
    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id} if ws_id else {}
    await db.gift_card_config.update_one(
        query,
        {"$set": {
            "workspace_id": ws_id,
            "allow_add": request.allow_add,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return GiftCardConfigResponse(success=True, allow_add=request.allow_add)

# ============ MINIMUM TRANSACTION AMOUNT (per card type) ============
# Unlike stamp/tier/comment/gift-card config, this is editable by the business's
# own workspace_admin too, not just Devotio — the client asked for direct control
# over their own minimum-purchase policy per card type.

MIN_AMOUNT_CARD_TYPES = ['cashback', 'discount', 'stamp']

class MinAmountRequest(BaseModel):
    min_amount: float

class MinAmountResponse(BaseModel):
    success: bool
    card_type: str
    min_amount: float = 0

def _validate_min_amount_card_type(card_type: str):
    if card_type not in MIN_AMOUNT_CARD_TYPES:
        raise HTTPException(status_code=400, detail=f"Tipo de tarjeta inválido. Use: {', '.join(MIN_AMOUNT_CARD_TYPES)}")

@router.get("/min-amount/{card_type}")
async def get_min_amount(card_type: str, workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get the minimum purchase amount required to accumulate for a card type.
    0 means no minimum is enforced."""
    _validate_min_amount_card_type(card_type)
    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id, "card_type": card_type} if ws_id else {"card_type": card_type}
    config = await db.min_amount_config.find_one(query, {"_id": 0})
    return MinAmountResponse(success=True, card_type=card_type, min_amount=config.get("min_amount", 0) if config else 0)

@router.post("/min-amount/{card_type}")
async def set_min_amount(
    card_type: str,
    request: MinAmountRequest,
    workspace_id: Optional[str] = None,
    current_user: dict = Depends(require_workspace_admin)
):
    """Set the minimum purchase amount for a card type. Business admins and
    Devotio can both configure this — it's the business's own policy call."""
    _validate_min_amount_card_type(card_type)
    if request.min_amount < 0:
        raise HTTPException(status_code=400, detail="El monto mínimo no puede ser negativo")

    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id, "card_type": card_type} if ws_id else {"card_type": card_type}
    await db.min_amount_config.update_one(
        query,
        {"$set": {
            "workspace_id": ws_id,
            "card_type": card_type,
            "min_amount": request.min_amount,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return MinAmountResponse(success=True, card_type=card_type, min_amount=request.min_amount)

# ============ HIGH-AMOUNT ALERT THRESHOLD ============
# A soft warning, not a block — helps catch operator data-entry mistakes
# (e.g. an extra zero) before a large amount gets accumulated.

DEFAULT_HIGH_AMOUNT_THRESHOLD = 1000000

class HighAmountAlertRequest(BaseModel):
    threshold: float

class HighAmountAlertResponse(BaseModel):
    success: bool
    threshold: float = DEFAULT_HIGH_AMOUNT_THRESHOLD

@router.get("/high-amount-alert-config")
async def get_high_amount_alert_config(workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get the purchase amount that triggers a confirmation warning before accepting it."""
    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id} if ws_id else {}
    config = await db.high_amount_alert_config.find_one(query, {"_id": 0})
    threshold = config.get("threshold", DEFAULT_HIGH_AMOUNT_THRESHOLD) if config else DEFAULT_HIGH_AMOUNT_THRESHOLD
    return HighAmountAlertResponse(success=True, threshold=threshold)

@router.post("/high-amount-alert-config")
async def set_high_amount_alert_config(
    request: HighAmountAlertRequest,
    workspace_id: Optional[str] = None,
    current_user: dict = Depends(require_workspace_admin)
):
    """Set the high-amount alert threshold. Business admins and Devotio can both configure this."""
    if request.threshold <= 0:
        raise HTTPException(status_code=400, detail="El umbral debe ser mayor a 0")

    ws_id = resolve_workspace_id(current_user, workspace_id)
    query = {"workspace_id": ws_id} if ws_id else {}
    await db.high_amount_alert_config.update_one(
        query,
        {"$set": {
            "workspace_id": ws_id,
            "threshold": request.threshold,
            "updated_by": current_user.get("email", ""),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    return HighAmountAlertResponse(success=True, threshold=request.threshold)
