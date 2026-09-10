# Customer insights routes — reads from the local customer_stats cache
# (backend/utils/boomerang.py, upsert_customer_stats), not Boomerangme
# directly. Kept separate from routes/operations.py (a different concern:
# aggregate/point-in-time stats derived from raw operations vs. a
# per-customer running cache) and from routes/customers.py (that one proxies
# Boomerangme's own /customers search, unscoped by workspace — a completely
# different data source and semantics from this file).

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone
from utils.auth import require_workspace_admin
from utils.config import db

router = APIRouter(prefix="/customer-insights", tags=["customer-insights"])

AGE_BUCKETS = [
    ("18-24", 18, 25),
    ("25-34", 25, 35),
    ("35-44", 35, 45),
    ("45-54", 45, 55),
    ("55+", 55, 200),
]


@router.get("/age-distribution")
async def age_distribution(current_user: dict = Depends(require_workspace_admin)):
    """Bucket customer_stats.date_of_birth into age ranges. Computed in
    Python rather than a $dateDiff aggregation — the cache is one document
    per distinct customer (populated opportunistically on scan, no bulk
    backfill), small enough that a full pass is simpler and avoids a
    MongoDB-version dependency."""
    ws_id = current_user.get("workspace_id")
    total_customers = await db.customer_stats.count_documents({"workspace_id": ws_id})

    today = datetime.now(timezone.utc).date()
    buckets = {label: 0 for label, _, _ in AGE_BUCKETS}
    with_data = 0

    cursor = db.customer_stats.find(
        {"workspace_id": ws_id, "date_of_birth": {"$ne": None}},
        {"date_of_birth": 1}
    )
    async for doc in cursor:
        try:
            dob = datetime.fromisoformat(doc["date_of_birth"]).date()
        except (ValueError, TypeError):
            continue
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        with_data += 1
        for label, lo, hi in AGE_BUCKETS:
            if lo <= age < hi:
                buckets[label] += 1
                break

    return {
        "success": True,
        "buckets": [{"label": label, "count": buckets[label]} for label, _, _ in AGE_BUCKETS],
        "customers_with_data": with_data,
        "total_customers": total_customers
    }


ALLOWED_SORTS = {"last_seen_at", "total_visits", "first_seen_at", "customer_name", "total_purchase_sum"}


@router.get("/customers")
async def list_customers(
    page: int = 1,
    items_per_page: int = 25,
    sort_by: str = "last_seen_at",
    sort_dir: int = -1,
    current_user: dict = Depends(require_workspace_admin)
):
    """Customer Base — the local customer_stats cache, not a live Boomerangme
    fetch, so this stays fast/cheap regardless of workspace size."""
    ws_id = current_user.get("workspace_id")
    if sort_by not in ALLOWED_SORTS:
        sort_by = "last_seen_at"
    skip = (page - 1) * items_per_page
    query = {"workspace_id": ws_id}

    total = await db.customer_stats.count_documents(query)
    cursor = db.customer_stats.find(query, {"_id": 0}) \
        .sort(sort_by, sort_dir).skip(skip).limit(items_per_page)
    customers = await cursor.to_list(length=items_per_page)

    return {
        "success": True,
        "customers": customers,
        "meta": {
            "total": total,
            "page": page,
            "items_per_page": items_per_page,
            "total_pages": (total + items_per_page - 1) // items_per_page
        }
    }


@router.get("/customers/{phone}")
async def get_customer_stats(phone: str, current_user: dict = Depends(require_workspace_admin)):
    ws_id = current_user.get("workspace_id")
    record = await db.customer_stats.find_one(
        {"workspace_id": ws_id, "customer_phone": phone}, {"_id": 0}
    )
    if not record:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return {"success": True, "customer": record}
