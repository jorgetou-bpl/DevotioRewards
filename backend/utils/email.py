# Transactional email via Resend's HTTP API — no SDK needed, httpx already
# covers it (same pattern as call_boomerang_api). RESEND_API_KEY isn't
# provisioned yet (see utils/config.py); this raises a clear, actionable
# error on send rather than silently swallowing it, so a missing key shows
# up immediately in logs instead of as a mysteriously-never-arriving email.

import logging
import httpx
from .config import RESEND_API_KEY, RESEND_FROM_EMAIL

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> bool:
    """Returns True on success. Never raises for a downstream Resend error
    (logs it and returns False) — callers that email as a side effect of
    something else (e.g. forgot-password) must not fail the whole request
    just because the email provider hiccuped."""
    if not RESEND_API_KEY:
        logger.error("RESEND_API_KEY not configured — cannot send email to %s", to)
        return False

    headers = {"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"}
    payload = {"from": RESEND_FROM_EMAIL, "to": [to], "subject": subject, "html": html}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(RESEND_API_URL, headers=headers, json=payload)
        if response.status_code >= 400:
            logger.error("Resend send failed (%s): %s", response.status_code, response.text)
            return False
        return True
    except httpx.HTTPError as e:
        logger.error("Resend request error: %s", e)
        return False
