# Devotio Rewards Scanner API - Refactored Main Server

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import logging
from datetime import datetime, timezone

# Import database connection
from utils.config import client, db

# Import routers
from routes.auth import router as auth_router
from routes.settings import router as settings_router
from routes.workspaces import router as workspaces_router
from routes.cards import router as cards_router
from routes.operations import router as operations_router
from routes.templates import router as templates_router
from routes.customers import router as customers_router

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(title="Devotio Rewards Scanner API")

# Create main API router
api_router = APIRouter(prefix="/api")

# Include all routers
api_router.include_router(auth_router)
api_router.include_router(settings_router)
api_router.include_router(workspaces_router)
api_router.include_router(cards_router)
api_router.include_router(operations_router)
api_router.include_router(templates_router)
api_router.include_router(customers_router)

# Root-level health check for Kubernetes (MUST be at /health, not /api/health)
@app.get("/health")
async def root_health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# API-level endpoints
@api_router.get("/")
async def root():
    return {"message": "Devotio Rewards Scanner API", "version": "2.0.0"}

@api_router.get("/health")
async def api_health_check():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}

# Include API router in app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup migration
@app.on_event("startup")
async def run_migrations():
    """Ensure critical data is correct on every startup."""
    # Ensure demo@devotio.com has super_admin role
    result = await db.users.update_one(
        {"email": "demo@devotio.com", "role": {"$ne": "super_admin"}},
        {"$set": {"role": "super_admin"}}
    )
    if result.modified_count > 0:
        logger.info("Migration: Updated demo@devotio.com to super_admin role")

# Shutdown handler
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
