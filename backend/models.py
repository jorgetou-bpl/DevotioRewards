# Backend Models - Pydantic models for API requests/responses

from pydantic import BaseModel, EmailStr
from typing import Optional, Literal, List

# ============ USER MODELS ============

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token: str
    email: str
    name: Optional[str] = None
    role: Optional[str] = "operator"
    workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None

class UserResponse(BaseModel):
    email: str
    name: Optional[str] = None
    role: Optional[str] = "operator"
    workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None
    location: Optional[str] = None

# ============ ADMIN SETUP MODELS ============

class AdminUserCreate(BaseModel):
    """Model for creating users via admin setup"""
    master_code: str
    email: EmailStr
    password: str
    name: str
    role: Literal["super_admin", "workspace_admin", "operator"] = "operator"

# ============ WORKSPACE MODELS ============

class WorkspaceLocation(BaseModel):
    name: str
    address: Optional[str] = None

class WorkspaceCreate(BaseModel):
    master_code: str
    name: str
    slug: Optional[str] = None
    boomerangme_api_key: str
    locations: Optional[List[WorkspaceLocation]] = []
    # Optionally create the workspace admin at the same time
    admin_email: Optional[EmailStr] = None
    admin_password: Optional[str] = None
    admin_name: Optional[str] = None

class WorkspaceUpdate(BaseModel):
    name: Optional[str] = None
    boomerangme_api_key: Optional[str] = None
    locations: Optional[List[WorkspaceLocation]] = None
    active: Optional[bool] = None

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    slug: str
    active: bool = True
    locations: List[dict] = []
    has_api_key: bool = False
    user_count: int = 0

class WorkspaceUserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["workspace_admin", "operator"] = "operator"
    location: Optional[str] = None

# ============ SETTINGS MODELS ============
# Personal, per-user scan preferences only — currency, comment requirements,
# and manual search moved to WorkspacePreferences (workspace-level, Devotio-only).
# Field names below match what the frontend actually sends; the previous
# vibration_enabled/sound_enabled names never matched the frontend's
# vibration/beep fields, so those toggles silently failed to persist.

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

class WorkspacePreferencesUpdate(BaseModel):
    currency: Optional[str] = None
    require_comments: Optional[bool] = None
    enable_manual_search: Optional[bool] = None

class WorkspacePreferencesResponse(BaseModel):
    currency: str = "CRC"
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
