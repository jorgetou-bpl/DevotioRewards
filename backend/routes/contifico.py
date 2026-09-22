# Contífico integration routes — dashboard stats, transaction list, and
# manual resolution of pending (unmatched) transactions.

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel
from utils.auth import get_current_user
from utils.config import db
from utils.boomerang import get_workspace_api_key, mask_pii
from utils.contifico import sync_workspace_contifico, resolve_pending_transaction

router = APIRouter(prefix="/contifico", tags=["contifico"])


class ResolveTransactionRequest(BaseModel):
    card_id: str
    customer_id: str


@router.get("/transactions")
async def list_transactions(
    status: Optional[str] = None,
    page: int = 1,
    items_per_page: int = 25,
    current_user: dict = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    query = {"workspace_id": ws_id}
    if status:
        query["status"] = status

    total = await db.contifico_transactions.count_documents(query)
    cursor = db.contifico_transactions.find(query, {"_id": 0}) \
        .sort("created_at", -1) \
        .skip((page - 1) * items_per_page) \
        .limit(items_per_page)
    transactions = await cursor.to_list(length=items_per_page)

    return {
        "success": True,
        "transactions": transactions,
        "meta": {
            "total": total,
            "page": page,
            "items_per_page": items_per_page,
            "total_pages": max(1, -(-total // items_per_page)),
        },
    }


@router.get("/stats")
async def get_stats(
    period: str = "today",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    today = datetime.now(timezone.utc).date()

    if period == "week":
        start = today - timedelta(days=today.weekday())
        end = today
    elif period == "month":
        start = today.replace(day=1)
        end = today
    elif period == "custom" and from_date and to_date:
        start = datetime.fromisoformat(from_date).date()
        end = datetime.fromisoformat(to_date).date()
    else:
        start = end = today

    query = {
        "workspace_id": ws_id,
        "created_at": {"$gte": start.isoformat(), "$lte": end.isoformat() + "T23:59:59"},
    }

    total_transactions = await db.contifico_transactions.count_documents(query)
    pending_count = await db.contifico_transactions.count_documents({**query, "status": "pending"})

    pipeline = [
        {"$match": {**query, "status": "processed"}},
        {"$group": {"_id": None, "total_amount": {"$sum": "$amount"}}},
    ]
    agg = await db.contifico_transactions.aggregate(pipeline).to_list(length=1)
    total_credited = agg[0]["total_amount"] if agg else 0

    ws = await db.workspaces.find_one({"id": ws_id}, {"_id": 0, "contifico": 1})
    last_sync = (ws or {}).get("contifico", {}).get("last_synced_at")

    return {
        "success": True,
        "stats": {
            "total_transactions": total_transactions,
            "total_credited": total_credited,
            "pending_count": pending_count,
            "last_sync": last_sync,
        },
        "period": {"from": start.isoformat(), "to": end.isoformat()},
    }


@router.post("/transactions/{transaction_id}/resolve")
async def resolve_transaction(
    transaction_id: str,
    data: ResolveTransactionRequest,
    current_user: dict = Depends(get_current_user)
):
    ws_id = current_user.get("workspace_id")
    boomerang_api_key = await get_workspace_api_key(current_user)
    try:
        card_data = await resolve_pending_transaction(
            transaction_id, data.card_id, data.customer_id, ws_id, boomerang_api_key, current_user
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"success": True, "card": mask_pii(card_data)}


@router.post("/sync")
async def trigger_sync(current_user: dict = Depends(get_current_user)):
    """Manual sync trigger. Until a workspace has real Contífico credentials
    (workspace.contifico.api_key + enabled=true) and a scheduled job is
    wired up, this is how a sync run gets kicked off for testing."""
    ws_id = current_user.get("workspace_id")
    workspace = await db.workspaces.find_one({"id": ws_id}, {"_id": 0})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace no encontrado")
    return await sync_workspace_contifico(workspace)
