# Template routes

from fastapi import APIRouter, HTTPException, Depends
import logging
from utils.auth import get_current_user, require_super_admin
from utils.boomerang import call_boomerang_api, get_user_friendly_error, get_api_key_for_workspace

logger = logging.getLogger(__name__)
router = APIRouter(tags=["templates"])

STAMP_TEMPLATE_TYPE = 0

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
            "rewardTiers": tiers
        })

    return {"success": True, "templates": templates}

@router.get("/templates/{template_id}")
async def get_template(template_id: str, current_user: dict = Depends(get_current_user)):
    """Get card template details including reward tier configuration and accrual program info."""
    try:
        response = await call_boomerang_api('GET', f'/templates/{template_id}', {})
        
        if response.get('code') == 200:
            template_data = response.get('data', {})
            reward_tiers = template_data.get('rewardTiers', [])
            
            # Extract accrual program info for stamp/reward cards
            # Possible values: 'points' (manual), 'spend' (purchase amount), 'visit' (per visit)
            accrual_program = template_data.get('accrualProgram') or template_data.get('program')
            accrual_ratio = template_data.get('accrualRatio') or template_data.get('pointsRatio', {})
            
            return {
                "success": True,
                "template": {
                    "id": template_data.get('id'),
                    "name": template_data.get('name'),
                    "type": template_data.get('type'),
                    "rewardTiers": reward_tiers,
                    # Accrual program configuration
                    "accrualProgram": accrual_program,
                    "accrualRatio": accrual_ratio,
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
