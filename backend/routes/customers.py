# Customer routes

from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging
from utils.auth import get_current_user
from utils.boomerang import call_boomerang_api, mask_pii, get_user_friendly_error

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/customers", tags=["customers"])

@router.get("")
async def search_customers(
    phone: Optional[str] = None,
    email: Optional[str] = None,
    page: int = 1,
    itemsPerPage: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Search customers by phone or email."""
    params = f'page={page}&itemsPerPage={itemsPerPage}'
    
    if phone:
        params += f'&phone={phone}'
    if email:
        params += f'&email={email}'
    
    response = await call_boomerang_api('GET', f'/customers?{params}', {})
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
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get customer details."""
    response = await call_boomerang_api('GET', f'/customers/{customer_id}', {})
    return {"success": True, "customer": mask_pii(response.get('data', {}))}

@router.get("/{customer_id}/cards")
async def get_customer_cards(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get all cards for a customer."""
    response = await call_boomerang_api('GET', f'/customers/{customer_id}/cards', {})
    cards = response.get('data', [])
    
    masked_cards = [mask_pii(card) for card in cards]
    
    return {
        "success": True,
        "cards": masked_cards
    }
