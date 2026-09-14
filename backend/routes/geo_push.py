# GeoPush location routes — thin proxy over Boomerangme's own geolocation
# push feature (Apple Wallet's native "relevant locations" mechanism). The
# ~330ft/100m radius, non-dismissible-while-in-range behavior, and per-entry
# (not daily-capped) firing are fixed by Apple's PassKit / Boomerangme's
# platform — not configurable via this or any API. This only manages what
# Boomerangme's API actually exposes: name/address/message/coordinates/
# display/templateIds per location.

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging

from models import GeoLocationCreate, GeoLocationUpdate
from utils.auth import require_workspace_admin
from utils.boomerang import call_boomerang_api, get_user_friendly_error, get_workspace_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/geo-locations", tags=["geo-locations"])


def _to_boomerang_payload(data: dict) -> dict:
    mapping = {"template_ids": "templateIds"}
    return {mapping.get(k, k): v for k, v in data.items() if v is not None}


def _map_location(loc: dict) -> dict:
    return {
        "id": loc.get("id"),
        "name": loc.get("name"),
        "address": loc.get("address"),
        "latitude": loc.get("latitude"),
        "longitude": loc.get("longitude"),
        "message": loc.get("message"),
        "display": loc.get("display"),
        "template_ids": loc.get("templateIds", []),
    }


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

    return {
        "success": True,
        "locations": [_map_location(loc) for loc in (response.get("data") or [])],
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
    body = _to_boomerang_payload(payload.model_dump())
    api_key = await get_workspace_api_key(current_user)
    response = await call_boomerang_api('POST', '/locations', body, api_key=api_key)
    return {"success": True, "location": _map_location(response.get("data") or {})}


@router.patch("/{location_id}")
async def update_geo_location(
    location_id: str,
    payload: GeoLocationUpdate,
    current_user: dict = Depends(require_workspace_admin)
):
    body = _to_boomerang_payload(payload.model_dump(exclude_unset=True))
    api_key = await get_workspace_api_key(current_user)
    response = await call_boomerang_api('PATCH', f'/locations/{location_id}', body, api_key=api_key)
    return {"success": True, "location": _map_location(response.get("data") or {})}


@router.delete("/{location_id}")
async def delete_geo_location(
    location_id: str,
    current_user: dict = Depends(require_workspace_admin)
):
    api_key = await get_workspace_api_key(current_user)
    await call_boomerang_api('DELETE', f'/locations/{location_id}', {}, api_key=api_key)
    return {"success": True}
