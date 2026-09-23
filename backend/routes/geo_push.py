# GeoPush location routes — thin proxy over Boomerangme's own geolocation
# push feature (Apple Wallet's native "relevant locations" mechanism). The
# ~330ft/100m radius, non-dismissible-while-in-range behavior, and per-entry
# (not daily-capped) firing are fixed by Apple's PassKit / Boomerangme's
# platform — not configurable via this or any API. This only manages what
# Boomerangme's API actually exposes: name/address/message/coordinates/
# display/templateIds per location.
#
# Business-hours scheduling (open_time/close_time) is a concept Boomerangme
# doesn't have at all — it's stored locally in db.geo_location_schedules and
# applied by utils.geo_scheduler, which flips `display` on Boomerangme's
# side on a timer. Confirmed live (2026-09-21) that toggling `display: false`
# actually removes the geofence from an already-installed pass, not just a
# dashboard-only filter — the scheduler approach is sound.

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging

from models import GeoLocationCreate, GeoLocationUpdate
from utils.auth import require_workspace_admin
from utils.boomerang import call_boomerang_api, get_user_friendly_error, get_workspace_api_key
from utils.config import db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/geo-locations", tags=["geo-locations"])

# Fields that only exist locally — never forwarded to Boomerangme's API.
SCHEDULE_FIELDS = {"schedule_enabled", "open_time", "close_time"}


def _to_boomerang_payload(data: dict) -> dict:
    mapping = {"template_ids": "templateIds"}
    return {
        mapping.get(k, k): v
        for k, v in data.items()
        if v is not None and k not in SCHEDULE_FIELDS
    }


def _map_location(loc: dict, schedule: Optional[dict] = None) -> dict:
    schedule = schedule or {}
    return {
        "id": loc.get("id"),
        "name": loc.get("name"),
        "address": loc.get("address"),
        "latitude": loc.get("latitude"),
        "longitude": loc.get("longitude"),
        "message": loc.get("message"),
        "display": loc.get("display"),
        "template_ids": loc.get("templateIds", []),
        "schedule_enabled": schedule.get("enabled", False),
        "open_time": schedule.get("open_time"),
        "close_time": schedule.get("close_time"),
    }


async def _upsert_schedule(workspace_id: str, location_id, payload: dict):
    """Store/clear the local schedule for a location. Only touches Mongo
    when schedule fields were actually part of the request (partial PATCHes
    that don't mention scheduling shouldn't wipe an existing one)."""
    provided = {k: v for k, v in payload.items() if k in SCHEDULE_FIELDS}
    if not provided:
        return

    set_fields = {"workspace_id": workspace_id, "location_id": str(location_id)}
    if "schedule_enabled" in provided:
        set_fields["enabled"] = provided["schedule_enabled"]
    if "open_time" in provided:
        set_fields["open_time"] = provided["open_time"]
    if "close_time" in provided:
        set_fields["close_time"] = provided["close_time"]

    # Validate the *effective* state (existing + this partial update), not
    # just what's in this request — a PATCH that only touches open_time
    # must not bypass the "needs both times to be enabled" check, nor
    # silently reset schedule_enabled by omission.
    existing = await _get_schedule(workspace_id, location_id) or {}
    effective_enabled = set_fields.get("enabled", existing.get("enabled", False))
    effective_open = set_fields.get("open_time", existing.get("open_time"))
    effective_close = set_fields.get("close_time", existing.get("close_time"))
    if effective_enabled and not (effective_open and effective_close):
        raise HTTPException(status_code=422, detail="Se necesita hora de apertura y cierre para activar el horario")

    await db.geo_location_schedules.update_one(
        {"workspace_id": workspace_id, "location_id": str(location_id)},
        {"$set": set_fields},
        upsert=True
    )


async def _get_schedule(workspace_id: str, location_id) -> Optional[dict]:
    return await db.geo_location_schedules.find_one(
        {"workspace_id": workspace_id, "location_id": str(location_id)}, {"_id": 0}
    )


@router.get("")
async def list_geo_locations(
    page: int = 1,
    items_per_page: int = 30,
    current_user: dict = Depends(require_workspace_admin)
):
    api_key = await get_workspace_api_key(current_user)
    response = await call_boomerang_api(
        'GET', '/locations', {"page": page, "itemsPerPage": items_per_page},
        raise_on_error=False, api_key=api_key
    )
    if response.get('code') != 200:
        raise HTTPException(status_code=502, detail=get_user_friendly_error("api_error"))

    meta = response.get("meta") or {}
    total = meta.get("totalItems", 0)
    per_page = meta.get("itemsPerPage", items_per_page) or items_per_page

    workspace_id = current_user.get("workspace_id")
    schedules = {
        s["location_id"]: s
        async for s in db.geo_location_schedules.find({"workspace_id": workspace_id}, {"_id": 0})
    }

    return {
        "success": True,
        "locations": [
            _map_location(loc, schedules.get(str(loc.get("id"))))
            for loc in (response.get("data") or [])
        ],
        "meta": {
            "total": total,
            "page": meta.get("currentPage", page),
            "items_per_page": per_page,
            "total_pages": (total + per_page - 1) // per_page if per_page else 1,
        }
    }


@router.post("")
async def create_geo_location(
    payload: GeoLocationCreate,
    current_user: dict = Depends(require_workspace_admin)
):
    data = payload.model_dump()
    body = _to_boomerang_payload(data)
    api_key = await get_workspace_api_key(current_user)
    response = await call_boomerang_api('POST', '/locations', body, api_key=api_key)
    location_data = response.get("data") or {}

    workspace_id = current_user.get("workspace_id")
    await _upsert_schedule(workspace_id, location_data.get("id"), data)
    schedule = await _get_schedule(workspace_id, location_data.get("id"))

    return {"success": True, "location": _map_location(location_data, schedule)}


@router.patch("/{location_id}")
async def update_geo_location(
    location_id: str,
    payload: GeoLocationUpdate,
    current_user: dict = Depends(require_workspace_admin)
):
    data = payload.model_dump(exclude_unset=True)
    body = _to_boomerang_payload(data)
    api_key = await get_workspace_api_key(current_user)
    if body:
        response = await call_boomerang_api('PATCH', f'/locations/{location_id}', body, api_key=api_key)
        location_data = response.get("data") or {}
    else:
        # Pure schedule update — nothing Boomerangme-relevant changed, no
        # need to call their API at all.
        response = await call_boomerang_api('GET', f'/locations/{location_id}', {}, api_key=api_key)
        location_data = response.get("data") or {}

    workspace_id = current_user.get("workspace_id")
    await _upsert_schedule(workspace_id, location_id, data)
    schedule = await _get_schedule(workspace_id, location_id)

    return {"success": True, "location": _map_location(location_data, schedule)}


@router.delete("/{location_id}")
async def delete_geo_location(
    location_id: str,
    current_user: dict = Depends(require_workspace_admin)
):
    api_key = await get_workspace_api_key(current_user)
    await call_boomerang_api('DELETE', f'/locations/{location_id}', {}, api_key=api_key)
    await db.geo_location_schedules.delete_one(
        {"workspace_id": current_user.get("workspace_id"), "location_id": str(location_id)}
    )
    return {"success": True}
