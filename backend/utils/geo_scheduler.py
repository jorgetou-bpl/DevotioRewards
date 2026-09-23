# GeoPush business-hours scheduler — Boomerangme has no schedule concept on
# a location, so this runs on a timer and flips `display` on their side to
# approximate one, using data from db.geo_location_schedules (see
# routes/geo_push.py). No overnight wraparound (e.g. 22:00-02:00) — same-day
# open_time < close_time only, matching the only case asked for so far.
#
# Precision is bounded by how often this runs, not by-the-minute — a 5-minute
# interval (see server.py) means a location can stay "open" up to ~5 minutes
# past its configured close_time, and vice versa on open.

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from .config import db
from .boomerang import call_boomerang_api, get_api_key_for_workspace

logger = logging.getLogger(__name__)

# Devotio's whole current book of business is Costa Rica (CRC currency,
# es-CR date formatting elsewhere in the app) — hardcoded rather than a
# per-workspace field until there's an actual non-CR workspace using this.
SCHEDULE_TIMEZONE = ZoneInfo("America/Costa_Rica")


async def sync_geo_schedules():
    """Evaluate every enabled schedule against the current time and push
    the resulting `display` value to Boomerangme. One location's failure
    (bad api key, Boomerangme error, etc.) is logged and skipped — it must
    never take down the rest of the run."""
    now = datetime.now(SCHEDULE_TIMEZONE).strftime("%H:%M")

    synced = 0
    async for schedule in db.geo_location_schedules.find({"enabled": True}):
        workspace_id = schedule.get("workspace_id")
        location_id = schedule.get("location_id")
        open_time = schedule.get("open_time")
        close_time = schedule.get("close_time")
        if not (workspace_id and location_id and open_time and close_time):
            continue

        should_be_open = open_time <= now < close_time

        try:
            api_key = await get_api_key_for_workspace(workspace_id)
            await call_boomerang_api(
                'PATCH', f'/locations/{location_id}', {"display": should_be_open},
                raise_on_error=False, api_key=api_key
            )
            synced += 1
        except Exception as e:
            logger.error(f"geo_scheduler: failed to sync location {location_id} (workspace {workspace_id}): {e}")

    if synced:
        logger.info(f"geo_scheduler: synced {synced} location(s) at {now} America/Costa_Rica")
