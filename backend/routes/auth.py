# Authentication routes

from fastapi import APIRouter, HTTPException
import uuid
import os
import logging
from models import UserLogin, TokenResponse, UserResponse, AdminUserCreate, ForgotPasswordRequest, ResetPasswordRequest
from utils.config import db, FRONTEND_URL
from utils.auth import (
    hash_password, verify_password, create_token, get_current_user,
    create_password_reset_token, verify_password_reset_token
)
from utils.email import send_email
from fastapi import Depends

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# Master code for admin setup - can be configured via environment variable
MASTER_CODE = os.environ.get("ADMIN_MASTER_CODE", "DEVOTIO-2026-ADMIN")

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
    
    # Map legacy roles
    role = user.get("role", "operator")
    if role == "admin":
        role = "workspace_admin"
    elif role == "user":
        role = "operator"
    
    # Get workspace name if applicable
    workspace_id = user.get("workspace_id")
    workspace_name = None
    if workspace_id:
        ws = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0, "name": 1})
        if ws:
            workspace_name = ws.get("name")
    
    # Get user ID - support both '_id' (ObjectId) and 'id' (string) formats
    user_id = user.get("id") or str(user.get("_id"))
    return TokenResponse(
        token=create_token(user_id), 
        email=user["email"], 
        name=user.get("name"),
        role=role,
        workspace_id=workspace_id,
        workspace_name=workspace_name
    )

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user info."""
    workspace_name = None
    if current_user.get("workspace_id"):
        ws = await db.workspaces.find_one({"id": current_user["workspace_id"]}, {"_id": 0, "name": 1})
        if ws:
            workspace_name = ws.get("name")
    
    return UserResponse(
        email=current_user["email"],
        name=current_user.get("name"),
        role=current_user.get("role", "operator"),
        workspace_id=current_user.get("workspace_id"),
        workspace_name=workspace_name,
        location=current_user.get("location")
    )


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordRequest):
    """Look up the account by its main email OR any registered backup_email
    (for when the admin who set up the account has lost access to their own
    inbox), then email a reset link. Always returns the same generic
    message regardless of whether a match was found — never confirms or
    denies an email's existence in the system."""
    user = await db.users.find_one({"email": payload.email})
    if not user:
        user = await db.users.find_one({"backup_emails": payload.email})

    generic_response = {
        "success": True,
        "message": "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña."
    }

    if not user:
        return generic_response

    user_id = user.get("id") or str(user.get("_id"))
    reset_token = create_password_reset_token(user_id)
    reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"

    sent = await send_email(
        to=payload.email,
        subject="Restablecer tu contraseña — Devotio Rewards",
        html=(
            f"<p>Hola {user.get('name', '')},</p>"
            f"<p>Solicitaste restablecer tu contraseña. Este enlace es válido por 15 minutos:</p>"
            f"<p><a href=\"{reset_link}\">{reset_link}</a></p>"
            f"<p>Si no solicitaste esto, puedes ignorar este correo.</p>"
        )
    )
    if not sent:
        logger.error("forgot-password: email send failed for user_id=%s", user_id)

    return generic_response


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordRequest):
    """Validate the reset token and set the new password. The token's own
    15-minute expiry (see create_password_reset_token) is the only
    single-use-ish guarantee here — there's no server-side revocation list,
    so a token remains valid for repeated use until it expires. Acceptable
    for a 15-minute window; would need a used-token collection to close
    entirely."""
    user_id = verify_password_reset_token(payload.token)
    if not user_id:
        raise HTTPException(status_code=400, detail="El enlace de restablecimiento es inválido o expiró")

    user = await db.users.find_one({"id": user_id})
    if not user:
        user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=400, detail="El enlace de restablecimiento es inválido o expiró")

    hashed_pw = hash_password(payload.new_password)
    await db.users.update_one(
        {"id": user_id} if user.get("id") else {"_id": user_id},
        {"$set": {"hashed_password": hashed_pw, "password": hashed_pw}}
    )

    return {"success": True, "message": "Contraseña actualizada exitosamente"}
