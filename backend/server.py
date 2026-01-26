# Devotio Rewards Scanner API - Refactored Main Server

from fastapi import FastAPI, APIRouter
from starlette.middleware.cors import CORSMiddleware
import logging
from datetime import datetime, timezone

# Import database connection
from utils.config import client

# Import routers
from routes.auth import router as auth_router
from routes.settings import router as settings_router
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
api_router.include_router(cards_router)
api_router.include_router(operations_router)
api_router.include_router(templates_router)
api_router.include_router(customers_router)

# Health check and root endpoints
@api_router.get("/")
async def root():
    return {"message": "Devotio Rewards Scanner API", "version": "2.0.0"}

@api_router.get("/health")
async def health_check():
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

# Shutdown handler
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
