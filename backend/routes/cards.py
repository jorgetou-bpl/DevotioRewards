# Card routes - All card-related actions

from fastapi import APIRouter, HTTPException, Depends
import re
import logging
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
    
    if is_phone_number(qr_data):
        logger.info(f"Searching by phone number")
        result = await search_customer_and_get_card('phone', qr_data, current_user, db)
        if result:
            return {"success": True, "card": mask_pii(result)}
        raise HTTPException(status_code=404, detail=get_user_friendly_error("search_no_results"))
    
    if is_email(qr_data):
        logger.info(f"Searching by email")
        result = await search_customer_and_get_card('email', qr_data, current_user, db)
        if result:
            return {"success": True, "card": mask_pii(result)}
        raise HTTPException(status_code=404, detail=get_user_friendly_error("search_no_results"))
    
    card_id = extract_card_id_from_qr(qr_data)
    logger.info(f"Scanning card ID: {card_id}")
    
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
            
            return {"success": True, "card": mask_pii(card_data), "message": success_msg}
        
        error_msg = response.get('message', '')
        if 'Irrelevant accrual type' in str(error_msg):
            logger.info(f"Card {card_id}: {endpoint} not supported, trying next accrual type")
            last_error = error_msg
            continue
        
        user_error = parse_api_error(error_msg)
        raise HTTPException(status_code=response.get('code', 400), detail=user_error)
    
    raise HTTPException(status_code=400, detail=get_user_friendly_error("action_failed", last_error))

@router.post("/cards/{card_id}/subtract-reward")
async def subtract_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract/redeem rewards from stamp cards."""
    gerente_name = action_data.gerente or current_user.get('name', '')
    comment_with_gerente = build_comment_with_gerente(action_data.comment, gerente_name)
    
    payload = {"rewards": int(action_data.amount or 1)}
    if comment_with_gerente:
        payload["comment"] = comment_with_gerente
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-reward', payload)
    card_data = response.get('data', {})
    
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
    
    return {"success": True, "card": mask_pii(card_data), "message": "Recompensa canjeada exitosamente"}

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
    """Add scores/points to reward cards."""
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
    
    await log_operation(
        card_id=card_id,
        operation_type="receive-reward",
        current_user=current_user,
        card_data=card_data,
        amount=action_data.amount or 1,
        note=action_data.comment,
        gerente_override=gerente_name
    )
    
    return {"success": True, "card": mask_pii(card_data), "message": "Recompensa canjeada exitosamente"}
