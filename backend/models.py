# Backend Models - Pydantic models for API requests/responses

from pydantic import BaseModel, EmailStr
from typing import Optional, Literal

# ============ USER MODELS ============

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None
    role: Literal["admin", "user"] = "user"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    email: str
    name: Optional[str] = None
    role: Optional[str] = "user"

class UserResponse(BaseModel):
    email: str
    name: Optional[str] = None
    role: Optional[str] = "user"

# ============ ADMIN SETUP MODELS ============

class AdminUserCreate(BaseModel):
    """Model for creating users via admin setup"""
    master_code: str
    email: EmailStr
    password: str
    name: str
    role: Literal["admin", "user"] = "user"

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
    # For reward redemption with tracking
    reward_id: Optional[str] = None  # ID of specific earned reward to redeem
    reward_value: Optional[float] = None  # Optional monetary value of reward
    # For reward card accrual type
    accrualProgram: Optional[str] = None  # 'points', 'spend', or 'visit'

class ScanRequest(BaseModel):
    qr_data: str

# ============ REWARD TRACKING MODELS ============

class EarnedReward(BaseModel):
    """Tracks individual rewards earned by customers"""
    id: Optional[str] = None
    card_id: str
    customer_name: Optional[str] = None
    template_id: Optional[str] = None
    
    # Reward tier info
    reward_threshold: int  # stamps needed (2, 10, etc.)
    
    # Timing
    earned_at: str  # ISO timestamp when earned
    stamps_at_earning: int  # stamp count when reward was earned
    
    # Status
    status: str = "pending"  # pending, redeemed
    redeemed_at: Optional[str] = None
    redeemed_by: Optional[str] = None  # gerente who redeemed
    redeemed_value: Optional[float] = None  # value entered at redemption
    redeemed_note: Optional[str] = None

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
