# Template routes

from fastapi import APIRouter, HTTPException, Depends
import logging
from utils.auth import get_current_user
from utils.boomerang import call_boomerang_api, get_user_friendly_error

logger = logging.getLogger(__name__)
router = APIRouter(tags=["templates"])

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
