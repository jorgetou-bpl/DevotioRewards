# Template routes

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging
from utils.auth import get_current_user, require_super_admin
from utils.boomerang import call_boomerang_api, get_user_friendly_error, get_api_key_for_workspace, get_workspace_api_key

logger = logging.getLogger(__name__)
router = APIRouter(tags=["templates"])

STAMP_TEMPLATE_TYPE = 'stamp'  # Boomerangme returns type as a string, not our numeric notation

@router.get("/templates")
async def list_templates(workspace_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """List all Boomerangme templates (id, name, type) for the current user's
    own workspace — or, for super_admin, an explicitly targeted workspace.
    Any authenticated role may call this; it only exposes the same
    id/name/type already visible on every scanned card, used to populate
    'filter by specific card' pickers (e.g. operations history/dashboard)."""
    ws_id = workspace_id if (workspace_id and current_user.get("role") == "super_admin") else current_user.get("workspace_id")
    api_key = await get_api_key_for_workspace(ws_id)
    response = await call_boomerang_api(
        'GET', '/templates', {"itemsPerPage": 100}, raise_on_error=False, api_key=api_key
    )
    if response.get('code') != 200:
        return {"success": True, "templates": []}

    templates = [
        {"id": t.get("id"), "name": t.get("name") or f"Plantilla #{t.get('id')}", "type": t.get("type")}
        for t in (response.get('data', []) or [])
    ]
    return {"success": True, "templates": templates}

@router.get("/templates/by-type")
async def list_templates_by_type(
    workspace_id: str,
    template_type: str,
    current_user: dict = Depends(require_super_admin)
):
    """List a workspace's Boomerangme templates of a given type — Boomerangme's
    own type strings (e.g. 'stamp', 'coupon', 'discount', 'cashback',
    'certificate', 'membership', 'reward', 'subscription'), not our numeric
    notation. Raw fields included — used to discover what a template actually
    exposes (e.g. a coupon's benefit text) before building UI around it, and
    as groundwork for per-template (not just per-type) card config. Devotio-only."""
    api_key = await get_api_key_for_workspace(workspace_id)
    response = await call_boomerang_api(
        'GET', '/templates', {"itemsPerPage": 100}, raise_on_error=False, api_key=api_key
    )
    if response.get('code') != 200:
        raise HTTPException(status_code=502, detail=get_user_friendly_error("api_error"))

    all_templates = response.get('data', []) or []
    matches = [t for t in all_templates if t.get('type') == template_type]
    return {"success": True, "templates": matches}

@router.get("/templates/stamp-cards")
async def list_stamp_card_templates(workspace_id: str, current_user: dict = Depends(require_super_admin)):
    """List a workspace's stamp card templates with their configured reward tiers,
    read directly from Boomerangme — this is the source of truth for a card's reward
    structure (e.g. a reward at 2 stamps and another at 5), not something we duplicate
    as separate app-side configuration."""
    api_key = await get_api_key_for_workspace(workspace_id)
    response = await call_boomerang_api(
        'GET', '/templates', {"itemsPerPage": 100}, raise_on_error=False, api_key=api_key
    )
    if response.get('code') != 200:
        raise HTTPException(status_code=502, detail=get_user_friendly_error("api_error"))

    templates = []
    for t in response.get('data', []) or []:
        if t.get('type') != STAMP_TEMPLATE_TYPE:
            continue
        tiers = sorted(
            (
                {"id": tier.get("id"), "name": tier.get("name"), "threshold": tier.get("threshold")}
                for tier in (t.get('rewardTiers') or [])
                if tier.get("threshold") is not None
            ),
            key=lambda tier: tier["threshold"]
        )
        templates.append({
            "id": t.get("id"),
            "name": t.get("name") or f"Tarjeta de sellos #{t.get('id')}",
            "rewardTiers": tiers,
            # Stamps granted per visit — configured on the template itself
            # (mechanics.accrual.stampsPerAccrual), read directly rather than
            # duplicated as separate app-side config.
            "stampsPerVisit": (t.get('mechanics') or {}).get('accrual', {}).get('stampsPerAccrual') or 1
        })

    return {"success": True, "templates": templates}

@router.get("/templates/{template_id}")
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get card template details including reward tier configuration and accrual program info."""
    try:
        api_key = await get_workspace_api_key(current_user)
        response = await call_boomerang_api('GET', f'/templates/{template_id}', {}, api_key=api_key)

        if response.get('code') == 200:
            template_data = response.get('data', {})
            reward_tiers = template_data.get('rewardTiers', [])
            mechanics = template_data.get('mechanics', {}) or {}

            # Extract accrual program info for reward (Puntos) cards.
            # Possible program.type values: 'points' (manual), 'spend' (purchase
            # amount), 'visits' (per visit) — confirmed live. spentValue/earnedValue
            # is the actual ratio regardless of type (e.g. spend: spentValue:1,
            # earnedValue:10 → ₡1 = 10 puntos; visits: spentValue:1, earnedValue:1
            # → 1 visita = 1 punto) — configured on the template itself and read
            # live rather than duplicated as separate app-side config, same as
            # stampsPerVisit.
            program = mechanics.get('program', {}) or {}
            accrual_program = program.get('type') or template_data.get('accrualProgram')
            points_ratio = None
            if program.get('spentValue') is not None and program.get('earnedValue') is not None:
                points_ratio = {"spentValue": program.get('spentValue'), "earnedValue": program.get('earnedValue')}

            return {
                "success": True,
                "template": {
                    "id": template_data.get('id'),
                    "name": template_data.get('name'),
                    "type": template_data.get('type'),
                    "rewardTiers": reward_tiers,
                    # Accrual program configuration
                    "accrualProgram": accrual_program,
                    "pointsRatio": points_ratio,
                    # Free-text benefit description (e.g. a coupon's "10% OFF" or
                    # "buy one get one free") — Boomerangme stores this under
                    # mechanics.firstVisitDiscount regardless of card type.
                    "benefitDescription": mechanics.get('firstVisitDiscount') or None,
                    # Stamps granted per visit, read from the template's own
                    # accrual config (mechanics.accrual.stampsPerAccrual) —
                    # not duplicated as separate app-side config.
                    "stampsPerVisit": mechanics.get('accrual', {}).get('stampsPerAccrual') or 1,
                    # Include raw data for debugging
                    "rawKeys": list(template_data.keys())
                }
            }
        else:
            raise HTTPException(
                status_code=response.get('code', 404), 
                detail=get_user_friendly_error("card_not_found")
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching template: {e}")
        raise HTTPException(status_code=500, detail=get_user_friendly_error("general_error", str(e)))
