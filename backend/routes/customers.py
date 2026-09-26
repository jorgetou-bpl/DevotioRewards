# Customer routes

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import re
import logging
from utils.auth import get_current_user
from utils.boomerang import call_boomerang_api, mask_pii, get_user_friendly_error, get_workspace_api_key
from utils.config import db
from routes.cards import is_email

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

@router.get("/search")
async def search_customer_base(
    q: str,
    current_user: dict = Depends(get_current_user)
):
    """Unified search over the local Customer Base (customer_stats), for the
    Clientes page's single search field — phone, email, cédula, or name.
    Registered before /{customer_id} so "search" isn't matched as that path
    param (same pitfall customer_insights.py's /customers/export already
    hit).

    A waterfall rather than a strict format branch: a 9-digit Costa Rican
    cédula and an 8-11 digit phone number are both "just digits" in the same
    length range, so there's no reliable way to tell them apart from the
    string alone — try phone first (cheap, local), then email (only format
    Boomerangme's own search can resolve, since there's no local email
    index), then the cédula mapping learned from Contífico reconciliation,
    then finally a name match against the local cache (best-effort, not
    authoritative)."""
    ws_id = current_user.get("workspace_id")
    query = (q or "").strip()
    if not query:
        return {"success": True, "customers": [], "match_type": None}

    projection = {"_id": 0}
    cleaned_digits = re.sub(r'[\s\-\(\)\+]', '', query)

    if cleaned_digits.isdigit() and 7 <= len(cleaned_digits) <= 15:
        matches = await db.customer_stats.find(
            {"workspace_id": ws_id, "customer_phone": {"$regex": re.escape(cleaned_digits)}}, projection
        ).limit(10).to_list(length=10)
        if matches:
            return {"success": True, "customers": matches, "match_type": "phone"}

    if is_email(query):
        api_key = await get_workspace_api_key(current_user)
        response = await call_boomerang_api('GET', '/customers', {"email": query}, raise_on_error=False, api_key=api_key)
        phones = [c.get('phone') for c in (response.get('data') or []) if c.get('phone')]
        matches = []
        if phones:
            matches = await db.customer_stats.find(
                {"workspace_id": ws_id, "customer_phone": {"$in": phones}}, projection
            ).to_list(length=10)
        return {"success": True, "customers": matches, "match_type": "email"}

    if cleaned_digits.isdigit():
        mapping = await db.customer_identifiers.find_one({"workspace_id": ws_id, "cedula": cleaned_digits})
        if mapping and mapping.get("card_id"):
            match = await db.customer_stats.find_one(
                {"workspace_id": ws_id, "card_id": mapping["card_id"]}, projection
            )
            if match:
                return {"success": True, "customers": [match], "match_type": "cedula"}

    matches = await db.customer_stats.find(
        {"workspace_id": ws_id, "customer_name": {"$regex": re.escape(query), "$options": "i"}}, projection
    ).limit(10).to_list(length=10)
    return {"success": True, "customers": matches, "match_type": "name" if matches else None}


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
