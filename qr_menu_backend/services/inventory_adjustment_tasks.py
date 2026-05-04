"""Background tasks for inventory adjustment workflows."""

import asyncio
import logging

from db.database import get_connection
from db import repositories

logger = logging.getLogger(__name__)

AUTO_APPROVE_AFTER_MINUTES = 10
AUTO_APPROVE_CHECK_INTERVAL_SECONDS = 30


async def run_inventory_adjustment_auto_approval(
    stop_event: asyncio.Event,
    check_interval_seconds: int = AUTO_APPROVE_CHECK_INTERVAL_SECONDS,
    older_than_minutes: int = AUTO_APPROVE_AFTER_MINUTES,
) -> None:
    """Periodically auto-approve old pending inventory adjustment requests."""
    while not stop_event.is_set():
        try:
            conn = get_connection()
            try:
                count = repositories.inventory_adjustment_auto_approve_expired(
                    conn,
                    older_than_minutes=older_than_minutes,
                )
                if count:
                    logger.info(
                        "Auto-approved %s inventory adjustment requests older than %s minutes",
                        count,
                        older_than_minutes,
                    )
            finally:
                conn.close()
        except Exception:
            logger.exception("Inventory adjustment auto-approve task iteration failed")

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=max(1, int(check_interval_seconds)))
        except asyncio.TimeoutError:
            continue