from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, EmailStr
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import jwt
import bcrypt
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Boomerang API configuration
BOOMERANG_API_BASE = os.environ.get('BOOMERANG_API_BASE', 'https://api.digitalwallet.cards/api/v2')
BOOMERANG_API_KEY = os.environ.get('BOOMERANG_API_KEY', '')

# JWT configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'scanner-app-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 24

app = FastAPI(title="Devotio Rewards Scanner API")
api_router = APIRouter(prefix="/api")

# HTTPBearer with auto_error=False so we can return 401 instead of 403
security = HTTPBearer(auto_error=False)

async def get_credentials(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return credentials

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============ ERROR HANDLING ============

# User-friendly error messages (hide technical details from end users)
SUPPORT_MESSAGE = "Por favor contacte al administrador de Devotio Rewards para asistencia."

def get_user_friendly_error(error_type: str, technical_error: str = None) -> str:
    """
    Return user-friendly error messages without exposing API details.
    Log the technical error for debugging but return a clean message to users.
    """
    if technical_error:
        logger.error(f"Technical error ({error_type}): {technical_error}")
    
    error_messages = {
        "card_not_found": "Tarjeta no encontrada. Verifique el ID e intente nuevamente.",
        "customer_not_found": "Cliente no encontrado. Verifique los datos e intente nuevamente.",
        "invalid_format": "Formato inválido. Ingrese ID de tarjeta, teléfono o email.",
        "connection_error": f"Error de conexión. {SUPPORT_MESSAGE}",
        "timeout": f"El servicio está tardando más de lo esperado. {SUPPORT_MESSAGE}",
        "action_failed": f"No se pudo completar la acción. {SUPPORT_MESSAGE}",
        "template_not_found": "Información de plantilla no disponible.",
        "already_redeemed": "Esta recompensa ya fue canjeada.",
        "no_rewards": "No hay recompensas disponibles para canjear.",
        "visit_limit": "Ya se registró una visita hoy para esta tarjeta.",
        "insufficient_balance": "Saldo insuficiente para esta operación.",
        "general_error": f"Ocurrió un error. {SUPPORT_MESSAGE}",
    }
    return error_messages.get(error_type, error_messages["general_error"])

def parse_api_error(error_message: str) -> str:
    """
    Parse API error messages and return user-friendly versions.
    This hides technical API details from end users.
    """
    error_lower = str(error_message).lower()
    
    # Map common API errors to user-friendly messages
    if "irrelevant accrual type" in error_lower:
        return None  # This is handled by fallback logic, not shown to user
    if "visit has already been registered" in error_lower:
        return get_user_friendly_error("visit_limit")
    if "card not found" in error_lower:
        return get_user_friendly_error("card_not_found")
    if "customer not found" in error_lower:
        return get_user_friendly_error("customer_not_found")
    if "already redeemed" in error_lower or "coupon was redeemed" in error_lower:
        return get_user_friendly_error("already_redeemed")
    if "insufficient" in error_lower or "not enough" in error_lower:
        return get_user_friendly_error("insufficient_balance")
    if "no rewards" in error_lower or "no available" in error_lower:
        return get_user_friendly_error("no_rewards")
    
    # Default: return generic error without exposing API details
    return get_user_friendly_error("general_error", error_message)

# ============ MODELS ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str

class TokenResponse(BaseModel):
    token: str
    user: UserResponse

class SettingsUpdate(BaseModel):
    vibration: Optional[bool] = None
    beep: Optional[bool] = None
    show_result: Optional[bool] = None
    copy_to_clipboard: Optional[bool] = None
    currency: Optional[str] = None
    require_comments: Optional[bool] = None
    enable_manual_search: Optional[bool] = None

class SettingsResponse(BaseModel):
    vibration: bool = False
    beep: bool = False
    show_result: bool = True
    copy_to_clipboard: bool = True
    currency: str = "CRC"
    require_comments: bool = True
    enable_manual_search: bool = False

class CardActionRequest(BaseModel):
    amount: Optional[float] = 1  # Changed to float to support decimal amounts (e.g., cashback)
    comment: Optional[str] = None
    purchaseSum: Optional[float] = None
    gerente: Optional[str] = None  # Scanner app user performing the transaction

class ScanRequest(BaseModel):
    qr_data: str

# ============ OPERATIONS MODELS ============

class OperationRecord(BaseModel):
    """Local operation record for tracking transactions with gerente attribution"""
    id: Optional[str] = None
    created_at: str
    card_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    device: Optional[str] = None
    template_name: Optional[str] = None
    template_id: Optional[str] = None
    operation_type: str  # stamps_earned, visit_logged, reward_redeemed, etc.
    note: Optional[str] = None
    amount: Optional[float] = None
    balance: Optional[float] = None
    purchase_sum: Optional[float] = None
    gerente: str  # Scanner app user who performed the transaction
    gerente_email: str
    source: str = "scanner"  # scanner or api

class OperationsFilter(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gerente: Optional[str] = None
    operation_type: Optional[str] = None
    card_id: Optional[str] = None

# ============ DEMO DATA ============

DEMO_CARDS = {
    "DEMO-001": {
        "id": "DEMO-001", "type": "stamp_card", "status": "active",
        "serialNumber": "802416-001-001", "installDate": "15.01.2025", "lastAccrual": "08.01.2026",
        "customerId": "cust-maria-001",
        "customer": {"id": "cust-maria-001", "firstName": "Maria", "surname": "González", "email": "maria.gonzalez@email.com", "phone": "+1 555-0101"},
        "balance": {"currentNumberOfUses": 8, "numberStampsTotal": 10, "numberRewardsUnused": 1, "stampsBeforeReward": 2},
        "countVisits": 15, "totalRewardsRedeemed": 3, "totalRewardsEarned": 4
    },
    "DEMO-002": {
        "id": "DEMO-002", "type": "cashback_card", "status": "active",
        "serialNumber": "802416-002-001", "installDate": "20.02.2025", "lastAccrual": "05.01.2026",
        "customerId": "cust-carlos-002",
        "customer": {"id": "cust-carlos-002", "firstName": "Carlos", "surname": "Rodriguez", "email": "carlos.r@email.com", "phone": "+1 555-0102"},
        "balance": {"balance": 450.0, "bonusBalance": 125, "cashbackPercent": 5, "cashbackLevel": "Silver"},
        "countVisits": 22, "totalRewardsRedeemed": 5, "totalRewardsEarned": 7
    },
    "DEMO-003": {
        "id": "DEMO-003", "type": "discount_card", "status": "active",
        "serialNumber": "802416-003-001", "installDate": "10.03.2025", "lastAccrual": "28.12.2025",
        "customerId": "cust-ana-003",
        "customer": {"id": "cust-ana-003", "firstName": "Ana", "surname": "Martinez", "email": "ana.martinez@email.com", "phone": "+1 555-0103"},
        "balance": {"discountLevel": 1, "discountStatus": "Bronze", "toNextLevel": 4965, "currentDiscount": 5, "totalSavings": 35.50, "transactionsAmount": 3500.0},
        "countVisits": 12, "totalRewardsRedeemed": 0, "totalRewardsEarned": 0
    },
    "DEMO-004": {
        "id": "DEMO-004", "type": "gift_card", "status": "active",
        "serialNumber": "802416-004-001", "installDate": "01.12.2025", "lastAccrual": "25.12.2025",
        "customerId": "cust-luis-004",
        "customer": {"id": "cust-luis-004", "firstName": "Luis", "surname": "Fernandez", "email": "luis.f@email.com", "phone": "+1 555-0104"},
        "balance": {"balance": 75.0, "bonusBalance": 75, "initialBalance": 100.0},
        "countVisits": 3, "totalRewardsRedeemed": 0, "totalRewardsEarned": 0
    },
    "DEMO-005": {
        "id": "DEMO-005", "type": "coupon", "status": "active",
        "serialNumber": "802416-005-001", "installDate": "05.01.2026", "expirationDate": "05.02.2026",
        "customerId": "cust-sofia-005",
        "customer": {"id": "cust-sofia-005", "firstName": "Sofia", "surname": "Lopez", "email": "sofia.lopez@email.com", "phone": "+1 555-0105"},
        "balance": {"couponStatus": "active", "couponValue": "20% OFF"},
        "countVisits": 0, "totalRewardsRedeemed": 0, "totalRewardsEarned": 0
    },
    "DEMO-006": {
        "id": "DEMO-006", "type": "multipass", "status": "active",
        "serialNumber": "802416-006-001", "installDate": "01.01.2026", "expirationDate": "01.04.2026",
        "customerId": "cust-miguel-006",
        "customer": {"id": "cust-miguel-006", "firstName": "Miguel", "surname": "Santos", "email": "miguel.s@email.com", "phone": "+1 555-0106"},
        "balance": {"visitsTotal": 10, "visitsUsed": 4, "visitsAvailable": 6, "bonusBalance": 40},
        "countVisits": 4, "totalRewardsRedeemed": 0, "totalRewardsEarned": 0
    },
    "DEMO-007": {
        "id": "DEMO-007", "type": "stamp_card", "status": "active",
        "serialNumber": "802416-007-001", "installDate": "20.11.2025", "lastAccrual": "02.01.2026",
        "customerId": "cust-elena-007",
        "customer": {"id": "cust-elena-007", "firstName": "Elena", "surname": "Vargas", "email": "elena.v@email.com", "phone": "+1 555-0107"},
        "balance": {"currentNumberOfUses": 3, "numberStampsTotal": 10, "numberRewardsUnused": 0, "stampsBeforeReward": 7},
        "countVisits": 5, "totalRewardsRedeemed": 0, "totalRewardsEarned": 0
    }
}

DEMO_CUSTOMERS = [
    {"id": "cust-maria-001", "firstName": "Maria", "surname": "González", "email": "maria.gonzalez@email.com", "phone": "+1 555-0101"},
    {"id": "cust-carlos-002", "firstName": "Carlos", "surname": "Rodriguez", "email": "carlos.r@email.com", "phone": "+1 555-0102"},
    {"id": "cust-ana-003", "firstName": "Ana", "surname": "Martinez", "email": "ana.martinez@email.com", "phone": "+1 555-0103"},
    {"id": "cust-luis-004", "firstName": "Luis", "surname": "Fernandez", "email": "luis.f@email.com", "phone": "+1 555-0104"},
    {"id": "cust-sofia-005", "firstName": "Sofia", "surname": "Lopez", "email": "sofia.lopez@email.com", "phone": "+1 555-0105"},
    {"id": "cust-miguel-006", "firstName": "Miguel", "surname": "Santos", "email": "miguel.s@email.com", "phone": "+1 555-0106"},
    {"id": "cust-elena-007", "firstName": "Elena", "surname": "Vargas", "email": "elena.v@email.com", "phone": "+1 555-0107"}
]

CUSTOMER_TO_CARD = {
    "cust-maria-001": "DEMO-001", "cust-carlos-002": "DEMO-002", "cust-ana-003": "DEMO-003",
    "cust-luis-004": "DEMO-004", "cust-sofia-005": "DEMO-005", "cust-miguel-006": "DEMO-006",
    "cust-elena-007": "DEMO-007"
}

# ============ HELPER FUNCTIONS ============

def mask_pii(data: dict) -> dict:
    """Mask PII fields in the response - Keep firstName and surname visible, mask email and phone"""
    masked = data.copy()
    if 'customer' in masked and masked['customer']:
        customer = masked['customer'].copy()
        # Keep firstName and surname visible (not masked)
        # Only mask email and phone
        if 'email' in customer:
            customer['email'] = '***@***.***'
        if 'phone' in customer:
            customer['phone'] = '***-***-****'
        masked['customer'] = customer
    # For top-level fields (not nested in customer)
    for field in ['email', 'phone']:
        if field in masked:
            if field == 'email':
                masked[field] = '***@***.***'
            elif field == 'phone':
                masked[field] = '***-***-****'
    return masked

def extract_card_id_from_qr(qr_data: str) -> str:
    if 'boomerangme' in qr_data.lower() or 'digitalwallet' in qr_data.lower():
        patterns = [r'/cards?/([a-zA-Z0-9-]+)', r'card_id=([a-zA-Z0-9-]+)', r'/([0-9]+-[0-9]+-[0-9]+)']
        for pattern in patterns:
            match = re.search(pattern, qr_data)
            if match:
                return match.group(1)
    return qr_data.strip()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {'user_id': user_id, 'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# Operation type mapping for Spanish labels
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

async def log_operation(
    card_id: str,
    operation_type: str,
    current_user: dict,
    card_data: dict = None,
    amount: float = None,
    balance: float = None,
    purchase_sum: float = None,
    note: str = None,
    gerente_override: str = None
):
    """
    Log an operation to local database with full details for reporting.
    This creates our own transaction history with gerente attribution.
    """
    try:
        # Extract customer info from card data
        customer = card_data.get('customer', {}) if card_data else {}
        customer_name = f"{customer.get('firstName', '')} {customer.get('surname', '')}".strip()
        customer_phone = customer.get('phone', '')
        
        # Get device and template info
        device = card_data.get('device', 'Unknown') if card_data else 'Unknown'
        template_id = card_data.get('templateId', '') if card_data else ''
        
        # Determine balance from card data if not provided
        if balance is None and card_data:
            card_balance = card_data.get('balance', {})
            # Try different balance fields depending on card type
            balance = (
                card_balance.get('currentNumberOfUses') or
                card_balance.get('balance') or
                card_balance.get('bonusBalance') or
                card_balance.get('visitsAvailable') or
                0
            )
        
        # Create operation record
        operation_id = str(uuid.uuid4())
        operation_record = {
            "id": operation_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "card_id": card_id,
            "customer_name": customer_name,
            "customer_phone": customer_phone,
            "device": device,
            "template_id": str(template_id),
            "operation_type": operation_type,
            "operation_label": OPERATION_TYPES.get(operation_type, operation_type),
            "note": note,
            "amount": amount,
            "balance": balance,
            "purchase_sum": purchase_sum,
            "gerente": gerente_override or current_user.get('name', 'Unknown'),
            "gerente_email": current_user.get('email', ''),
            "user_id": current_user.get('id', ''),
            "source": "scanner"
        }
        
        await db.operations.insert_one(operation_record)
        logger.info(f"Logged operation: {operation_type} for card {card_id} by {operation_record['gerente']}")
        return operation_record
    except Exception as e:
        logger.error(f"Failed to log operation: {e}")
        return None

def build_comment_with_gerente(original_comment: str, gerente_name: str) -> str:
    """
    Build comment string that includes gerente attribution for Boomerangme.
    Format: [Gerente: Name] Original comment
    """
    if not gerente_name:
        return original_comment or ""
    
    gerente_tag = f"[Gerente: {gerente_name}]"
    
    if original_comment:
        return f"{gerente_tag} {original_comment}"
    return gerente_tag

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(get_credentials)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def call_boomerang_api(method: str, endpoint: str, data: dict = None, raise_on_error: bool = True) -> dict:
    """
    Call Boomerang API with optional error handling control.
    
    Args:
        method: HTTP method (GET, POST)
        endpoint: API endpoint path
        data: Request payload for POST requests
        raise_on_error: If True (default), raises HTTPException on error. 
                       If False, returns the error response for caller to handle.
    """
    # Always use mock data for DEMO cards (for proposal demo purposes)
    if '/cards/' in endpoint:
        card_id = endpoint.split('/cards/')[-1].split('/')[0].upper()
        if card_id.startswith('DEMO-'):
            logger.info(f"Using mock data for demo card: {card_id}")
            return get_mock_response(endpoint, method, data)
    
    if not BOOMERANG_API_KEY:
        logger.warning("No API key configured, returning mock data")
        return get_mock_response(endpoint, method, data)
    
    headers = {
        'X-Api-Key': BOOMERANG_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    url = f"{BOOMERANG_API_BASE}{endpoint}"
    
    logger.info(f"Calling API: {method} {url}")
    
    async with httpx.AsyncClient() as client:
        try:
            if method == 'GET':
                response = await client.get(url, headers=headers, timeout=30.0)
            elif method == 'POST':
                response = await client.post(url, headers=headers, json=data, timeout=30.0)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logger.info(f"API response: {response.status_code}")
            
            if response.status_code >= 400:
                error_detail = response.text
                logger.error(f"API error: {response.status_code} - {error_detail}")
                
                # Return error response for caller to handle if raise_on_error is False
                if not raise_on_error:
                    try:
                        error_json = response.json()
                        return {"code": response.status_code, "message": error_json.get('message', error_detail), "data": None}
                    except:
                        return {"code": response.status_code, "message": error_detail, "data": None}
                
                # Parse the error and return user-friendly message
                user_error = parse_api_error(error_detail)
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=user_error
                )
            
            result = response.json()
            # API wraps response in {code, data} structure
            if 'data' in result:
                return result
            return {"code": 200, "data": result}
            
        except httpx.TimeoutException:
            logger.error("API timeout")
            raise HTTPException(status_code=504, detail=get_user_friendly_error("timeout"))
        except httpx.RequestError as e:
            logger.error(f"Failed to connect to API: {e}")
            raise HTTPException(status_code=502, detail=get_user_friendly_error("connection_error", str(e)))

def get_mock_response(endpoint: str, method: str, data: dict = None) -> dict:
    """Return mock data for demo"""
    
    # Get card by ID
    if '/cards/' in endpoint and method == 'GET' and 'customerId' not in endpoint:
        card_id = endpoint.split('/cards/')[-1].split('/')[0].upper()
        if card_id in DEMO_CARDS:
            return {"code": 200, "data": DEMO_CARDS[card_id].copy()}
        return {"code": 200, "data": {
            "id": card_id, "type": "stamp_card", "status": "active",
            "customer": {"id": f"cust-{card_id[:8]}", "firstName": "Demo", "surname": "Customer", "email": "demo@example.com", "phone": "+1234567890"},
            "balance": {"currentNumberOfUses": 5, "numberStampsTotal": 10, "numberRewardsUnused": 0, "stampsBeforeReward": 5},
            "countVisits": 5, "totalRewardsRedeemed": 0, "totalRewardsEarned": 0
        }}
    
    # Card actions
    if method == 'POST' and '/cards/' in endpoint:
        card_id = endpoint.split('/cards/')[-1].split('/')[0].upper()
        card = DEMO_CARDS.get(card_id, {}).copy()
        balance = card.get('balance', {}).copy()
        
        if 'add-stamp' in endpoint:
            stamps = data.get('stamps', 1) if data else 1
            balance['currentNumberOfUses'] = min((balance.get('currentNumberOfUses', 0) + stamps), balance.get('numberStampsTotal', 10))
            balance['stampsBeforeReward'] = max(0, balance.get('numberStampsTotal', 10) - balance['currentNumberOfUses'])
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'subtract-reward' in endpoint:
            rewards = data.get('rewards', 1) if data else 1
            balance['numberRewardsUnused'] = max(0, balance.get('numberRewardsUnused', 0) - rewards)
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'add-point' in endpoint:
            points = data.get('points', 10) if data else 10
            balance['bonusBalance'] = balance.get('bonusBalance', 0) + int(points)
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'redeem-reward' in endpoint or 'receive-reward' in endpoint:
            rewards = data.get('id', 1) if data else 1
            balance['numberRewardsUnused'] = max(0, balance.get('numberRewardsUnused', 0) - rewards)
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'redeem-points' in endpoint:
            points = data.get('points', 0) if data else 0
            balance['bonusBalance'] = max(0, balance.get('bonusBalance', 0) - points)
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'subtract-point' in endpoint:
            points = data.get('points', 0) if data else 0
            balance['balance'] = max(0, balance.get('balance', 0) - points)
            balance['bonusBalance'] = max(0, balance.get('bonusBalance', 0) - points)
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'redeem-coupon' in endpoint:
            balance['couponStatus'] = 'used'
            return {"code": 200, "data": {"id": card_id, "balance": balance, "status": "used", "couponRedeemed": True}}
        
        if 'add-visit' in endpoint:
            visits = data.get('visits', 1) if data else 1
            balance['visitsAvailable'] = balance.get('visitsAvailable', 0) + visits
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'redeem-visit' in endpoint:
            visits = data.get('visits', 1) if data else 1
            balance['visitsAvailable'] = max(0, balance.get('visitsAvailable', 0) - visits)
            balance['visitsUsed'] = balance.get('visitsUsed', 0) + visits
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'subtract-visit' in endpoint:
            visits = data.get('visits', 1) if data else 1
            balance['visitsAvailable'] = max(0, balance.get('visitsAvailable', 0) - visits)
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'add-reward' in endpoint:
            rewards = data.get('rewards', 1) if data else 1
            balance['numberRewardsUnused'] = balance.get('numberRewardsUnused', 0) + rewards
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'add-scores' in endpoint:
            scores = data.get('scores', 1) if data else 1
            balance['bonusBalance'] = balance.get('bonusBalance', 0) + scores
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
        
        if 'receive-reward' in endpoint:
            balance['numberRewardsUnused'] = max(0, balance.get('numberRewardsUnused', 0) - 1)
            return {"code": 200, "data": {"id": card_id, "balance": balance}}
    
    # Search customers
    if '/customers' in endpoint and method == 'GET':
        return {"code": 200, "meta": {"totalItems": len(DEMO_CUSTOMERS)}, "data": DEMO_CUSTOMERS}
    
    return {"code": 200, "data": {}}

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {"id": user_id, "email": user_data.email, "name": user_data.name, 
                "password": hash_password(user_data.password), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user_doc)
    await db.settings.insert_one({"user_id": user_id, "vibration": False, "beep": False, "show_result": True, "copy_to_clipboard": True, "currency": "CRC", "require_comments": True})
    
    return {"token": create_token(user_id), "user": {"id": user_id, "email": user_data.email, "name": user_data.name}}

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"token": create_token(user['id']), "user": {"id": user['id'], "email": user['email'], "name": user['name']}}

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ============ SETTINGS ROUTES ============

@api_router.get("/settings", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"user_id": current_user['id']}, {"_id": 0, "user_id": 0})
    return settings or SettingsResponse()

@api_router.put("/settings", response_model=SettingsResponse)
async def update_settings(settings_data: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    await db.settings.update_one({"user_id": current_user['id']}, {"$set": update_dict}, upsert=True)
    settings = await db.settings.find_one({"user_id": current_user['id']}, {"_id": 0, "user_id": 0})
    return settings

# ============ SCANNER/CARD ROUTES ============

def is_phone_number(input_str: str) -> bool:
    """Check if input looks like a phone number (digits only, 8-15 chars, no dashes)"""
    digits_only = ''.join(filter(str.isdigit, input_str))
    # Phone numbers are 8-15 digits and don't contain dashes in a card ID pattern (xxx-xxx-xxx)
    return len(digits_only) >= 8 and len(digits_only) <= 15 and '-' not in input_str

def is_card_id(input_str: str) -> bool:
    """Check if input looks like a Boomerang card ID (format: XXXXXX-XXX-XXX)"""
    import re
    # Card IDs have format like 192362-969-247
    return bool(re.match(r'^\d{5,6}-\d{3}-\d{3}$', input_str.strip()))

def is_email(input_str: str) -> bool:
    """Check if input looks like an email address"""
    import re
    # Simple email pattern check
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', input_str.strip()))

async def search_customer_and_get_card(search_type: str, search_value: str, current_user: dict, db):
    """Helper function to search customer by phone or email and return their card"""
    logger.info(f"Searching by {search_type}: {search_value}")
    
    # Search for customer
    customer_response = await call_boomerang_api('GET', f'/customers?{search_type}={search_value}')
    if customer_response.get('code') == 200:
        customers = customer_response.get('data', [])
        if customers:
            customer_id = customers[0].get('id')
            customer_name = f"{customers[0].get('firstName', '')} {customers[0].get('surname', '')}".strip()
            logger.info(f"Found customer: {customer_id} - {customer_name}")
            
            # Get cards for this customer
            cards_response = await call_boomerang_api('GET', f'/cards?customerId={customer_id}')
            if cards_response.get('code') == 200:
                cards = cards_response.get('data', [])
                if cards:
                    # Get full card data using the card ID
                    card_id = cards[0].get('id')
                    full_card_response = await call_boomerang_api('GET', f'/cards/{card_id}')
                    if full_card_response.get('code') == 200:
                        card_data = full_card_response.get('data', {})
                        masked_data = mask_pii(card_data)
                        
                        await db.scan_logs.insert_one({
                            "user_id": current_user['id'], 
                            "card_id": card_id, 
                            "timestamp": datetime.now(timezone.utc).isoformat(), 
                            "action": f"scan_by_{search_type}"
                        })
                        
                        # If customer has multiple cards, add info to response
                        if len(cards) > 1:
                            return {
                                "success": True, 
                                "card": masked_data,
                                "message": f"Cliente tiene {len(cards)} tarjetas. Mostrando la primera."
                            }
                        return {"success": True, "card": masked_data}
                else:
                    return {"error": "Cliente encontrado pero no tiene tarjetas activas.", "code": 404}
    
    # User-friendly error without exposing search type details
    search_label = "teléfono" if search_type == "phone" else "email"
    return {"error": f"No se encontró cliente con ese {search_label}. Verifique los datos e intente nuevamente.", "code": 404}

@api_router.post("/scan")
async def scan_card(scan_data: ScanRequest, current_user: dict = Depends(get_current_user)):
    """
    Scan/search for a card by:
    - Card ID (e.g., 192362-969-247)
    - Phone number (e.g., 50622355710)
    - Email address (e.g., cliente@email.com)
    - QR code data containing card ID
    """
    input_data = scan_data.qr_data.strip()
    
    # Check if it's an email address
    if is_email(input_data):
        result = await search_customer_and_get_card('email', input_data, current_user, db)
        if 'error' in result:
            raise HTTPException(status_code=result['code'], detail=result['error'])
        return result
    
    # Check if it's a phone number (before trying as card ID)
    if is_phone_number(input_data) and not is_card_id(input_data):
        phone_digits = ''.join(filter(str.isdigit, input_data))
        result = await search_customer_and_get_card('phone', phone_digits, current_user, db)
        if 'error' in result:
            raise HTTPException(status_code=result['code'], detail=result['error'])
        return result
    
    # Try to extract card ID from QR data or use as-is
    card_id = extract_card_id_from_qr(input_data)
    
    if not card_id:
        raise HTTPException(status_code=400, detail=get_user_friendly_error("invalid_format"))
    
    response = await call_boomerang_api('GET', f'/cards/{card_id}')
    if response.get('code') != 200:
        raise HTTPException(status_code=404, detail=get_user_friendly_error("card_not_found"))
    
    card_data = response.get('data', {})
    masked_data = mask_pii(card_data)
    
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "scan"})
    return {"success": True, "card": masked_data}

@api_router.get("/cards/{card_id}")
async def get_card(card_id: str, current_user: dict = Depends(get_current_user)):
    response = await call_boomerang_api('GET', f'/cards/{card_id}')
    if response.get('code') != 200:
        raise HTTPException(status_code=404, detail=get_user_friendly_error("card_not_found"))
    return {"success": True, "card": mask_pii(response.get('data', {}))}

@api_router.post("/cards/{card_id}/add-stamp")
async def add_stamp(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """
    Add stamps to stamp cards - supports all 3 program types:
    - Sellos (stamps): Manual stamp entry - uses add-stamp endpoint
    - Visita (visit): Per-visit stamps - uses add-visit endpoint  
    - Gastar (spend): Spend-based stamps - uses add-purchase endpoint (Boomerang calculates stamps)
    
    The function auto-detects the correct endpoint by trying each one and handling "Irrelevant accrual type" errors.
    """
    stamps = action_data.amount or 1
    purchase_sum = action_data.purchaseSum or 0
    original_comment = action_data.comment
    gerente_name = action_data.gerente or current_user.get('name', '')
    
    # Build comment with gerente attribution for Boomerangme
    comment_with_gerente = build_comment_with_gerente(original_comment, gerente_name)
    
    # Build payloads for each accrual type
    stamp_payload = {"stamps": stamps}
    visit_payload = {"visits": stamps}  # visits count same as stamps for visit-based
    purchase_payload = {"amount": purchase_sum if purchase_sum > 0 else stamps}  # For gastar, send purchase amount
    
    # Add optional fields to all payloads
    for payload in [stamp_payload, visit_payload, purchase_payload]:
        if comment_with_gerente:
            payload["comment"] = comment_with_gerente
        if purchase_sum:
            payload["purchaseSum"] = purchase_sum
    
    # Try endpoints in order: stamp -> visit -> purchase
    endpoints = [
        ('add-stamp', stamp_payload, "Sello agregado exitosamente"),
        ('add-visit', visit_payload, "Visita registrada exitosamente"),
        ('add-purchase', purchase_payload, "Compra registrada exitosamente")
    ]
    
    last_error = None
    for endpoint, payload, success_msg in endpoints:
        # Use raise_on_error=False to handle errors gracefully for fallback
        response = await call_boomerang_api('POST', f'/cards/{card_id}/{endpoint}', payload, raise_on_error=False)
        
        # Check if successful
        if response.get('code') == 200:
            card_data = response.get('data', {})
            card_balance = card_data.get('balance', {})
            
            # Log operation with gerente attribution
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
        
        # Check if it's an "Irrelevant accrual type" error - try next endpoint
        error_msg = response.get('message', '')
        if 'Irrelevant accrual type' in str(error_msg):
            logger.info(f"Card {card_id}: {endpoint} not supported, trying next accrual type")
            last_error = error_msg
            continue
        
        # Other error - parse and return user-friendly message
        user_error = parse_api_error(error_msg)
        raise HTTPException(status_code=response.get('code', 400), detail=user_error)
    
    # All endpoints failed
    raise HTTPException(status_code=400, detail=get_user_friendly_error("action_failed", last_error))

@api_router.post("/cards/{card_id}/subtract-reward")
async def subtract_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract/redeem rewards from stamp cards (type ID 0)"""
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

@api_router.post("/cards/{card_id}/add-point")
async def add_points(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    amount = float(action_data.amount or 1)
    payload = {"points": amount}
    # For gift cards, purchaseSum should equal the amount being added
    # For discount/cashback cards, purchaseSum is the purchase amount
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    else:
        # Default purchaseSum to equal the points amount for gift cards
        payload["purchaseSum"] = amount
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-point', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "add_point", "amount": action_data.amount})
    
    # Determine the correct Spanish message based on card type from the response
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
    
    return {"success": True, "card": mask_pii(card_data), "message": message}

@api_router.post("/cards/{card_id}/redeem-reward")
async def redeem_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    payload = {"id": action_data.amount or 1}
    response = await call_boomerang_api('POST', f'/cards/{card_id}/receive-reward', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "redeem_reward"})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Recompensa canjeada exitosamente"}

@api_router.post("/cards/{card_id}/redeem-points")
async def redeem_points(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    payload = {"points": action_data.amount or 1}
    response = await call_boomerang_api('POST', f'/cards/{card_id}/redeem-points', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "redeem_points", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Puntos canjeados exitosamente"}

@api_router.post("/cards/{card_id}/subtract-point")
async def subtract_point(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract points from certificate/gift/cashback cards - used for redeeming balance"""
    amount = float(action_data.amount or 1)
    payload = {"points": amount}
    if action_data.comment:
        payload["comment"] = action_data.comment
    # For cashback/gift cards, purchaseSum should equal the amount being redeemed
    # If purchaseSum is provided use it, otherwise use the amount itself
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    else:
        # Default purchaseSum to equal the points amount for consistency
        payload["purchaseSum"] = amount
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-point', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "subtract_point", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Saldo canjeado exitosamente"}

@api_router.post("/cards/{card_id}/use-coupon")
async def use_coupon(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    # Boomerang API v2 uses "redeem-coupon" endpoint, not "use-coupon"
    payload = {}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/redeem-coupon', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "redeem_coupon"})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Cupón canjeado exitosamente"}

@api_router.post("/cards/{card_id}/add-visit")
async def add_visit(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add visit = SELL/ADD available visits to customer (increases currentNumberOfUses)"""
    payload = {"visits": action_data.amount or 1}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-visit', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "add_visit", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Visitas agregadas exitosamente"}

@api_router.post("/cards/{card_id}/redeem-visit")
async def redeem_visit(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    payload = {"visits": action_data.amount or 1}
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/redeem-visit', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "redeem_visit", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Visita canjeada exitosamente"}

@api_router.post("/cards/{card_id}/subtract-visit")
async def subtract_visit(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract visit = customer USES a visit (decreases currentNumberOfUses/available visits)"""
    payload = {"visits": action_data.amount or 1}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-visit', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "subtract_visit", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Visita utilizada exitosamente"}

@api_router.post("/cards/{card_id}/add-reward")
async def add_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add rewards to reward cards (type ID 7)"""
    payload = {"rewards": int(action_data.amount or 1)}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-reward', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "add_reward", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Recompensas agregadas exitosamente"}

@api_router.post("/cards/{card_id}/add-scores")
async def add_scores(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add scores/points to reward cards - this updates bonusBalance"""
    payload = {"scores": int(action_data.amount or 1)}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-scores', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "add_scores", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Puntos agregados exitosamente"}

@api_router.post("/cards/{card_id}/subtract-scores")
async def subtract_scores(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract scores/points from subscription/multipass and reward cards - this reduces bonusBalance"""
    payload = {"scores": int(action_data.amount or 1)}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-scores', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "subtract_scores", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Puntos canjeados exitosamente"}

@api_router.post("/cards/{card_id}/receive-reward")
async def receive_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Receive/redeem reward from reward cards (type ID 7). Requires reward tier ID."""
    # For receive-reward, the API expects 'id' field with the reward tier ID
    # If amount is passed, use it as the reward tier ID, otherwise use 1 as default
    payload = {"id": int(action_data.amount or 1)}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/receive-reward', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "receive_reward", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Recompensa canjeada exitosamente"}

# ============ TEMPLATE ROUTES ============

@api_router.get("/templates/{template_id}")
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Fetch template data including reward tiers"""
    try:
        response = await call_boomerang_api('GET', f'/templates/{template_id}')
        if response.get('code') != 200:
            raise HTTPException(status_code=404, detail=get_user_friendly_error("template_not_found"))
        
        template_data = response.get('data', {})
        
        # Extract reward tiers from template
        reward_tiers = template_data.get('rewardTiers', [])
        
        # Format for frontend consumption
        formatted_tiers = []
        for tier in reward_tiers:
            formatted_tiers.append({
                'id': tier.get('id'),
                'templateId': tier.get('templateId'),
                'name': tier.get('name', f"Recompensa a los {tier.get('threshold', 0)} sellos"),
                'type': tier.get('type', 0),  # 0=custom, 1=amount, 2=percent
                'threshold': tier.get('threshold', 0),  # Stamps needed
                'value': tier.get('value', 0),
                'valueLimit': tier.get('valueLimit'),
                'usageLimit': tier.get('usageLimit')
            })
        
        return {
            "success": True,
            "template": {
                "id": template_data.get('id'),
                "name": template_data.get('name'),
                "type": template_data.get('type'),
                "rewardTiers": formatted_tiers
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching template: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error("general_error", str(e)))

# ============ CUSTOMER ROUTES ============

@api_router.get("/customers")
async def search_customers(
    query: Optional[str] = None,
    phone: Optional[str] = None, 
    email: Optional[str] = None, 
    page: int = 1, 
    itemsPerPage: int = 30, 
    current_user: dict = Depends(get_current_user)
):
    """Search customers by phone, email, or general search query"""
    # Build query parameters for Boomerang API
    params = f'page={page}&itemsPerPage={itemsPerPage}'
    
    # For exact phone/email search, use Boomerang's native filtering
    if phone:
        params += f'&phone={phone}'
    if email:
        params += f'&email={email}'
    
    response = await call_boomerang_api('GET', f'/customers?{params}')
    customers = response.get('data', [])
    
    # If general query provided, filter results client-side (Boomerang's search doesn't work well)
    if query and not phone and not email:
        query_lower = query.lower()
        customers = [
            c for c in customers 
            if query_lower in (c.get('firstName', '') or '').lower()
            or query_lower in (c.get('surname', '') or '').lower()
            or query_lower in (c.get('email', '') or '').lower()
            or query_lower in (c.get('phone', '') or '').lower()
        ]
    
    return {"success": True, "customers": [mask_pii(c) for c in customers], "meta": response.get('meta', {})}

@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    response = await call_boomerang_api('GET', f'/customers/{customer_id}')
    if response.get('code') != 200:
        raise HTTPException(status_code=404, detail=get_user_friendly_error("customer_not_found"))
    return {"success": True, "customer": mask_pii(response.get('data', {}))}

@api_router.get("/customers/{customer_id}/cards")
async def get_customer_cards(customer_id: str, current_user: dict = Depends(get_current_user)):
    if customer_id in CUSTOMER_TO_CARD:
        card_id = CUSTOMER_TO_CARD[customer_id]
        card_response = await call_boomerang_api('GET', f'/cards/{card_id}')
        if card_response.get('code') == 200:
            return {"success": True, "cards": [mask_pii(card_response.get('data', {}))]}
    response = await call_boomerang_api('GET', f'/cards?customerId={customer_id}')
    return {"success": True, "cards": [mask_pii(c) for c in response.get('data', [])]}

# ============ HEALTH CHECK ============

@api_router.get("/")
async def root():
    return {"message": "Devotio Rewards Scanner API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

app.include_router(api_router)

app.add_middleware(CORSMiddleware, allow_credentials=True, 
                   allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
                   allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
