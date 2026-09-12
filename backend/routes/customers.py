# Customer routes

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging
from utils.auth import get_current_user
from utils.boomerang import call_boomerang_api, mask_pii, get_user_friendly_error, get_workspace_api_key

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/customers", tags=["customers"])

# Every call in this file was missing this — call_boomerang_api() silently
# falls back to the global BOOMERANG_API_KEY env var when none is passed,
# instead of the workspace's own key, which is what every other route
# (cards.py, templates.py, settings.py) resolves via this exact dependency.
# That's why phone/email search always failed with "API key not found" while
# card-ID scans (which go through cards.py's own get_api_key) worked fine.
async def get_api_key(current_user: dict = Depends(get_current_user)):
    return await get_workspace_api_key(current_user)

@router.get("")
async def search_customers(
    phone: Optional[str] = None,
    email: Optional[str] = None,
    page: int = 1,
    itemsPerPage: int = 20,
    current_user: dict = Depends(get_current_user),
    api_key: str = Depends(get_api_key)
):
    """Search customers by phone or email."""
    # call_boomerang_api's GET path does client.get(url, params=data) — passing
    # a dict here (rather than hand-building "?page=...&phone=..." into the
    # endpoint string) is required, not just cleaner: httpx's params= argument
    # replaces the URL's own query string rather than merging with it, so the
    # old approach silently dropped every query param (confirmed live — the
    # actual outbound request Boomerangme received was a bare "/customers"
    # with no phone/email/page at all, which is why search always returned
    # the full unfiltered customer list instead of a real match).
    params = {"page": page, "itemsPerPage": itemsPerPage}
    if phone:
        params["phone"] = phone
    if email:
        params["email"] = email

    response = await call_boomerang_api('GET', '/customers', params, api_key=api_key)
    customers = response.get('data', [])
    
    masked_customers = []
    for customer in customers:
        masked = customer.copy()
        if 'email' in masked:
            masked['email'] = '***@***.***'
        if 'phone' in masked:
            masked['phone'] = '***-****'
        masked_customers.append(masked)
    
    return {
        "success": True,
        "customers": masked_customers,
        "meta": response.get('meta', {})
    }

@router.get("/{customer_id}")
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user), api_key: str = Depends(get_api_key)):
    """Get customer details."""
    response = await call_boomerang_api('GET', f'/customers/{customer_id}', {}, api_key=api_key)
    return {"success": True, "customer": mask_pii(response.get('data', {}))}

@router.get("/{customer_id}/cards")
async def get_customer_cards(customer_id: str, current_user: dict = Depends(get_current_user), api_key: str = Depends(get_api_key)):
    """Get all cards for a customer.

    Per docs/BOOMERANGME_API_DOCUMENTATION.md: "/customers/{id}/cards" does
    not exist on Boomerangme's side and always 404s (confirmed live — a
    generic HTML error page, not a JSON API response). The documented,
    working endpoint is "/cards?customerId={id}"."""
    response = await call_boomerang_api('GET', '/cards', {"customerId": customer_id}, api_key=api_key)
    cards = response.get('data', [])
    
    masked_cards = [mask_pii(card) for card in cards]
    
    return {
        "success": True,
        "cards": masked_cards
    }
