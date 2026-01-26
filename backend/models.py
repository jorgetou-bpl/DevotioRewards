# Backend Models - Pydantic models for API requests/responses

from pydantic import BaseModel, EmailStr
from typing import Optional

# ============ USER MODELS ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    email: str
    name: Optional[str] = None

class UserResponse(BaseModel):
    email: str
    name: Optional[str] = None

# ============ SETTINGS MODELS ============

class SettingsUpdate(BaseModel):
    vibration_enabled: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    currency: Optional[str] = None
    decimals: Optional[int] = None
    language: Optional[str] = None
    require_comments: Optional[bool] = None
    enable_manual_search: Optional[bool] = None

class SettingsResponse(BaseModel):
    vibration_enabled: bool = True
    sound_enabled: bool = True
    currency: str = "CRC"
    decimals: int = 0
    language: str = "es"
    require_comments: bool = False
    enable_manual_search: bool = True

# ============ CARD MODELS ============

class CardActionRequest(BaseModel):
    amount: Optional[float] = 1
    comment: Optional[str] = None
    purchaseSum: Optional[float] = None
    gerente: Optional[str] = None

class ScanRequest(BaseModel):
    qr_data: str

# ============ OPERATIONS MODELS ============

class OperationRecord(BaseModel):
    id: Optional[str] = None
    created_at: str
    card_id: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    device: Optional[str] = None
    template_name: Optional[str] = None
    template_id: Optional[str] = None
    operation_type: str
    note: Optional[str] = None
    amount: Optional[float] = None
    balance: Optional[float] = None
    purchase_sum: Optional[float] = None
    gerente: str
    gerente_email: str
    source: str = "scanner"

class OperationsFilter(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    gerente: Optional[str] = None
    operation_type: Optional[str] = None
    card_id: Optional[str] = None
