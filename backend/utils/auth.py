# Authentication utilities

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from .config import db, JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS

# HTTPBearer with auto_error=False so we can return 401 instead of 403
security = HTTPBearer(auto_error=False)

async def get_credentials(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return credentials

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {'user_id': user_id, 'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

PASSWORD_RESET_EXPIRATION_MINUTES = 15

def create_password_reset_token(user_id: str) -> str:
    """Short-lived, single-purpose token — reuses the same JWT_SECRET as
    normal login tokens but a distinct `purpose` claim and a much shorter
    expiry, so a leaked reset link can't be replayed as a session token
    (get_current_user never checks `purpose`, but this token's `exp` alone
    limits the blast radius, and reset-password explicitly rejects any
    token where purpose != 'password_reset')."""
    payload = {
        'user_id': user_id,
        'purpose': 'password_reset',
        'exp': datetime.now(timezone.utc) + timedelta(minutes=PASSWORD_RESET_EXPIRATION_MINUTES)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_password_reset_token(token: str) -> str | None:
    """Returns the user_id if the token is a valid, unexpired password-reset
    token; None otherwise (caller turns that into a generic error — never
    distinguishes "expired" from "malformed" from "wrong purpose" to a
    client, to avoid leaking anything about token validity)."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get('purpose') != 'password_reset':
        return None
    return payload.get('user_id')

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(get_credentials)):
    """Extract and validate user from JWT token"""
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Try to find user by 'id' field first (string format), then by '_id' (ObjectId)
        user = await db.users.find_one({"id": user_id}, {"password": 0, "hashed_password": 0})
        if not user:
            user = await db.users.find_one({"_id": user_id}, {"password": 0, "hashed_password": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Map legacy roles to new roles
        role = user.get("role", "operator")
        if role == "admin":
            role = "workspace_admin"
        elif role == "user":
            role = "operator"
        
        return {
            "id": user_id,
            "email": user.get("email"),
            "name": user.get("name"),
            "role": role,
            "workspace_id": user.get("workspace_id"),
            "location": user.get("location")
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def require_super_admin(current_user: dict = Depends(get_current_user)):
    """FastAPI dependency restricting an endpoint to super_admin (Devotio staff) only."""
    if current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Acceso restringido a super administradores")
    return current_user


async def require_workspace_admin(current_user: dict = Depends(get_current_user)):
    """FastAPI dependency restricting an endpoint to workspace_admin or super_admin."""
    if current_user.get("role") not in ("super_admin", "workspace_admin"):
        raise HTTPException(status_code=403, detail="Acceso restringido a administradores")
    return current_user
