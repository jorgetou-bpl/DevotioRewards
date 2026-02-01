# Card routes - All card-related actions

from fastapi import APIRouter, HTTPException, Depends
import re
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional
from models import CardActionRequest, ScanRequest
from utils.auth import get_current_user
from utils.config import db
from utils.boomerang import (
    call_boomerang_api, 
    mask_pii, 
    extract_card_id_from_qr,
    log_operation,
    build_comment_with_gerente,
    get_user_friendly_error,
    parse_api_error
)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["cards"])

# ============ REWARD TRACKING HELPERS ============

async def detect_and_log_new_rewards(
    card_id: str,
    old_rewards_unused: int,
    new_rewards_unused: int,
    card_data: dict,
    template_data: dict = None
):
    """
    Detect if new rewards were earned and log them with timestamps.
    Called after stamp actions to track when rewards are earned.
    """
    rewards_earned = new_rewards_unused - old_rewards_unused
    
    if rewards_earned <= 0:
        return []
    
    # Get customer info
    customer = card_data.get('customer', {})
    customer_name = f"{customer.get('firstName', '')} {customer.get('surname', '')}".strip()
    template_id = card_data.get('templateId', '')
    current_stamps = card_data.get('balance', {}).get('currentNumberOfUses', 0)
    
    # Get reward tiers from template if available
    reward_tiers = []
    if template_data:
        reward_tiers = template_data.get('rewardTiers', [])
    
    # Log each new reward earned
    new_rewards = []
    for i in range(rewards_earned):
        # Try to determine which tier this reward belongs to
        # This is approximate - we use the current stamp count
        threshold = "?"
        if reward_tiers:
            # Find the most likely tier based on current stamps
            for tier in sorted(reward_tiers, key=lambda t: t.get('threshold', 0)):
                tier_threshold = tier.get('threshold', 0)
                if current_stamps >= tier_threshold:
                    threshold = tier_threshold
        
        reward_record = {
            "id": str(uuid.uuid4()),
            "card_id": card_id,
            "customer_name": customer_name,
            "template_id": str(template_id),
            "reward_threshold": threshold,
            "earned_at": datetime.now(timezone.utc).isoformat(),
            "stamps_at_earning": current_stamps,
            "status": "pending",
            "redeemed_at": None,
            "redeemed_by": None,
            "redeemed_value": None,
            "redeemed_note": None
        }
        
        await db.rewards_earned.insert_one(reward_record)
        new_rewards.append(reward_record)
        logger.info(f"Logged new reward earned for card {card_id} at {current_stamps} stamps")
    
    return new_rewards

async def get_pending_rewards(card_id: str):
    """Get all pending (unredeemed) rewards for a card, sorted by earned_at (oldest first)."""
    cursor = db.rewards_earned.find(
        {"card_id": card_id, "status": "pending"},
        {"_id": 0}
    ).sort("earned_at", 1)  # Oldest first
    
    rewards = await cursor.to_list(length=100)
    return rewards

async def redeem_specific_reward(
    reward_id: str,
    gerente_name: str,
    gerente_email: str,
    value: float = None,
    note: str = None
):
    """Mark a specific earned reward as redeemed."""
    result = await db.rewards_earned.update_one(
        {"id": reward_id, "status": "pending"},
        {"$set": {
            "status": "redeemed",
            "redeemed_at": datetime.now(timezone.utc).isoformat(),
            "redeemed_by": gerente_name,
            "redeemed_value": value,
            "redeemed_note": note
        }}
    )
    return result.modified_count > 0

# ============ SEARCH HELPERS ============

def is_phone_number(input_str: str) -> bool:
    """Check if input looks like a phone number."""
    cleaned = re.sub(r'[\s\-\(\)\+]', '', input_str)
    return cleaned.isdigit() and 7 <= len(cleaned) <= 15

def is_card_id(input_str: str) -> bool:
    """Check if input looks like a card ID (format: XXX-XXX-XXX or similar)."""
    return bool(re.match(r'^[\d]+-[\d]+-[\d]+$', input_str.strip()))

def is_email(input_str: str) -> bool:
    """Check if input looks like an email."""
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', input_str.strip()))

async def search_customer_and_get_card(search_type: str, search_value: str, current_user: dict, db):
    """Search for customer by phone/email and return their first card."""
    customers_response = await call_boomerang_api('GET', '/customers', {search_type: search_value})
    
    if customers_response.get('code') != 200:
        return None
    
    customers = customers_response.get('data', [])
    if not customers:
        return None
    
    customer = customers[0]
    customer_id = customer.get('id')
    
    if not customer_id:
        return None
    
    cards_response = await call_boomerang_api('GET', f'/customers/{customer_id}/cards', {})
    
    if cards_response.get('code') != 200:
        return None
    
    cards = cards_response.get('data', [])
    if not cards:
        return None
    
    card = cards[0]
    card_id = card.get('id')
    
    if not card_id:
        return None
    
    card_detail_response = await call_boomerang_api('GET', f'/cards/{card_id}', {})
    
    if card_detail_response.get('code') == 200:
        return card_detail_response.get('data')
    
    return card

# ============ SCAN & GET CARD ============

@router.post("/scan")
async def scan_card(scan_data: ScanRequest, current_user: dict = Depends(get_current_user)):
    """Scan a card by QR data, phone number, or email."""
    qr_data = scan_data.qr_data.strip()
    
    if not qr_data:
        raise HTTPException(status_code=400, detail=get_user_friendly_error("invalid_search"))
    
    # Check for card ID first (format: XXX-XXX-XXX)
    if is_card_id(qr_data):
        card_id = extract_card_id_from_qr(qr_data)
        logger.info(f"Scanning card ID: {card_id}")
        response = await call_boomerang_api('GET', f'/cards/{card_id}', {})
        return {"success": True, "card": mask_pii(response.get('data', {}))}
    
    if is_email(qr_data):
        logger.info(f"Searching by email")
        result = await search_customer_and_get_card('email', qr_data, current_user, db)
        if result:
            return {"success": True, "card": mask_pii(result)}
        raise HTTPException(status_code=404, detail=get_user_friendly_error("search_no_results"))
    
    if is_phone_number(qr_data):
        logger.info(f"Searching by phone number")
        result = await search_customer_and_get_card('phone', qr_data, current_user, db)
        if result:
            return {"success": True, "card": mask_pii(result)}
        raise HTTPException(status_code=404, detail=get_user_friendly_error("search_no_results"))
    
    # Try as card ID anyway
    card_id = extract_card_id_from_qr(qr_data)
    logger.info(f"Scanning card ID (fallback): {card_id}")
    response = await call_boomerang_api('GET', f'/cards/{card_id}', {})
    return {"success": True, "card": mask_pii(response.get('data', {}))}

@router.get("/cards/{card_id}")
async def get_card(card_id: str, current_user: dict = Depends(get_current_user)):
    """Get card details by ID."""
    response = await call_boomerang_api('GET', f'/cards/{card_id}', {})
    return {"success": True, "card": mask_pii(response.get('data', {}))}

# ============ STAMP CARD ACTIONS ============

@router.post("/cards/{card_id}/add-stamp")
async def add_stamp(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add stamps to stamp cards - supports all 3 program types."""
    stamps = action_data.amount or 1
    purchase_sum = action_data.purchaseSum or 0
    original_comment = action_data.comment
    gerente_name = action_data.gerente or current_user.get('name', '')
    
    # Get current card state to detect new rewards
    pre_response = await call_boomerang_api('GET', f'/cards/{card_id}', {}, raise_on_error=False)
    old_rewards_unused = 0
    if pre_response.get('code') == 200:
        old_balance = pre_response.get('data', {}).get('balance', {})
        old_rewards_unused = old_balance.get('numberRewardsUnused', 0)
    
    comment_with_gerente = build_comment_with_gerente(original_comment, gerente_name)
    
    stamp_payload = {"stamps": stamps}
    visit_payload = {"visits": stamps}
    purchase_payload = {"amount": purchase_sum if purchase_sum > 0 else stamps}
    
    for payload in [stamp_payload, visit_payload, purchase_payload]:
        if comment_with_gerente:
            payload["comment"] = comment_with_gerente
        if purchase_sum:
            payload["purchaseSum"] = purchase_sum
    
    endpoints = [
        ('add-stamp', stamp_payload, "Sello agregado exitosamente"),
        ('add-visit', visit_payload, "Visita registrada exitosamente"),
        ('add-purchase', purchase_payload, "Compra registrada exitosamente")
    ]
    
    last_error = None
    for endpoint, payload, success_msg in endpoints:
        response = await call_boomerang_api('POST', f'/cards/{card_id}/{endpoint}', payload, raise_on_error=False)
        
        if response.get('code') == 200:
            card_data = response.get('data', {})
            card_balance = card_data.get('balance', {})
            new_rewards_unused = card_balance.get('numberRewardsUnused', 0)
            
            # Detect and log any new rewards earned
            new_rewards = []
            if new_rewards_unused > old_rewards_unused:
                # Try to get template data for reward tier info
                template_id = card_data.get('templateId')
                template_data = None
                if template_id:
                    template_response = await call_boomerang_api('GET', f'/templates/{template_id}', {}, raise_on_error=False)
                    if template_response.get('code') == 200:
                        template_data = template_response.get('data', {})
                
                new_rewards = await detect_and_log_new_rewards(
                    card_id=card_id,
                    old_rewards_unused=old_rewards_unused,
                    new_rewards_unused=new_rewards_unused,
                    card_data=card_data,
                    template_data=template_data
                )
            
            await log_operation(
                card_id=card_id,
                operation_type=endpoint,
                current_user=current_user,
                card_data=card_data,
                amount=stamps,
                balance=card_balance.get('currentNumberOfUses'),
                purchase_sum=purchase_sum,
                note=original_comment,
                gerente_override=gerente_name
            )
            
            # Include info about new rewards in response
            response_data = {
                "success": True, 
                "card": mask_pii(card_data), 
                "message": success_msg
            }
            
            if new_rewards:
                response_data["new_rewards_earned"] = len(new_rewards)
                response_data["message"] = f"{success_msg} ¡{len(new_rewards)} recompensa(s) ganada(s)!"
            
            return response_data
        
        error_msg = response.get('message', '')
        if 'Irrelevant accrual type' in str(error_msg):
            logger.info(f"Card {card_id}: {endpoint} not supported, trying next accrual type")
            last_error = error_msg
            continue
        
        user_error = parse_api_error(error_msg)
        raise HTTPException(status_code=response.get('code', 400), detail=user_error)
    
    raise HTTPException(status_code=400, detail=get_user_friendly_error("action_failed", last_error))

@router.get("/cards/{card_id}/pending-rewards")
async def get_card_pending_rewards(card_id: str, current_user: dict = Depends(get_current_user)):
    """Get all pending (unredeemed) rewards for a card, sorted oldest first."""
    rewards = await get_pending_rewards(card_id)
    return {
        "success": True,
        "pending_rewards": rewards,
        "count": len(rewards)
    }

@router.post("/cards/{card_id}/subtract-reward")
async def subtract_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """
    Subtract/redeem rewards from stamp cards.
    
    If reward_id is provided, marks that specific earned reward as redeemed.
    If reward_value is provided, stores the value with the redemption.
    """
    gerente_name = action_data.gerente or current_user.get('name', '')
    gerente_email = current_user.get('email', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"rewards": int(action_data.amount or 1)}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-reward', payload)
    card_data = response.get('data', {})
    
    # If a specific reward_id was provided, mark it as redeemed in our tracking
    reward_redeemed = None
    if action_data.reward_id:
        success = await redeem_specific_reward(
            reward_id=action_data.reward_id,
            gerente_name=gerente_name,
            gerente_email=gerente_email,
            value=action_data.reward_value,
            note=action_data.comment
        )
        if success:
            # Fetch the redeemed reward info
            reward_redeemed = await db.rewards_earned.find_one(
                {"id": action_data.reward_id},
                {"_id": 0}
            )
    else:
        # No specific reward_id - try to redeem oldest pending reward
        pending = await get_pending_rewards(card_id)
        if pending:
            oldest = pending[0]
            await redeem_specific_reward(
                reward_id=oldest['id'],
                gerente_name=gerente_name,
                gerente_email=gerente_email,
                value=action_data.reward_value,
                note=action_data.comment
            )
            reward_redeemed = oldest
    
    await log_operation(
        card_id=card_id,
        operation_type="subtract-reward",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('numberRewardsUnused'),
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {
        "success": True, 
        "card": mask_pii(card_data), 
        "message": "Recompensa canjeada exitosamente",
        "reward_redeemed": reward_redeemed
    }

# ============ POINTS/BALANCE ACTIONS ============

@router.post("/cards/{card_id}/add-point")
async def add_points(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add points to cards."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    amount = float(action_data.amount or 1)
    payload = {"points": amount}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    else:
        payload["purchaseSum"] = amount
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-point', payload)
    card_data = response.get('data', {})
    card_type = str(card_data.get('type', '')).lower()
    
    if 'discount' in card_type:
        message = "Descuento aplicado correctamente"
    elif 'cashback' in card_type:
        message = "Cashback agregado exitosamente"
    elif 'gift' in card_type or 'certificate' in card_type:
        message = "Saldo agregado exitosamente"
    else:
        message = "Puntos agregados exitosamente"
    
    await log_operation(
        card_id=card_id,
        operation_type="add-point",
        current_user=current_user,
        card_data=card_data,
        amount=amount,
        balance=card_data.get('balance', {}).get('bonusBalance') or card_data.get('balance', {}).get('balance'),
        purchase_sum=action_data.purchaseSum or amount,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": message}

@router.post("/cards/{card_id}/subtract-point")
async def subtract_point(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract points from certificate/gift/cashback cards."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    amount = float(action_data.amount or 1)
    payload = {"points": amount}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    else:
        payload["purchaseSum"] = amount
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-point', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="subtract-point",
        current_user=current_user,
        card_data=card_data,
        amount=amount,
        balance=card_data.get('balance', {}).get('balance'),
        purchase_sum=action_data.purchaseSum or amount,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Saldo canjeado exitosamente"}

@router.post("/cards/{card_id}/redeem-points")
async def redeem_points(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Redeem points."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"points": action_data.amount or 1}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/redeem-points', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="redeem-points",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('bonusBalance'),
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Puntos canjeados exitosamente"}

# ============ VISIT ACTIONS ============

@router.post("/cards/{card_id}/add-visit")
async def add_visit(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add visits to customer."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"visits": action_data.amount or 1}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-visit', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="add-visit",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('visitsAvailable'),
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Visitas agregadas exitosamente"}

@router.post("/cards/{card_id}/redeem-visit")
async def redeem_visit(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Redeem visits."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"visits": action_data.amount or 1}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/redeem-visit', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="redeem-visit",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('visitsAvailable'),
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Visita canjeada exitosamente"}

@router.post("/cards/{card_id}/subtract-visit")
async def subtract_visit(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Customer uses a visit."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"visits": action_data.amount or 1}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-visit', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="subtract-visit",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('visitsAvailable'),
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Visita utilizada exitosamente"}

# ============ COUPON ACTIONS ============

@router.post("/cards/{card_id}/use-coupon")
async def use_coupon(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Redeem a coupon."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/redeem-coupon', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="use-coupon",
        current_user=current_user,
        card_data=card_data,
        amount=1,
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Cupón canjeado exitosamente"}

# ============ REWARD CARD ACTIONS ============

@router.post("/cards/{card_id}/redeem-reward")
async def redeem_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Redeem reward."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"id": action_data.amount or 1}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/receive-reward', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="redeem-reward",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Recompensa canjeada exitosamente"}

@router.post("/cards/{card_id}/add-reward")
async def add_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add rewards to reward cards."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"rewards": int(action_data.amount or 1)}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-reward', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="add-reward",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('numberRewardsUnused'),
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Recompensas agregadas exitosamente"}

@router.post("/cards/{card_id}/add-scores")
async def add_scores(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add scores/points to reward cards (manual points mode)."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"scores": int(action_data.amount or 1)}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-scores', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="add-scores",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('bonusBalance'),
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Puntos agregados exitosamente"}

@router.post("/cards/{card_id}/add-purchase")
async def add_purchase(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add purchase to reward/stamp cards (spend mode - points calculated by system rules)."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    # For spend mode, the 'amount' field represents the purchase amount
    purchase_amount = action_data.purchaseSum or action_data.amount or 0
    
    payload = {"amount": float(purchase_amount)}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    # purchaseSum is the same as amount in this context
    payload["purchaseSum"] = float(purchase_amount)
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-purchase', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="add-purchase",
        current_user=current_user,
        card_data=card_data,
        amount=purchase_amount,
        balance=card_data.get('balance', {}).get('bonusBalance'),
        purchase_sum=purchase_amount,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Compra registrada exitosamente"}

@router.post("/cards/{card_id}/add-visit-reward")
async def add_visit_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add visit to reward cards (visit mode - points calculated per visit)."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"visits": int(action_data.amount or 1)}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-visit', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="add-visit",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('bonusBalance'),
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Visita registrada exitosamente"}

@router.post("/cards/{card_id}/add-points-auto")
async def add_points_auto(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """
    Auto-detect accrual type for reward cards and call appropriate endpoint.
    Tries add-purchase (spend), add-visit, or add-scores based on template config.
    """
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    # Determine the accrual program from request or try auto-detection
    accrual_program = action_data.accrualProgram
    
    endpoints_to_try = []
    
    if accrual_program == 'spend':
        endpoints_to_try = [('add-purchase', 'amount', float(action_data.purchaseSum or action_data.amount or 0))]
    elif accrual_program == 'visit':
        endpoints_to_try = [('add-visit', 'visits', int(action_data.amount or 1))]
    elif accrual_program == 'points':
        endpoints_to_try = [('add-scores', 'scores', int(action_data.amount or 1))]
    else:
        # Auto-detect: try spend first (most common), then visit, then manual points
        endpoints_to_try = [
            ('add-purchase', 'amount', float(action_data.purchaseSum or action_data.amount or 0)),
            ('add-visit', 'visits', int(action_data.amount or 1)),
            ('add-scores', 'scores', int(action_data.amount or 1))
        ]
    
    last_error = None
    for endpoint, param_name, param_value in endpoints_to_try:
        try:
            payload = {param_name: param_value}
            if comment_with_gerente:
                payload["comment"] = comment_with_gerente
            if action_data.purchaseSum and endpoint != 'add-purchase':
                payload["purchaseSum"] = action_data.purchaseSum
            elif endpoint == 'add-purchase':
                payload["purchaseSum"] = param_value
            
            response = await call_boomerang_api('POST', f'/cards/{card_id}/{endpoint}', payload)
            
            if response.get('code') == 200:
                card_data = response.get('data', {})
                
                await log_operation(
                    card_id=card_id,
                    operation_type=endpoint,
                    current_user=current_user,
                    card_data=card_data,
                    amount=param_value,
                    balance=card_data.get('balance', {}).get('bonusBalance'),
                    purchase_sum=action_data.purchaseSum if endpoint != 'add-purchase' else param_value,
                    note=action_data.comment,
                    gerente_override=gerente_name
                )
                
                # Return detected program type for frontend caching
                program_type = 'spend' if endpoint == 'add-purchase' else ('visit' if endpoint == 'add-visit' else 'points')
                return {
                    "success": True, 
                    "card": mask_pii(card_data), 
                    "message": "Puntos agregados exitosamente",
                    "detectedProgram": program_type
                }
        except HTTPException as e:
            # Check if it's an "irrelevant accrual type" error - continue trying
            if "Irrelevant" in str(e.detail) or e.status_code == 422:
                last_error = e
                continue
            raise e
        except Exception as e:
            last_error = e
            continue
    
    # All attempts failed
    if last_error:
        raise last_error
    raise HTTPException(status_code=400, detail="No se pudo determinar el tipo de acumulación")

@router.post("/cards/{card_id}/detect-accrual-mode")
async def detect_accrual_mode(card_id: str, current_user: dict = Depends(get_current_user)):
    """
    Detect accrual mode for reward cards without making actual transactions.
    Tries each endpoint with zero/minimal value and detects based on error response.
    """
    # Try spend mode first (most common)
    endpoints_to_try = [
        ('add-purchase', {'amount': 0, 'purchaseSum': 0}, 'spend'),
        ('add-visit', {'visits': 0}, 'visit'),
        ('add-scores', {'scores': 0}, 'points')
    ]
    
    for endpoint, payload, mode in endpoints_to_try:
        try:
            # Use a dry-run approach - zero amounts should fail gracefully
            # but the error message will tell us if it's the wrong accrual type
            response = await call_boomerang_api('POST', f'/cards/{card_id}/{endpoint}', payload)
            
            # If it succeeds with zero, this mode is supported
            if response.get('code') == 200:
                return {"success": True, "detectedMode": mode}
                
        except HTTPException as e:
            error_detail = str(e.detail).lower()
            # "Irrelevant accrual type" means wrong mode - try next
            if "irrelevant" in error_detail or "accrual" in error_detail:
                continue
            # Other errors (like "amount must be > 0") mean this mode IS correct
            # but we just need to provide proper values
            if "amount" in error_detail or "must be" in error_detail or "greater" in error_detail:
                return {"success": True, "detectedMode": mode}
        except Exception:
            continue
    
    # Default to spend if all detection attempts fail
    return {"success": True, "detectedMode": "spend"}

@router.post("/cards/{card_id}/subtract-scores")
async def subtract_scores(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract scores/points from cards."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"scores": int(action_data.amount or 1)}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-scores', payload)
    card_data = response.get('data', {})
    
    await log_operation(
        card_id=card_id,
        operation_type="subtract-scores",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        balance=card_data.get('balance', {}).get('bonusBalance'),
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Puntos canjeados exitosamente"}

@router.post("/cards/{card_id}/receive-reward")
async def receive_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Receive/redeem reward from reward cards."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"id": int(action_data.amount or 1)}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/receive-reward', payload)
    card_data = response.get('data', {})
    
    # Log with reward_value as amount (not tier ID), and purchase_sum
    await log_operation(
        card_id=card_id,
        operation_type="receive-reward",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.reward_value or 0,  # Reward monetary value, not tier ID
        purchase_sum=action_data.purchaseSum,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Recompensa canjeada exitosamente"}
