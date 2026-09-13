# Push notification routes — thin proxy over Boomerangme's own push API.
# No local storage: Boomerangme already tracks status/sentAmount/deliveredAmount,
# there's nothing here worth caching (unlike customer_stats, which exists
# because Boomerangme has no bulk customer endpoint at all).

from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from typing import Optional
import logging

from models import PushNotificationCreate
from utils.auth import require_workspace_admin
from utils.boomerang import call_boomerang_api, get_user_friendly_error, get_workspace_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/notifications", tags=["notifications"])


def _to_boomerang_datetime(iso_string: str) -> str:
    """Convert a browser-supplied ISO datetime (with timezone, e.g. from
    `new Date(...).toISOString()`) into Boomerangme's expected Y-m-dTH:i:sP
    format — ISO 8601 with a colon in the UTC offset, which Python's %z
    does not produce on its own."""
    dt = datetime.fromisoformat(iso_string.replace("Z", "+00:00"))
    formatted = dt.strftime("%Y-%m-%dT%H:%M:%S%z")
    return f"{formatted[:-2]}:{formatted[-2:]}"


@router.post("/push")
async def send_push_notification(
    payload: PushNotificationCreate,
    current_user: dict = Depends(require_workspace_admin)
):
    """Send (or schedule) a push notification to every cardholder of the
    given Boomerangme template for the current workspace — cardId is
    intentionally omitted so Boomerangme broadcasts to the whole audience.
    Audience segmentation is not supported yet (see project plan)."""
    body = {"message": payload.message, "templateId": payload.template_id}
    if payload.scheduled_at:
        try:
            body["scheduledAt"] = _to_boomerang_datetime(payload.scheduled_at)
        except ValueError:
            raise HTTPException(status_code=422, detail="Fecha de programación inválida")

    api_key = await get_workspace_api_key(current_user)
    response = await call_boomerang_api('POST', '/pushes', body, api_key=api_key)

    data = response.get("data") or {}
    return {
        "success": True,
        "push": {
            "id": data.get("id") or response.get("responseId"),
            "created_at": response.get("createdAt"),
        }
    }


@router.get("/pushes")
async def list_push_notifications(
    template_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    items_per_page: int = 30,
    current_user: dict = Depends(require_workspace_admin)
):
    """History of push notifications for the current workspace, proxied live
    from Boomerangme (paginated) — no local copy is kept, see project plan
    for why."""
    params = {"page": page, "itemsPerPage": items_per_page}
    if template_id:
        params["templateId"] = template_id
    if start_date:
        params["startDate"] = start_date
    if end_date:
        params["endDate"] = end_date

    api_key = await get_workspace_api_key(current_user)
    response = await call_boomerang_api('GET', '/pushes', params, raise_on_error=False, api_key=api_key)
    if response.get('code') != 200:
        raise HTTPException(status_code=502, detail=get_user_friendly_error("api_error"))

    meta = response.get("meta") or {}
    total = meta.get("totalItems", 0)
    per_page = meta.get("itemsPerPage", items_per_page) or items_per_page

    pushes = [
        {
            "id": p.get("id"),
            "message": p.get("message"),
            "template_id": p.get("templateId"),
            "status": p.get("status"),
            "sent_amount": p.get("sentAmount"),
            "delivered_amount": p.get("deliveredAmount"),
            "created_at": p.get("createdAt"),
            "scheduled_at": p.get("scheduledAt"),
        }
        for p in (response.get("data") or [])
    ]

    return {
        "success": True,
        "pushes": pushes,
        "meta": {
            "total": total,
            "page": meta.get("currentPage", page),
            "items_per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page if per_page else 1,
        }
    }
