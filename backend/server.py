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
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

class SettingsResponse(BaseModel):
    vibration: bool = False
    beep: bool = False
    show_result: bool = True
    copy_to_clipboard: bool = True
    currency: str = "CRC"

class CardActionRequest(BaseModel):
    amount: Optional[int] = 1
    comment: Optional[str] = None
    purchaseSum: Optional[float] = None

class ScanRequest(BaseModel):
    qr_data: str

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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
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

async def call_boomerang_api(method: str, endpoint: str, data: dict = None) -> dict:
    # Always use mock data for DEMO cards (for proposal demo purposes)
    if '/cards/' in endpoint:
        card_id = endpoint.split('/cards/')[-1].split('/')[0].upper()
        if card_id.startswith('DEMO-'):
            logger.info(f"Using mock data for demo card: {card_id}")
            return get_mock_response(endpoint, method, data)
    
    if not BOOMERANG_API_KEY:
        logger.warning("No Boomerang API key configured, returning mock data")
        return get_mock_response(endpoint, method, data)
    
    # Boomerang API uses X-Api-Key header for authentication
    headers = {
        'X-Api-Key': BOOMERANG_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
    url = f"{BOOMERANG_API_BASE}{endpoint}"
    
    logger.info(f"Calling Boomerang API: {method} {url}")
    
    async with httpx.AsyncClient() as client:
        try:
            if method == 'GET':
                response = await client.get(url, headers=headers, timeout=30.0)
            elif method == 'POST':
                response = await client.post(url, headers=headers, json=data, timeout=30.0)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logger.info(f"Boomerang API response: {response.status_code}")
            
            if response.status_code >= 400:
                error_detail = response.text
                logger.error(f"Boomerang API error: {response.status_code} - {error_detail}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"Error de API Boomerang: {error_detail[:200]}"
                )
            
            result = response.json()
            # API wraps response in {code, data} structure
            if 'data' in result:
                return result
            return {"code": 200, "data": result}
            
        except httpx.TimeoutException:
            logger.error("Boomerang API timeout")
            raise HTTPException(status_code=504, detail="Tiempo de espera agotado en API Boomerang")
        except httpx.RequestError as e:
            logger.error(f"Failed to connect to Boomerang API: {e}")
            raise HTTPException(status_code=502, detail=f"Error de conexión con API Boomerang: {str(e)}")

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
    await db.settings.insert_one({"user_id": user_id, "vibration": False, "beep": False, "show_result": True, "copy_to_clipboard": True, "currency": "CRC"})
    
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

@api_router.post("/scan")
async def scan_card(scan_data: ScanRequest, current_user: dict = Depends(get_current_user)):
    card_id = extract_card_id_from_qr(scan_data.qr_data)
    if not card_id:
        raise HTTPException(status_code=400, detail="Invalid QR code format")
    
    response = await call_boomerang_api('GET', f'/cards/{card_id}')
    if response.get('code') != 200:
        raise HTTPException(status_code=404, detail="Card not found")
    
    card_data = response.get('data', {})
    masked_data = mask_pii(card_data)
    
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "scan"})
    return {"success": True, "card": masked_data}

@api_router.get("/cards/{card_id}")
async def get_card(card_id: str, current_user: dict = Depends(get_current_user)):
    response = await call_boomerang_api('GET', f'/cards/{card_id}')
    if response.get('code') != 200:
        raise HTTPException(status_code=404, detail="Card not found")
    return {"success": True, "card": mask_pii(response.get('data', {}))}

@api_router.post("/cards/{card_id}/add-stamp")
async def add_stamp(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    payload = {"stamps": action_data.amount or 1}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-stamp', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "add_stamp", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Stamp added successfully"}

@api_router.post("/cards/{card_id}/subtract-reward")
async def subtract_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract/redeem rewards from stamp cards (type ID 0)"""
    payload = {"rewards": int(action_data.amount or 1)}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-reward', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "subtract_reward", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Recompensa canjeada exitosamente"}

@api_router.post("/cards/{card_id}/add-point")
async def add_points(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    payload = {"points": float(action_data.amount or 1)}
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-point', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "add_point", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Points added successfully"}

@api_router.post("/cards/{card_id}/redeem-reward")
async def redeem_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    payload = {"id": action_data.amount or 1}
    response = await call_boomerang_api('POST', f'/cards/{card_id}/receive-reward', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "redeem_reward"})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Reward redeemed successfully"}

@api_router.post("/cards/{card_id}/redeem-points")
async def redeem_points(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    payload = {"points": action_data.amount or 1}
    response = await call_boomerang_api('POST', f'/cards/{card_id}/redeem-points', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "redeem_points", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Points redeemed successfully"}

@api_router.post("/cards/{card_id}/subtract-point")
async def subtract_point(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract points from certificate/gift cards - used for redeeming balance"""
    payload = {"points": float(action_data.amount or 1)}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
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
    payload = {"visits": action_data.amount or 1}
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-visit', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "add_visit", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Visit added successfully"}

@api_router.post("/cards/{card_id}/redeem-visit")
async def redeem_visit(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    payload = {"visits": action_data.amount or 1}
    response = await call_boomerang_api('POST', f'/cards/{card_id}/redeem-visit', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "redeem_visit", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Visit redeemed successfully"}

@api_router.post("/cards/{card_id}/subtract-visit")
async def subtract_visit(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Subtract visits from multipass/membership cards"""
    payload = {"visits": action_data.amount or 1}
    if action_data.comment:
        payload["comment"] = action_data.comment
    response = await call_boomerang_api('POST', f'/cards/{card_id}/subtract-visit', payload)
    await db.scan_logs.insert_one({"user_id": current_user['id'], "card_id": card_id, 
                                    "timestamp": datetime.now(timezone.utc).isoformat(), "action": "subtract_visit", "amount": action_data.amount})
    return {"success": True, "card": mask_pii(response.get('data', {})), "message": "Visita canjeada exitosamente"}

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
        raise HTTPException(status_code=404, detail="Customer not found")
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
