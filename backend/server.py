from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Any, Dict
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

# Create the main app
app = FastAPI(title="Devotio Rewards Scanner API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
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

class SettingsResponse(BaseModel):
    vibration: bool = False
    beep: bool = False
    show_result: bool = True
    copy_to_clipboard: bool = True

class CardActionRequest(BaseModel):
    amount: Optional[int] = 1
    comment: Optional[str] = None
    purchaseSum: Optional[float] = None

class CustomerSearchRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    page: int = 1
    itemsPerPage: int = 30

class ScanRequest(BaseModel):
    qr_data: str  # Could be card ID or URL

# ============ HELPER FUNCTIONS ============

def mask_pii(data: dict) -> dict:
    """Mask PII fields in the response"""
    masked = data.copy()
    
    # Mask customer info if present
    if 'customer' in masked and masked['customer']:
        customer = masked['customer'].copy()
        if 'firstName' in customer:
            customer['firstName'] = '***'
        if 'surname' in customer:
            customer['surname'] = '***'
        if 'email' in customer:
            customer['email'] = '***@***.***'
        if 'phone' in customer:
            customer['phone'] = '***-***-****'
        masked['customer'] = customer
    
    # Also mask top-level PII if present
    for field in ['firstName', 'surname', 'email', 'phone']:
        if field in masked:
            if field == 'email':
                masked[field] = '***@***.***'
            elif field == 'phone':
                masked[field] = '***-***-****'
            else:
                masked[field] = '***'
    
    return masked

def extract_card_id_from_qr(qr_data: str) -> str:
    """Extract card ID from QR code data (URL or direct ID)"""
    # If it's a URL, extract the card ID
    if 'boomerangme' in qr_data.lower() or 'digitalwallet' in qr_data.lower():
        # Try to extract card ID from URL patterns
        patterns = [
            r'/cards?/([a-zA-Z0-9-]+)',
            r'card_id=([a-zA-Z0-9-]+)',
            r'/([0-9]+-[0-9]+-[0-9]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, qr_data)
            if match:
                return match.group(1)
    
    # If it's already just an ID, return it
    return qr_data.strip()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
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
    """Make authenticated requests to Boomerang API"""
    if not BOOMERANG_API_KEY:
        # Return mock data if no API key configured
        logger.warning("No Boomerang API key configured, returning mock data")
        return get_mock_response(endpoint, method)
    
    headers = {
        'Authorization': f'Bearer {BOOMERANG_API_KEY}',
        'Content-Type': 'application/json'
    }
    
    url = f"{BOOMERANG_API_BASE}{endpoint}"
    
    async with httpx.AsyncClient() as client:
        try:
            if method == 'GET':
                response = await client.get(url, headers=headers, timeout=30.0)
            elif method == 'POST':
                response = await client.post(url, headers=headers, json=data, timeout=30.0)
            elif method == 'PATCH':
                response = await client.patch(url, headers=headers, json=data, timeout=30.0)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code >= 400:
                logger.error(f"Boomerang API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail="Boomerang API error")
            
            return response.json()
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Boomerang API timeout")
        except httpx.RequestError as e:
            logger.error(f"Boomerang API request error: {e}")
            raise HTTPException(status_code=502, detail="Failed to connect to Boomerang API")

def get_mock_response(endpoint: str, method: str) -> dict:
    """Return mock data for development/demo purposes"""
    
    # Demo customers database
    DEMO_CUSTOMERS = {
        "DEMO-001": {
            "id": "DEMO-001",
            "companyId": 12345,
            "templateId": 67890,
            "customerId": "cust-maria-001",
            "type": "stamp_card",
            "status": "active",
            "customer": {
                "id": "cust-maria-001",
                "firstName": "Maria",
                "surname": "González",
                "email": "maria.gonzalez@email.com",
                "phone": "+1 555-0101"
            },
            "balance": {
                "currentNumberOfUses": 8,
                "numberStampsTotal": 10,
                "numberRewardsUnused": 1,
                "balance": 0,
                "bonusBalance": 0,
                "stampsBeforeReward": 2
            },
            "countVisits": 15,
            "totalRewardsRedeemed": 3,
            "totalRewardsEarned": 4
        },
        "DEMO-002": {
            "id": "DEMO-002",
            "companyId": 12345,
            "templateId": 67891,
            "customerId": "cust-carlos-002",
            "type": "points_card",
            "status": "active",
            "customer": {
                "id": "cust-carlos-002",
                "firstName": "Carlos",
                "surname": "Rodriguez",
                "email": "carlos.r@email.com",
                "phone": "+1 555-0102"
            },
            "balance": {
                "currentNumberOfUses": 0,
                "numberStampsTotal": 0,
                "numberRewardsUnused": 2,
                "balance": 450.0,
                "bonusBalance": 125,
                "stampsBeforeReward": 0
            },
            "countVisits": 22,
            "totalRewardsRedeemed": 5,
            "totalRewardsEarned": 7
        },
        "DEMO-003": {
            "id": "DEMO-003",
            "companyId": 12345,
            "templateId": 67890,
            "customerId": "cust-ana-003",
            "type": "stamp_card",
            "status": "active",
            "customer": {
                "id": "cust-ana-003",
                "firstName": "Ana",
                "surname": "Martinez",
                "email": "ana.martinez@email.com",
                "phone": "+1 555-0103"
            },
            "balance": {
                "currentNumberOfUses": 3,
                "numberStampsTotal": 10,
                "numberRewardsUnused": 0,
                "balance": 0,
                "bonusBalance": 0,
                "stampsBeforeReward": 7
            },
            "countVisits": 5,
            "totalRewardsRedeemed": 0,
            "totalRewardsEarned": 0
        },
        "DEMO-004": {
            "id": "DEMO-004",
            "companyId": 12345,
            "templateId": 67892,
            "customerId": "cust-luis-004",
            "type": "vip_card",
            "status": "active",
            "customer": {
                "id": "cust-luis-004",
                "firstName": "Luis",
                "surname": "Fernandez",
                "email": "luis.f@email.com",
                "phone": "+1 555-0104"
            },
            "balance": {
                "currentNumberOfUses": 10,
                "numberStampsTotal": 10,
                "numberRewardsUnused": 3,
                "balance": 1250.0,
                "bonusBalance": 500,
                "stampsBeforeReward": 0
            },
            "countVisits": 48,
            "totalRewardsRedeemed": 12,
            "totalRewardsEarned": 15
        },
        "DEMO-005": {
            "id": "DEMO-005",
            "companyId": 12345,
            "templateId": 67890,
            "customerId": "cust-sofia-005",
            "type": "stamp_card",
            "status": "active",
            "customer": {
                "id": "cust-sofia-005",
                "firstName": "Sofia",
                "surname": "Lopez",
                "email": "sofia.lopez@email.com",
                "phone": "+1 555-0105"
            },
            "balance": {
                "currentNumberOfUses": 9,
                "numberStampsTotal": 10,
                "numberRewardsUnused": 0,
                "balance": 0,
                "bonusBalance": 75,
                "stampsBeforeReward": 1
            },
            "countVisits": 18,
            "totalRewardsRedeemed": 1,
            "totalRewardsEarned": 1
        }
    }
    
    if '/cards/' in endpoint and method == 'GET':
        card_id = endpoint.split('/cards/')[-1].split('/')[0]
        
        # Check if it's a demo card
        if card_id.upper() in DEMO_CUSTOMERS:
            return {"code": 200, "data": DEMO_CUSTOMERS[card_id.upper()]}
        
        # Default demo card for any other ID
        return {
            "code": 200,
            "data": {
                "id": card_id,
                "companyId": 12345,
                "templateId": 67890,
                "customerId": f"cust-{card_id[:8]}",
                "type": "stamp_card",
                "status": "active",
                "customer": {
                    "id": f"cust-{card_id[:8]}",
                    "firstName": "Demo",
                    "surname": "Customer",
                    "email": "demo@example.com",
                    "phone": "+1234567890"
                },
                "balance": {
                    "currentNumberOfUses": 7,
                    "numberStampsTotal": 10,
                    "numberRewardsUnused": 1,
                    "balance": 150.0,
                    "bonusBalance": 25,
                    "stampsBeforeReward": 3
                },
                "countVisits": 12,
                "totalRewardsRedeemed": 2,
                "totalRewardsEarned": 3
            }
        }
    elif 'add-stamp' in endpoint:
        card_id = endpoint.split('/cards/')[-1].split('/')[0].upper()
        current_stamps = 8
        if card_id == "DEMO-002":
            current_stamps = 1
        elif card_id == "DEMO-003":
            current_stamps = 4
        elif card_id == "DEMO-004":
            current_stamps = 10
        elif card_id == "DEMO-005":
            current_stamps = 10
        
        return {
            "code": 200,
            "data": {
                "id": card_id,
                "balance": {
                    "currentNumberOfUses": min(current_stamps + 1, 10),
                    "numberStampsTotal": 10,
                    "stampsBeforeReward": max(10 - current_stamps - 1, 0)
                }
            }
        }
    elif 'add-point' in endpoint:
        return {
            "code": 200,
            "data": {
                "id": "card-123",
                "balance": {
                    "bonusBalance": 135,
                    "balance": 160.0
                }
            }
        }
    elif 'receive-reward' in endpoint:
        return {
            "code": 200,
            "data": {
                "id": "card-123",
                "balance": {
                    "numberRewardsUnused": 0
                }
            }
        }
    elif '/customers' in endpoint:
        # Return demo customers for search
        return {
            "code": 200,
            "meta": {"totalItems": 5, "itemsPerPage": 30, "currentPage": 1},
            "data": [
                {
                    "id": "cust-maria-001",
                    "firstName": "Maria",
                    "surname": "González",
                    "email": "maria.gonzalez@email.com",
                    "phone": "+1 555-0101"
                },
                {
                    "id": "cust-carlos-002",
                    "firstName": "Carlos",
                    "surname": "Rodriguez",
                    "email": "carlos.r@email.com",
                    "phone": "+1 555-0102"
                },
                {
                    "id": "cust-ana-003",
                    "firstName": "Ana",
                    "surname": "Martinez",
                    "email": "ana.martinez@email.com",
                    "phone": "+1 555-0103"
                },
                {
                    "id": "cust-luis-004",
                    "firstName": "Luis",
                    "surname": "Fernandez",
                    "email": "luis.f@email.com",
                    "phone": "+1 555-0104"
                },
                {
                    "id": "cust-sofia-005",
                    "firstName": "Sofia",
                    "surname": "Lopez",
                    "email": "sofia.lopez@email.com",
                    "phone": "+1 555-0105"
                }
            ]
        }
    
    return {"code": 200, "data": {}}

# Mapping of customer IDs to card IDs for demo
CUSTOMER_TO_CARD_MAP = {
    "cust-maria-001": "DEMO-001",
    "cust-carlos-002": "DEMO-002",
    "cust-ana-003": "DEMO-003",
    "cust-luis-004": "DEMO-004",
    "cust-sofia-005": "DEMO-005"
}

# ============ AUTH ROUTES ============

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create default settings
    await db.settings.insert_one({
        "user_id": user_id,
        "vibration": False,
        "beep": False,
        "show_result": True,
        "copy_to_clipboard": True
    })
    
    token = create_token(user_id)
    
    return {
        "token": token,
        "user": {"id": user_id, "email": user_data.email, "name": user_data.name}
    }

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_token(user['id'])
    
    return {
        "token": token,
        "user": {"id": user['id'], "email": user['email'], "name": user['name']}
    }

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# ============ SETTINGS ROUTES ============

@api_router.get("/settings", response_model=SettingsResponse)
async def get_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({"user_id": current_user['id']}, {"_id": 0, "user_id": 0})
    if not settings:
        return SettingsResponse()
    return settings

@api_router.put("/settings", response_model=SettingsResponse)
async def update_settings(settings_data: SettingsUpdate, current_user: dict = Depends(get_current_user)):
    update_dict = {k: v for k, v in settings_data.model_dump().items() if v is not None}
    
    await db.settings.update_one(
        {"user_id": current_user['id']},
        {"$set": update_dict},
        upsert=True
    )
    
    settings = await db.settings.find_one({"user_id": current_user['id']}, {"_id": 0, "user_id": 0})
    return settings

# ============ SCANNER/CARD ROUTES ============

@api_router.post("/scan")
async def scan_card(scan_data: ScanRequest, current_user: dict = Depends(get_current_user)):
    """Process scanned QR code and return masked card info"""
    card_id = extract_card_id_from_qr(scan_data.qr_data)
    
    if not card_id:
        raise HTTPException(status_code=400, detail="Invalid QR code format")
    
    # Fetch card from Boomerang API
    response = await call_boomerang_api('GET', f'/cards/{card_id}')
    
    if response.get('code') != 200:
        raise HTTPException(status_code=404, detail="Card not found")
    
    card_data = response.get('data', {})
    
    # Mask PII before returning
    masked_data = mask_pii(card_data)
    
    # Log the scan
    await db.scan_logs.insert_one({
        "user_id": current_user['id'],
        "card_id": card_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "scan"
    })
    
    return {"success": True, "card": masked_data}

@api_router.get("/cards/{card_id}")
async def get_card(card_id: str, current_user: dict = Depends(get_current_user)):
    """Get card details with masked PII"""
    response = await call_boomerang_api('GET', f'/cards/{card_id}')
    
    if response.get('code') != 200:
        raise HTTPException(status_code=404, detail="Card not found")
    
    card_data = response.get('data', {})
    masked_data = mask_pii(card_data)
    
    return {"success": True, "card": masked_data}

@api_router.post("/cards/{card_id}/add-stamp")
async def add_stamp(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add stamp to card"""
    payload = {"stamps": action_data.amount or 1}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-stamp', payload)
    
    # Log the action
    await db.scan_logs.insert_one({
        "user_id": current_user['id'],
        "card_id": card_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "add_stamp",
        "amount": action_data.amount
    })
    
    card_data = response.get('data', {})
    masked_data = mask_pii(card_data)
    
    return {"success": True, "card": masked_data, "message": "Stamp added successfully"}

@api_router.post("/cards/{card_id}/add-point")
async def add_points(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Add points to card"""
    payload = {"points": float(action_data.amount or 1)}
    if action_data.comment:
        payload["comment"] = action_data.comment
    if action_data.purchaseSum:
        payload["purchaseSum"] = action_data.purchaseSum
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/add-point', payload)
    
    await db.scan_logs.insert_one({
        "user_id": current_user['id'],
        "card_id": card_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "add_point",
        "amount": action_data.amount
    })
    
    card_data = response.get('data', {})
    masked_data = mask_pii(card_data)
    
    return {"success": True, "card": masked_data, "message": "Points added successfully"}

@api_router.post("/cards/{card_id}/redeem-reward")
async def redeem_reward(card_id: str, action_data: CardActionRequest, current_user: dict = Depends(get_current_user)):
    """Redeem reward from card"""
    payload = {"id": action_data.amount or 1}
    if action_data.comment:
        payload["comment"] = action_data.comment
    
    response = await call_boomerang_api('POST', f'/cards/{card_id}/receive-reward', payload)
    
    await db.scan_logs.insert_one({
        "user_id": current_user['id'],
        "card_id": card_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": "redeem_reward"
    })
    
    card_data = response.get('data', {})
    masked_data = mask_pii(card_data)
    
    return {"success": True, "card": masked_data, "message": "Reward redeemed successfully"}

# ============ CUSTOMER ROUTES ============

@api_router.get("/customers")
async def search_customers(
    phone: Optional[str] = None,
    email: Optional[str] = None,
    page: int = 1,
    itemsPerPage: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Search customers with masked PII"""
    query_params = []
    if phone:
        query_params.append(f"phone={phone}")
    if email:
        query_params.append(f"email={email}")
    query_params.append(f"page={page}")
    query_params.append(f"itemsPerPage={itemsPerPage}")
    
    endpoint = f"/customers?{'&'.join(query_params)}"
    response = await call_boomerang_api('GET', endpoint)
    
    customers = response.get('data', [])
    masked_customers = [mask_pii(c) for c in customers]
    
    return {
        "success": True,
        "customers": masked_customers,
        "meta": response.get('meta', {})
    }

@api_router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get customer details with masked PII"""
    response = await call_boomerang_api('GET', f'/customers/{customer_id}')
    
    if response.get('code') != 200:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer_data = response.get('data', {})
    masked_data = mask_pii(customer_data)
    
    return {"success": True, "customer": masked_data}

@api_router.get("/customers/{customer_id}/cards")
async def get_customer_cards(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get all cards for a customer with masked PII"""
    
    # Check for demo customer mapping first
    if customer_id in CUSTOMER_TO_CARD_MAP:
        card_id = CUSTOMER_TO_CARD_MAP[customer_id]
        # Get the demo card data
        card_response = await call_boomerang_api('GET', f'/cards/{card_id}')
        if card_response.get('code') == 200:
            card_data = card_response.get('data', {})
            masked_card = mask_pii(card_data)
            return {"success": True, "cards": [masked_card]}
    
    response = await call_boomerang_api('GET', f'/cards?customerId={customer_id}')
    
    cards = response.get('data', [])
    masked_cards = [mask_pii(c) for c in cards]
    
    return {"success": True, "cards": masked_cards}

# ============ HEALTH CHECK ============

@api_router.get("/")
async def root():
    return {"message": "Devotio Rewards Scanner API", "version": "1.0.0"}

@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
