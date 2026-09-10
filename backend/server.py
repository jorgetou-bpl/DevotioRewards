# Devotio Rewards Scanner API - Refactored Main Server

import os
import uuid

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
from routes.customer_insights import router as customer_insights_router

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
api_router.include_router(customer_insights_router)

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
cors_origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "").split(",") if origin.strip()]
cors_origin_regex = os.environ.get("CORS_ORIGIN_REGEX") or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Startup migration
@app.on_event("startup")
async def run_migrations():
    """Ensure critical data is correct on every startup. Idempotent."""
    import os
    import uuid

    # 1. Ensure demo@devotio.com has super_admin role
    result = await db.users.update_one(
        {"email": "demo@devotio.com", "role": {"$ne": "super_admin"}},
        {"$set": {"role": "super_admin"}}
    )
    if result.modified_count > 0:
        logger.info("Migration: Updated demo@devotio.com to super_admin role")

    # 2. Create "Devotio Default" workspace if it doesn't exist, using the global API key
    global_api_key = os.environ.get("BOOMERANG_API_KEY", "")
    default_ws = await db.workspaces.find_one({"slug": "devotio-default"})

    if not default_ws and global_api_key:
        ws_id = str(uuid.uuid4())
        default_ws = {
            "_id": ws_id,
            "id": ws_id,
            "name": "Devotio Default",
            "slug": "devotio-default",
            "boomerangme_api_key": global_api_key,
            "locations": [],
            "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": "system_migration"
        }
        await db.workspaces.insert_one(default_ws)
        logger.info(f"Migration: Created 'Devotio Default' workspace with ID {ws_id}")
    elif default_ws and global_api_key and not default_ws.get("boomerangme_api_key"):
        # Workspace exists but missing API key — update it
        await db.workspaces.update_one(
            {"slug": "devotio-default"},
            {"$set": {"boomerangme_api_key": global_api_key}}
        )
        logger.info("Migration: Updated Devotio Default workspace with global API key")

    # Get the default workspace ID for subsequent migrations
    default_ws = await db.workspaces.find_one({"slug": "devotio-default"})
    if not default_ws:
        logger.warning("Migration: No default workspace found, skipping user/data migration")
        return
    default_ws_id = default_ws["id"]

    # 3. Assign all users without workspace_id to the default workspace
    result = await db.users.update_many(
        {"workspace_id": {"$exists": False}},
        {"$set": {"workspace_id": default_ws_id}}
    )
    if result.modified_count > 0:
        logger.info(f"Migration: Assigned {result.modified_count} users to Devotio Default workspace")

    # Also catch users with null workspace_id
    result = await db.users.update_many(
        {"workspace_id": None},
        {"$set": {"workspace_id": default_ws_id}}
    )
    if result.modified_count > 0:
        logger.info(f"Migration: Assigned {result.modified_count} null-workspace users to Devotio Default")

    # 4. Migrate orphan data (operations, stamp_progress, tier_progress, rewards_earned)
    collections_to_migrate = ["operations", "stamp_progress", "tier_progress", "rewards_earned"]
    for coll_name in collections_to_migrate:
        coll = db[coll_name]
        result = await coll.update_many(
            {"workspace_id": {"$exists": False}},
            {"$set": {"workspace_id": default_ws_id}}
        )
        if result.modified_count > 0:
            logger.info(f"Migration: Assigned {result.modified_count} {coll_name} records to Devotio Default")
        # Also null values
        result = await coll.update_many(
            {"workspace_id": None},
            {"$set": {"workspace_id": default_ws_id}}
        )
        if result.modified_count > 0:
            logger.info(f"Migration: Fixed {result.modified_count} null workspace_id in {coll_name}")

    # 5. Ensure indexes exist and customer_stats is backfilled from existing
    # operations history — both idempotent, safe to run on every boot.
    await ensure_indexes()
    await backfill_customer_stats()


async def ensure_indexes():
    """create_index() is a no-op if an equivalent index already exists.
    `operations` had zero indexes before this — every existing query already
    filters by workspace_id, so this alone is a meaningful fix, not just prep
    for the new customer_stats-backed features."""
    await db.operations.create_index([("workspace_id", 1), ("created_at", -1)])
    await db.operations.create_index([("workspace_id", 1), ("customer_phone", 1)])
    await db.customer_stats.create_index([("workspace_id", 1), ("customer_phone", 1)], unique=True)
    await db.customer_stats.create_index([("workspace_id", 1), ("total_visits", -1)])
    await db.customer_stats.create_index([("workspace_id", 1), ("total_purchase_sum", -1)])
    await db.customer_stats.create_index([("workspace_id", 1), ("last_seen_at", -1)])
    await db.customer_stats.create_index([("workspace_id", 1), ("first_seen_at", 1)])
    logger.info("Migration: Ensured operations/customer_stats indexes")


async def backfill_customer_stats():
    """Recompute total_visits/first_seen_at/last_seen_at/total_purchase_sum
    for every customer from the existing `operations` history. Uses $set
    (absolute values from source of truth), not $inc, so it's safe to rerun
    on every startup regardless of how much live traffic has landed since the
    last run. Deliberately does NOT touch date_of_birth — that field is only
    ever populated going forward (see upsert_customer_stats in
    utils/boomerang.py); old operations rows never captured it, so there's
    nothing to backfill there."""
    pipeline = [
        {"$match": {"customer_phone": {"$nin": [None, ""]}}},
        {"$group": {
            "_id": {"workspace_id": "$workspace_id", "customer_phone": "$customer_phone"},
            "customer_name": {"$last": "$customer_name"},
            "card_id": {"$last": "$card_id"},
            "first_seen_at": {"$min": "$created_at"},
            "last_seen_at": {"$max": "$created_at"},
            "total_visits": {"$sum": 1},
            "total_purchase_sum": {"$sum": {"$ifNull": ["$purchase_sum", 0]}}
        }}
    ]
    backfilled = 0
    async for row in db.operations.aggregate(pipeline):
        key = row.pop("_id")
        await db.customer_stats.update_one(
            {"workspace_id": key["workspace_id"], "customer_phone": key["customer_phone"]},
            {
                "$setOnInsert": {"id": str(uuid.uuid4())},
                "$set": row
            },
            upsert=True
        )
        backfilled += 1
    if backfilled:
        logger.info(f"Migration: Backfilled customer_stats for {backfilled} customers")

# Shutdown handler
@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
