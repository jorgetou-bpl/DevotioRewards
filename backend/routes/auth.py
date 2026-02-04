# Authentication routes

from fastapi import APIRouter, HTTPException
import uuid
import os
from models import UserCreate, UserLogin, TokenResponse, UserResponse, AdminUserCreate
from utils.config import db
from utils.auth import hash_password, verify_password, create_token, get_current_user
from fastapi import Depends

router = APIRouter(prefix="/auth", tags=["auth"])

# Master code for admin setup - can be configured via environment variable
MASTER_CODE = os.environ.get("ADMIN_MASTER_CODE", "DEVOTIO-2026-ADMIN")

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user. (Legacy endpoint - kept for compatibility but not exposed in UI)"""
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(user_data.password)
    user_name = user_data.name or user_data.email.split('@')[0]
    
    # Store user with both 'id' (string UUID) and '_id' (string UUID for consistency)
    await db.users.insert_one({
        "_id": user_id,  # Use string UUID as _id for consistency
        "id": user_id,   # Also store as 'id' field for lookup
        "email": user_data.email, 
        "hashed_password": hashed_pw,
        "password": hashed_pw,  # Also store as 'password' for backward compatibility
        "name": user_name,
        "role": user_data.role
    })
    return TokenResponse(token=create_token(user_id), email=user_data.email, name=user_name, role=user_data.role)

@router.post("/admin/create-user", response_model=dict)
async def admin_create_user(user_data: AdminUserCreate):
    """Create a new user via admin setup with master code verification."""
    # Verify master code
    if user_data.master_code != MASTER_CODE:
        raise HTTPException(status_code=403, detail="Código maestro inválido")
    
    # Check if email already exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(user_data.password)
    
    # Store user
    await db.users.insert_one({
        "_id": user_id,
        "id": user_id,
        "email": user_data.email, 
        "hashed_password": hashed_pw,
        "password": hashed_pw,
        "name": user_data.name,
        "role": user_data.role
    })
    
    return {
        "success": True,
        "message": f"Usuario '{user_data.name}' creado exitosamente",
        "user": {
            "email": user_data.email,
            "name": user_data.name,
            "role": user_data.role
        }
    }

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login with email and password."""
    user = await db.users.find_one({"email": credentials.email})
    if not user:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # Support both old 'password' field and new 'hashed_password' field
    stored_hash = user.get("hashed_password") or user.get("password", "")
    if not stored_hash or not verify_password(credentials.password, stored_hash):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    
    # Get user ID - support both '_id' (ObjectId) and 'id' (string) formats
    user_id = user.get("id") or str(user.get("_id"))
    return TokenResponse(
        token=create_token(user_id), 
        email=user["email"], 
        name=user.get("name"),
        role=user.get("role", "user")
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info."""
    return UserResponse(
        email=current_user["email"], 
        name=current_user.get("name"),
        role=current_user.get("role", "user")
    )
