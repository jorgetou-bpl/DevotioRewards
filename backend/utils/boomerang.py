# Boomerang API utilities

import httpx
import logging
import re
from datetime import datetime, timezone
import uuid
from .config import db, BOOMERANG_API_BASE, BOOMERANG_API_KEY

logger = logging.getLogger(__name__)

async def get_workspace_api_key(user: dict) -> str:
    """Get the Boomerangme API key for the user's workspace. Falls back to global key."""
    workspace_id = user.get("workspace_id")
    if workspace_id:
        ws = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "boomerangme_api_key": 1})
        if ws and ws.get("boomerangme_api_key"):
            return ws["boomerangme_api_key"]
    return BOOMERANG_API_KEY


# ============ ERROR HANDLING ============

SUPPORT_MESSAGE = "Por favor contacte al administrador de Devotio Rewards para asistencia."

def get_user_friendly_error(error_type: str, technical_error: str = None) -> str:
    """Return user-friendly error messages without exposing API details."""
    if technical_error:
        logger.error(f"Technical error ({error_type}): {technical_error}")
    
    error_messages = {
        "card_not_found": "Tarjeta no encontrada. Verifique el código e intente nuevamente.",
        "invalid_card": "Esta tarjeta no es válida o ha expirado.",
        "action_failed": "No se pudo completar la acción. Por favor intente nuevamente.",
        "insufficient_balance": "Saldo insuficiente para completar esta operación.",
        "already_redeemed": "Esta recompensa ya fue canjeada.",
        "expired_card": "Esta tarjeta ha expirado.",
        "blocked_card": "Esta tarjeta está bloqueada. " + SUPPORT_MESSAGE,
        "checkin_limit": "Límite de check-in diario alcanzado",
        "api_error": "Error de conexión. Por favor intente nuevamente.",
        "general_error": "Ocurrió un error. Por favor intente nuevamente.",
        "search_no_results": "No se encontró ninguna tarjeta. Verifique los datos e intente nuevamente.",
        "invalid_search": "Ingrese un ID de tarjeta válido, número de teléfono o email."
    }
    return error_messages.get(error_type, error_messages["general_error"])

def parse_api_error(error_message: str) -> str:
    """Parse Boomerang API error and return user-friendly message."""
    if not error_message:
        return get_user_friendly_error("general_error")
    
    error_lower = error_message.lower()
    
    if "not found" in error_lower or "no encontrado" in error_lower:
        return get_user_friendly_error("card_not_found")
    if "insufficient" in error_lower or "insuficiente" in error_lower:
        return get_user_friendly_error("insufficient_balance")
    if "expired" in error_lower or "expirad" in error_lower:
        return get_user_friendly_error("expired_card")
    if "blocked" in error_lower or "bloqueado" in error_lower:
        return get_user_friendly_error("blocked_card")
    # Check daily limit BEFORE "already redeemed" since Boomerangme returns
    # "A visit has already been registered today" for daily limits
    if "limit" in error_lower or "check-in" in error_lower or "checkin" in error_lower or "daily" in error_lower or "today" in error_lower or "already been registered" in error_lower:
        return get_user_friendly_error("checkin_limit")
    if "already" in error_lower or "ya" in error_lower:
        return get_user_friendly_error("already_redeemed")
    
    return get_user_friendly_error("action_failed")

# ============ PII MASKING ============

def mask_pii(data: dict) -> dict:
    """Mask personally identifiable information from card data."""
    if not data:
        return data
    
    masked = data.copy()
    
    if 'customer' in masked and masked['customer']:
        customer = masked['customer'].copy()
        if 'email' in customer:
            customer['email'] = '***@***.***'
        if 'phone' in customer:
            customer['phone'] = '***-****'
        masked['customer'] = customer
    
    return masked

# ============ API HELPERS ============

def extract_card_id_from_qr(qr_data: str) -> str:
    """Extract card ID from QR code data."""
    if 'boomerangme' in qr_data.lower() or 'digitalwallet' in qr_data.lower():
        patterns = [r'/cards?/([a-zA-Z0-9-]+)', r'card_id=([a-zA-Z0-9-]+)', r'/([0-9]+-[0-9]+-[0-9]+)']
        for pattern in patterns:
            match = re.search(pattern, qr_data)
            if match:
                return match.group(1)
    return qr_data.strip()

# ============ OPERATION LOGGING ============

OPERATION_TYPES = {
    "add-stamp": "Sellos agregados",
    "add-visit": "Visita registrada",
    "add-purchase": "Compra registrada",
    "subtract-reward": "Recompensa canjeada",
    "add-point": "Puntos agregados",
    "redeem-reward": "Recompensa canjeada",
    "redeem-points": "Puntos canjeados",
    "subtract-point": "Saldo canjeado",
    "use-coupon": "Cupón canjeado",
    "redeem-visit": "Visita canjeada",
    "subtract-visit": "Visita utilizada",
    "add-reward": "Recompensas agregadas",
    "add-scores": "Puntos agregados",
    "subtract-scores": "Puntos canjeados",
    "receive-reward": "Recompensa recibida",
}

# Card type labels in Spanish
CARD_TYPE_LABELS = {
    "stamp": "Sellos",
    "stamp_card": "Sellos",
    "reward": "Recompensas",
    "reward_card": "Recompensas",
    "cashback": "Cashback",
    "cashback_card": "Cashback",
    "discount": "Descuento",
    "discount_card": "Descuento",
    "certificate": "Certificado",
    "certificate_card": "Certificado",
    "gift": "Regalo",
    "gift_card": "Regalo",
    "coupon": "Cupón",
    "coupon_card": "Cupón",
    "membership": "Membresía",
    "membership_card": "Membresía",
    "multipass": "Multipase",
    "multipass_card": "Multipase",
    "subscription": "Suscripción",
    "subscription_card": "Suscripción",
}

async def log_operation(
    card_id: str,
    operation_type: str,
    current_user: dict,
    card_data: dict = None,
    amount: float = None,
    balance: float = None,
    purchase_sum: float = None,
    note: str = None,
    gerente_override: str = None,
    redeemed_value: float = None  # NEW: Optional value for reward redemptions
):
    """Log an operation to local database with full details for reporting."""
    try:
        customer = card_data.get('customer', {}) if card_data else {}
        customer_name = f"{customer.get('firstName', '')} {customer.get('surname', '')}".strip()
        customer_phone = customer.get('phone', '')
        
        device = card_data.get('device', 'Unknown') if card_data else 'Unknown'
        template_id = card_data.get('templateId', '') if card_data else ''
        
        # Get card type from card_data
        card_type_raw = card_data.get('type', 'unknown') if card_data else 'unknown'
        card_type = str(card_type_raw).lower().replace('_card', '').replace(' ', '_')
        card_type_label = CARD_TYPE_LABELS.get(card_type, CARD_TYPE_LABELS.get(card_type_raw, card_type_raw))
        
        if balance is None and card_data:
            card_balance = card_data.get('balance', {})
            balance = (
                card_balance.get('currentNumberOfUses') or
                card_balance.get('balance') or
                card_balance.get('bonusBalance') or
                card_balance.get('visitsAvailable') or
                0
            )
        
        operation_id = str(uuid.uuid4())
        operation_record = {
            "id": operation_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "workspace_id": current_user.get("workspace_id"),
            "card_id": card_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "device": device,
            "template_id": str(template_id),
            "card_type": card_type,  # NEW: normalized card type
            "card_type_label": card_type_label,  # NEW: Spanish label
            "operation_type": operation_type,
            "operation_label": OPERATION_TYPES.get(operation_type, operation_type),
            "note": note,
            "amount": amount,
            "balance": balance,
            "purchase_sum": purchase_sum,
            "redeemed_value": redeemed_value,  # NEW: separate field for reward value
            "gerente": gerente_override or current_user.get('name', 'Unknown'),
            "gerente_email": current_user.get('email', ''),
            "user_id": current_user.get('id', ''),
            "source": "scanner"
        }
        
        await db.operations.insert_one(operation_record)
        logger.info(f"Logged operation: {operation_type} for card {card_id} ({card_type_label}) by {operation_record['gerente']}")
        return operation_record
    except Exception as e:
        logger.error(f"Failed to log operation: {e}")
        return None

def build_comment_with_gerente(original_comment: str, gerente_name: str) -> str:
    """Build comment string that includes gerente attribution for Boomerangme."""
    if not gerente_name:
        return original_comment or ""
    
    gerente_tag = f"[Gerente: {gerente_name}]"
    
    if original_comment:
        return f"{gerente_tag} {original_comment}"
    return gerente_tag

# ============ BOOMERANG API CALLS ============

async def call_boomerang_api(method: str, endpoint: str, data: dict = None, raise_on_error: bool = True, api_key: str = None) -> dict:
    """Make API calls to Boomerang/DigitalWallet API."""
    # Handle demo cards
    if endpoint and 'DEMO-' in endpoint.upper():
        return get_mock_response(endpoint, method, data)
    
    # Use workspace-specific API key if provided, otherwise fall back to global
    effective_key = api_key or BOOMERANG_API_KEY
    
    url = f"{BOOMERANG_API_BASE}{endpoint}"
    headers = {"X-Api-Key": effective_key, "Content-Type": "application/json"}
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if method.upper() == "GET":
                response = await client.get(url, headers=headers, params=data)
            elif method.upper() == "POST":
                response = await client.post(url, headers=headers, json=data)
            elif method.upper() == "PUT":
                response = await client.put(url, headers=headers, json=data)
            else:
                response = await client.request(method, url, headers=headers, json=data)
            
            try:
                result = response.json()
            except Exception:
                result = {"code": response.status_code, "message": response.text, "data": None}
            
            if response.status_code >= 400:
                result["code"] = response.status_code
            elif "code" not in result:
                result["code"] = response.status_code
            
            if raise_on_error and result.get("code", 200) >= 400:
                from fastapi import HTTPException
                error_msg = parse_api_error(result.get("message", ""))
                raise HTTPException(status_code=result.get("code", 400), detail=error_msg)
            
            return result
    except httpx.TimeoutException:
        logger.error(f"API timeout: {endpoint}")
        if raise_on_error:
            from fastapi import HTTPException
            raise HTTPException(status_code=504, detail=get_user_friendly_error("api_error"))
        return {"code": 504, "message": "Timeout", "data": None}
    except httpx.RequestError as e:
        logger.error(f"API request error: {e}")
        if raise_on_error:
            from fastapi import HTTPException
            raise HTTPException(status_code=500, detail=get_user_friendly_error("api_error"))
        return {"code": 500, "message": str(e), "data": None}

def get_mock_response(endpoint: str, method: str, data: dict = None) -> dict:
    """Generate mock responses for demo cards."""
    demo_card = {
        "id": "DEMO-001",
        "type": "stamp_card",
        "status": "active",
        "templateId": "demo-template",
        "balance": {
            "currentNumberOfUses": 5,
            "stampsUntilReward": 5,
            "numberRewardsUnused": 0,
            "totalStampsForReward": 10,
            "numberStampsTotal": 10
        },
        "customer": {
            "firstName": "Demo",
            "surname": "User",
            "email": "***@***.***",
            "phone": "***-****"
        }
    }
    
    if method.upper() == "POST":
        if "add-stamp" in endpoint or "add-visit" in endpoint:
            stamps = data.get("stamps") or data.get("visits") or 1
            demo_card["balance"]["currentNumberOfUses"] = min(10, demo_card["balance"]["currentNumberOfUses"] + stamps)
            demo_card["balance"]["stampsUntilReward"] = max(0, 10 - demo_card["balance"]["currentNumberOfUses"])
    
    return {"code": 200, "message": "Success", "data": demo_card}
