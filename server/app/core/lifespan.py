"""Application startup / shutdown (findings A5, A7).

Order matters, and every step fails the boot loudly instead of letting the API run half-configured:

  1. Settings are validated (bad or missing secrets stop the server here).
  2. Logging is configured.
  3. The reminder-encryption key is checked by the crypto module itself.
  4. MongoDB must answer a ping.
  5. All indexes are created / verified.
  6. The shared HTTP client and the Notifier are created; only then does the reminder scheduler start
     (unless SCHEDULER_ENABLED=false for this process).
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.logging_config import configure_logging
from app.db.client import create_mongo_client
from app.db.indexes import ensure_indexes
from app.repositories import TaskRepository, UserRepository

log = logging.getLogger("lifespan")


async def _ping(db: Any, timeout_seconds: float) -> None:
    try:
        await asyncio.wait_for(db.command("ping"), timeout=timeout_seconds)
    except Exception as exc:
        raise RuntimeError(
            "Cannot reach MongoDB. Check MONGODB_URL, network access / IP allow-list and credentials."
        ) from exc


async def _warn_about_unmigrated_data(db: Any) -> None:
    """Rows the new code cannot see are reported loudly at boot instead of letting reminders silently go missing.

    * tasks.user_id must be an ObjectId (A3): a string-owned row is invisible to the API and the scheduler.
    * tasks.updated_at must exist (P2): a row without it never appears in a delta-sync feed.
    """
    try:
        tasks = TaskRepository(db)
        stale_tasks = await tasks.count_string_owners()
        shadow_users = await UserRepository(db).count_string_ids()
        unstamped = await tasks.count_missing_updated_at()
    except Exception:  # noqa: BLE001 - a diagnostic must never stop the boot
        log.warning("Could not check for un-migrated data", exc_info=True)
        return
    if stale_tasks or shadow_users or unstamped:
        log.error(
            "%d task(s) have a string user_id, %d user document(s) have a string _id and %d task(s) have no "
            "updated_at. Run `python -m scripts.migrate_identity --apply` (see docs/API_AND_ARCHITECTURE.md).",
            stale_tasks,
            shadow_users,
            unstamped,
        )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()  # 1. raises ValidationError listing every configuration problem
    configure_logging(settings.log_level)  # 2.
    log.info("Starting RemindMe API: %s", settings.safe_summary())

    from utils.crypto import assert_encryption_configured  # legacy module, still reads os.environ

    assert_encryption_configured()  # 3.

    # The client is created here (not at import time) and handed to the app through ``app.state``.
    client = create_mongo_client(settings)
    db = client[settings.database_name]

    await _ping(db, settings.mongodb_server_selection_timeout_ms / 1000 + 2)  # 4.
    await ensure_indexes(db)  # 5.

    from utils.security import warm_up_password_hasher

    warm_up_password_hasher()  # build the dummy hash used for constant-time login checks (S7)

    await _warn_about_unmigrated_data(db)

    app.state.settings = settings
    app.state.db = db

    # 6. One httpx client for Telegram and e-mail (connection reuse, bounded pool), one Notifier for all delivery.
    from app.core.http import build_http_client, close_http_client, set_http_client
    from app.integrations.telegram import get_telegram
    from app.integrations.webpush import WebPushSender
    from app.notifications.dispatch import Notifier

    set_http_client(build_http_client(settings))
    notifier = Notifier(db, get_telegram(), WebPushSender(), concurrency=settings.scheduler_concurrency)
    app.state.notifier = notifier

    scheduler = None
    if settings.scheduler_enabled:
        from app.notifications.scheduler import start_scheduler

        scheduler = start_scheduler(notifier)
    else:
        log.info("Reminder scheduler is disabled in this process (SCHEDULER_ENABLED=false)")

    log.info("Startup complete")
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)
        await close_http_client()
        await client.close()
        log.info("Shutdown complete")
