# Authentication routes

from fastapi import APIRouter, HTTPException
import uuid
from models import UserCreate, UserLogin, TokenResponse, UserResponse
from utils.config import db
from utils.auth import hash_password, verify_password, create_token, get_current_user
from fastapi import Depends

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=TokenResponse)
async def register(user_data: UserCreate):
    """Register a new user."""
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_id = str(uuid.uuid4())
    hashed_password = hash_password(user_data.password)
    await db.users.insert_one({
        "_id": user_id, 
        "email": user_data.email, 
        "hashed_password": hashed_password,
        "name": user_data.name or user_data.email.split('@')[0]
    })
    return TokenResponse(token=create_token(user_id), email=user_data.email, name=user_data.name)

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    """Login with email and password."""
    user = await db.users.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user.get("hashed_password", "")):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
    return TokenResponse(token=create_token(user["_id"]), email=user["email"], name=user.get("name"))

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info."""
    return UserResponse(email=current_user["email"], name=current_user.get("name"))
