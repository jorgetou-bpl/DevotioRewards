# Contífico integration utilities — invoice polling, Boomerangme customer
# matching, and cashback crediting for pending/processed transactions.

import httpx
import logging
import uuid
from datetime import datetime, timezone
from .config import db
from .boomerang import call_boomerang_api, log_operation

logger = logging.getLogger(__name__)

CONTIFICO_API_BASE = "https://api.contifico.com/sistema/api/v1"

# Synthetic acting-user used when the automatic sync (not a logged-in
# operator) credits cashback, so log_operation/gerente attribution has
# something sensible to show in the existing Historial view.
CONTIFICO_SYSTEM_USER = {
    "name": "Contífico (auto)",
    "email": "contifico-sync@devotio.internal",
    "id": "contifico-connector",
}


async def call_contifico_api(endpoint: str, api_key: str, params: dict = None) -> dict:
    """GET against the Contífico API. Auth is the raw API key in the
    Authorization header (not "Bearer <key>") — confirmed live against the
    demo account during the initial API investigation."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{CONTIFICO_API_BASE}{endpoint}",
            headers={"Authorization": api_key},
            params=params or {},
        )
        response.raise_for_status()
        return response.json()


async def _search_card_by_field(field: str, value: str, api_key: str):
    """Search Boomerangme's own /customers by phone or email and return
    (card_id, customer_id) for their first card, or None."""
    customers_response = await call_boomerang_api('GET', '/customers', {field: value}, api_key=api_key)
    if customers_response.get('code') != 200:
        return None
    customers = customers_response.get('data', [])
    if not customers:
        return None
    customer_id = customers[0].get('id')
    if not customer_id:
        return None
    cards_response = await call_boomerang_api('GET', f'/customers/{customer_id}/cards', api_key=api_key)
    if cards_response.get('code') != 200:
        return None
    cards = cards_response.get('data', [])
    if not cards:
        return None
    return cards[0].get('id'), customer_id


async def find_boomerang_match(persona: dict, boomerang_api_key: str, workspace_id: str):
    """Resolve a Contífico invoice's persona to a Boomerangme card. Tries
    phone, then email (both natively searchable in Boomerangme), then a
    cédula mapping learned from past manual resolutions — Boomerangme's own
    /customers search has no cédula field, so that lookup lives in our own
    `customer_identifiers` collection, populated by resolve_pending_transaction
    below. Returns (card_id, customer_id) or None."""
    phone = (persona.get("telefonos") or "").strip()
    email = (persona.get("email") or "").strip()
    cedula = (persona.get("cedula") or persona.get("ruc") or "").strip()

    for field, value in (("phone", phone), ("email", email)):
        if not value:
            continue
        match = await _search_card_by_field(field, value, boomerang_api_key)
        if match:
            return match

    if cedula:
        mapping = await db.customer_identifiers.find_one({"workspace_id": workspace_id, "cedula": cedula})
        if mapping and mapping.get("card_id"):
            return mapping["card_id"], mapping.get("customer_id", "")

    return None


async def credit_cashback(card_id: str, amount: float, comment: str, workspace_id: str,
                           boomerang_api_key: str, acting_user: dict) -> dict:
    """Credit cashback for a purchase amount via the same endpoint the rest
    of the app already uses (add-transaction-amount) — Boomerangme applies
    the card's own configured cashback percentage itself; we never compute
    it locally, unlike the Interfuerza project's approach."""
    response = await call_boomerang_api(
        'POST', f'/cards/{card_id}/add-transaction-amount',
        {"amount": amount, "comment": comment}, api_key=boomerang_api_key
    )
    card_data = response.get('data', {})
    await log_operation(
        card_id=card_id,
        operation_type="add-transaction-amount",
        current_user={
            "workspace_id": workspace_id,
            "name": acting_user.get("name"),
            "email": acting_user.get("email", ""),
            "id": acting_user.get("id", ""),
        },
        card_data=card_data,
        amount=amount,
        balance=card_data.get('balance', {}).get('balance'),
        purchase_sum=amount,
        note=comment,
        gerente_override=acting_user.get("name"),
    )
    return card_data


async def process_documento(documento: dict, workspace_id: str, boomerang_api_key: str) -> str:
    """Insert one Contífico invoice into contifico_transactions, auto-crediting
    cashback if a Boomerangme match is found. Returns 'processed', 'pending',
    'duplicate', or 'skipped'."""
    documento_id = documento.get("id")
    if not documento_id:
        return "skipped"

    existing = await db.contifico_transactions.find_one(
        {"workspace_id": workspace_id, "documento_id": documento_id}
    )
    if existing:
        return "duplicate"

    persona = documento.get("persona") or {}
    amount = float(documento.get("total") or 0)
    now_iso = datetime.now(timezone.utc).isoformat()

    record = {
        "id": str(uuid.uuid4()),
        "workspace_id": workspace_id,
        "documento_id": documento_id,
        "documento_numero": documento.get("documento"),
        "customer_name": persona.get("razon_social"),
        "customer_phone": persona.get("telefonos"),
        "customer_email": persona.get("email"),
        "customer_cedula": persona.get("cedula") or persona.get("ruc"),
        "amount": amount,
        "transaction_date": documento.get("fecha_emision"),
        "created_at": now_iso,
        "status": "pending",
        "card_id": None,
        "boomerang_customer_id": None,
        "resolved_by": None,
        "resolved_at": None,
    }

    match = await find_boomerang_match(persona, boomerang_api_key, workspace_id)
    if match:
        card_id, customer_id = match
        try:
            await credit_cashback(
                card_id, amount, f"Contífico factura #{documento.get('documento')}",
                workspace_id, boomerang_api_key, CONTIFICO_SYSTEM_USER
            )
            record.update({
                "status": "processed",
                "card_id": card_id,
                "boomerang_customer_id": customer_id,
                "resolved_by": "auto",
                "resolved_at": now_iso,
            })
        except Exception as e:
            # Leave as pending rather than silently losing the transaction —
            # an operator can resolve it manually from the dashboard.
            logger.error(f"Contífico auto-credit failed for documento {documento_id}: {e}")

    await db.contifico_transactions.insert_one(record)
    return record["status"]


async def sync_workspace_contifico(workspace: dict) -> dict:
    """Poll Contífico for new invoices since the last sync and process each
    one. NOTE: the exact `fecha_creacion` filter format hasn't been verified
    against a live production Contífico account yet (only the demo account
    during initial investigation) — validate before relying on this for a
    real client, per docs/plan-ejecucion-contifico.md."""
    ws_id = workspace["id"]
    contifico_cfg = workspace.get("contifico") or {}
    contifico_api_key = contifico_cfg.get("api_key")
    boomerang_api_key = workspace.get("boomerangme_api_key")

    if not contifico_cfg.get("enabled") or not contifico_api_key:
        return {"synced": False, "reason": "Contífico no configurado para este workspace"}

    last_synced_at = contifico_cfg.get("last_synced_at")
    params = {"tipo": "FAC", "result_size": 100}
    if last_synced_at:
        params["fecha_creacion"] = last_synced_at[:10]

    response = await call_contifico_api("/documento/", contifico_api_key, params)
    documentos = response if isinstance(response, list) else response.get("data", [])

    counts = {"processed": 0, "pending": 0, "duplicate": 0, "skipped": 0}
    for documento in documentos:
        result = await process_documento(documento, ws_id, boomerang_api_key)
        counts[result] = counts.get(result, 0) + 1

    await db.workspaces.update_one(
        {"id": ws_id},
        {"$set": {"contifico.last_synced_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"synced": True, "total_fetched": len(documentos), **counts}


async def resolve_pending_transaction(transaction_id: str, card_id: str, customer_id: str,
                                       workspace_id: str, boomerang_api_key: str, acting_user: dict) -> dict:
    """Manually resolve a pending Contífico transaction: credit cashback,
    mark it processed, and — if it had a cédula — remember that mapping so
    future invoices for the same cédula auto-match next time."""
    transaction = await db.contifico_transactions.find_one({"id": transaction_id, "workspace_id": workspace_id})
    if not transaction:
        raise ValueError("Transacción no encontrada")
    if transaction.get("status") == "processed":
        raise ValueError("Esta transacción ya fue procesada")

    card_data = await credit_cashback(
        card_id, transaction["amount"], f"Contífico factura #{transaction.get('documento_numero')}",
        workspace_id, boomerang_api_key, acting_user
    )

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.contifico_transactions.update_one(
        {"id": transaction_id},
        {"$set": {
            "status": "processed",
            "card_id": card_id,
            "boomerang_customer_id": customer_id,
            "resolved_by": acting_user.get("name") or acting_user.get("email"),
            "resolved_at": now_iso,
        }}
    )

    cedula = transaction.get("customer_cedula")
    if cedula:
        await db.customer_identifiers.update_one(
            {"workspace_id": workspace_id, "cedula": cedula},
            {"$set": {"card_id": card_id, "customer_id": customer_id, "learned_at": now_iso}},
            upsert=True,
        )

    return card_data
