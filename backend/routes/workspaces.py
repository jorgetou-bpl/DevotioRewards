# Workspace management routes

from fastapi import APIRouter, HTTPException, Depends
import uuid
import re
import os
from datetime import datetime, timezone
from models import (
    WorkspaceCreate, WorkspaceUpdate, WorkspaceResponse,
    WorkspaceUserCreate, WorkspaceLocation
)
from utils.config import db
from utils.auth import hash_password, require_super_admin, require_workspace_admin

router = APIRouter(prefix="/admin", tags=["admin"])

MASTER_CODE = os.environ.get("ADMIN_MASTER_CODE", "DEVOTIO-2026-ADMIN")

def slugify(text):
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    return text.strip('-')

# ============ WORKSPACE CRUD (Super Admin) ============

@router.post("/workspaces")
async def create_workspace(data: WorkspaceCreate):
    """Create a new workspace. Requires master code."""
    if data.master_code != MASTER_CODE:
        raise HTTPException(status_code=403, detail="Código maestro inválido")
    
    slug = data.slug or slugify(data.name)
    existing = await db.workspaces.find_one({"slug": slug})
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe un workspace con el slug '{slug}'")
    
    workspace_id = str(uuid.uuid4())
    workspace_doc = {
        "_id": workspace_id,
        "id": workspace_id,
        "name": data.name,
        "slug": slug,
        "boomerangme_api_key": data.boomerangme_api_key,
        "locations": [loc.model_dump() for loc in (data.locations or [])],
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "super_admin"
    }
    await db.workspaces.insert_one(workspace_doc)
    
    result = {
        "success": True,
        "workspace": {
            "id": workspace_id,
            "name": data.name,
            "slug": slug,
            "active": True,
            "locations": workspace_doc["locations"]
        }
    }
    
    # Optionally create workspace admin
    if data.admin_email and data.admin_password:
        existing_user = await db.users.find_one({"email": data.admin_email})
        if existing_user:
            raise HTTPException(status_code=400, detail=f"El email '{data.admin_email}' ya está registrado")
        
        user_id = str(uuid.uuid4())
        hashed_pw = hash_password(data.admin_password)
        await db.users.insert_one({
            "_id": user_id,
            "id": user_id,
            "email": data.admin_email,
            "hashed_password": hashed_pw,
            "password": hashed_pw,
            "name": data.admin_name or data.admin_email.split('@')[0],
            "role": "workspace_admin",
            "workspace_id": workspace_id
        })
        result["admin_created"] = {
            "email": data.admin_email,
            "name": data.admin_name or data.admin_email.split('@')[0]
        }
    
    return result

@router.get("/workspaces")
async def list_workspaces(current_user: dict = Depends(require_super_admin)):
    """List all workspaces. Super admin only."""
    workspaces = []
    async for ws in db.workspaces.find({}, {"_id": 0, "boomerangme_api_key": 0}):
        user_count = await db.users.count_documents({"workspace_id": ws["id"]})
        workspaces.append({
            "id": ws["id"],
            "name": ws["name"],
            "slug": ws["slug"],
            "active": ws.get("active", True),
            "locations": ws.get("locations", []),
            "has_api_key": bool(ws.get("boomerangme_api_key")),
            "user_count": user_count
        })
    return {"success": True, "workspaces": workspaces}

@router.get("/workspaces/{workspace_id}")
async def get_workspace(workspace_id: str, current_user: dict = Depends(require_workspace_admin)):
    """Get workspace details. Workspace admins can only see their own."""
    if current_user.get("role") == "workspace_admin" and current_user.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a este workspace")
    
    ws = await db.workspaces.find_one({"id": workspace_id}, {"_id": 0})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace no encontrado")
    
    user_count = await db.users.count_documents({"workspace_id": workspace_id})

    workspace_response = {
        "id": ws["id"],
        "name": ws["name"],
        "slug": ws["slug"],
        "active": ws.get("active", True),
        "locations": ws.get("locations", []),
        "user_count": user_count
    }

    # API key visibility is Devotio-only — a workspace_admin (the client's own
    # business owner) should never see it, not even masked.
    if current_user.get("role") == "super_admin":
        api_key = ws.get("boomerangme_api_key", "")
        masked_key = f"{'*' * max(0, len(api_key) - 4)}{api_key[-4:]}" if len(api_key) > 4 else "****"
        workspace_response["api_key_masked"] = masked_key
        workspace_response["has_api_key"] = bool(api_key)

    return {"success": True, "workspace": workspace_response}

@router.put("/workspaces/{workspace_id}")
async def update_workspace(workspace_id: str, data: WorkspaceUpdate, current_user: dict = Depends(require_workspace_admin)):
    """Update workspace. Workspace admins can update their own."""
    if current_user.get("role") == "workspace_admin" and current_user.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a este workspace")
    
    ws = await db.workspaces.find_one({"id": workspace_id})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace no encontrado")
    
    update_fields = {}
    if data.name is not None:
        update_fields["name"] = data.name
    if data.boomerangme_api_key is not None and current_user.get("role") == "super_admin":
        update_fields["boomerangme_api_key"] = data.boomerangme_api_key
    if data.locations is not None:
        update_fields["locations"] = [loc.model_dump() for loc in data.locations]
    if data.active is not None and current_user.get("role") == "super_admin":
        update_fields["active"] = data.active
    
    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.workspaces.update_one({"id": workspace_id}, {"$set": update_fields})
    
    return {"success": True, "message": "Workspace actualizado"}

# ============ WORKSPACE USERS (Workspace Admin) ============

@router.get("/workspaces/{workspace_id}/users")
async def list_workspace_users(workspace_id: str, current_user: dict = Depends(require_workspace_admin)):
    """List users in a workspace."""
    if current_user.get("role") == "workspace_admin" and current_user.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a este workspace")
    
    users = []
    async for user in db.users.find(
        {"workspace_id": workspace_id},
        {"_id": 0, "password": 0, "hashed_password": 0}
    ):
        users.append({
            "id": user.get("id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "role": user.get("role"),
            "location": user.get("location")
        })
    return {"success": True, "users": users}

@router.post("/workspaces/{workspace_id}/users")
async def create_workspace_user(workspace_id: str, data: WorkspaceUserCreate, current_user: dict = Depends(require_workspace_admin)):
    """Create a user in a workspace."""
    if current_user.get("role") == "workspace_admin" and current_user.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a este workspace")
    
    ws = await db.workspaces.find_one({"id": workspace_id})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace no encontrado")
    
    existing = await db.users.find_one({"email": data.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(data.password)
    await db.users.insert_one({
        "_id": user_id,
        "id": user_id,
        "email": data.email,
        "hashed_password": hashed_pw,
        "password": hashed_pw,
        "name": data.name,
        "role": data.role,
        "workspace_id": workspace_id,
        "location": data.location
    })
    
    return {
        "success": True,
        "message": f"Usuario '{data.name}' creado exitosamente",
        "user": {
            "id": user_id,
            "email": data.email,
            "name": data.name,
            "role": data.role,
            "location": data.location
        }
    }

@router.delete("/workspaces/{workspace_id}/users/{user_id}")
async def delete_workspace_user(workspace_id: str, user_id: str, current_user: dict = Depends(require_workspace_admin)):
    """Delete a user from a workspace."""
    if current_user.get("role") == "workspace_admin" and current_user.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a este workspace")
    
    user = await db.users.find_one({"id": user_id, "workspace_id": workspace_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if user.get("role") == "super_admin":
        raise HTTPException(status_code=403, detail="No se puede eliminar un super admin")
    
    await db.users.delete_one({"id": user_id})
    return {"success": True, "message": "Usuario eliminado"}


@router.put("/workspaces/{workspace_id}/users/{user_id}/role")
async def update_user_role(workspace_id: str, user_id: str, data: dict, current_user: dict = Depends(require_workspace_admin)):
    """Update a user's role. Workspace admins can manage their own workspace users."""
    if current_user.get("role") == "workspace_admin" and current_user.get("workspace_id") != workspace_id:
        raise HTTPException(status_code=403, detail="No tiene acceso a este workspace")
    
    new_role = data.get("role")
    valid_roles = ["operator", "workspace_admin"]
    
    if new_role not in valid_roles:
        raise HTTPException(status_code=400, detail=f"Rol inválido. Opciones: {', '.join(valid_roles)}")
    
    target_user = await db.users.find_one({"id": user_id, "workspace_id": workspace_id})
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if target_user.get("role") == "super_admin" and current_user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="No puede modificar un super admin")
    
    await db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})
    return {"success": True, "message": f"Rol actualizado a '{new_role}'"}


# ============ SUPER ADMIN DASHBOARD ============

@router.post("/verify-master-code")
async def verify_master_code(data: dict):
    """Verify master code for super admin access."""
    if data.get("master_code") != MASTER_CODE:
        raise HTTPException(status_code=403, detail="Código maestro inválido")
    return {"success": True}

@router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(require_super_admin)):
    """Get super admin dashboard with all workspaces and stats."""
    workspaces = []
    async for ws in db.workspaces.find({}, {"_id": 0}):
        ws_id = ws["id"]
        user_count = await db.users.count_documents({"workspace_id": ws_id})
        ops_count = await db.operations.count_documents({"workspace_id": ws_id})
        
        # Get user breakdown by role
        admins = await db.users.count_documents({"workspace_id": ws_id, "role": "workspace_admin"})
        operators = await db.users.count_documents({"workspace_id": ws_id, "role": "operator"})
        
        workspaces.append({
            "id": ws_id,
            "name": ws["name"],
            "slug": ws.get("slug", ""),
            "active": ws.get("active", True),
            "locations": ws.get("locations", []),
            "has_api_key": bool(ws.get("boomerangme_api_key")),
            "created_at": ws.get("created_at"),
            "user_count": user_count,
            "admin_count": admins,
            "operator_count": operators,
            "operations_count": ops_count
        })
    
    total_users = await db.users.count_documents({})
    total_ops = await db.operations.count_documents({})
    
    return {
        "success": True,
        "workspaces": workspaces,
        "totals": {
            "workspaces": len(workspaces),
            "users": total_users,
            "operations": total_ops
        }
    }

@router.get("/dashboard/workspaces/{workspace_id}/users")
async def get_workspace_users_admin(workspace_id: str, current_user: dict = Depends(require_super_admin)):
    """Get all users of a workspace. Super admin only."""
    users = []
    async for user in db.users.find(
        {"workspace_id": workspace_id},
        {"_id": 0, "password": 0, "hashed_password": 0}
    ):
        users.append({
            "id": user.get("id"),
            "email": user.get("email"),
            "name": user.get("name"),
            "role": user.get("role"),
            "location": user.get("location")
        })
    return {"success": True, "users": users}

@router.post("/dashboard/users/{user_id}/reset-password")
async def reset_user_password(user_id: str, data: dict, current_user: dict = Depends(require_super_admin)):
    """Reset a user's password. Requires master code. Super admin only."""
    if data.get("master_code") != MASTER_CODE:
        raise HTTPException(status_code=403, detail="Código maestro inválido")
    
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    new_password = data.get("new_password")
    if not new_password:
        # Auto-generate temporary password
        import random
        import string
        new_password = f"Temp-{random.randint(1000, 9999)}-{''.join(random.choices(string.ascii_uppercase, k=3))}"
    
    hashed_pw = hash_password(new_password)
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"hashed_password": hashed_pw, "password": hashed_pw}}
    )
    
    return {
        "success": True,
        "message": f"Contraseña restablecida para {user.get('email')}",
        "new_password": new_password,
        "user_email": user.get("email")
    }

@router.patch("/dashboard/workspaces/{workspace_id}/toggle-active")
async def toggle_workspace_active(workspace_id: str, current_user: dict = Depends(require_super_admin)):
    """Toggle workspace active status. Super admin only."""
    ws = await db.workspaces.find_one({"id": workspace_id})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace no encontrado")
    
    new_status = not ws.get("active", True)
    await db.workspaces.update_one(
        {"id": workspace_id},
        {"$set": {"active": new_status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "active": new_status, "message": f"Workspace {'activado' if new_status else 'desactivado'}"}
