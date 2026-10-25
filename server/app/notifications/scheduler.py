"""ONE scheduler for every delivery job (finding A4). Replaces three schedulers in three files.

Schedules (IST), unchanged from before:
    every minute        due-soon reminders for every configured channel
    Telegram            today 08 / 17 / 21 / 23, tomorrow 21
    Web Push            today 08 / 13 / 17 / 21, tomorrow 21 / 23
    every 5 minutes     roll missed recurring reminders forward

Several processes may run this at once (``uvicorn --workers N``, or two instances during a deploy): due-soon
reminders are protected by per-task atomic claims, digests by a one-winner slot lock in MongoDB. To run the API
without any scheduler in a process set ``SCHEDULER_ENABLED=false`` there.
"""

import logging
from collections.abc import Awaitable, Callable

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from app.notifications import jobs
from app.notifications.dispatch import Notifier
from utils.timezone import IST

log = logging.getLogger("scheduler")

DIGEST_HOURS = {
    "tele": {"today": "8,17,21,23", "tomorrow": "21"},
    "web": {"today": "8,13,17,21", "tomorrow": "21,23"},
}


def _safe(name: str, job: Callable[..., Awaitable], *args) -> Callable[[], Awaitable[None]]:
    """A job that raises must never stop the schedule or disappear without a trace."""

    async def run() -> None:
        try:
            await job(*args)
        except Exception:  # noqa: BLE001
            log.exception("Scheduled job %s failed", name)

    run.__name__ = name
    return run


def start_scheduler(notifier: Notifier) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone=IST)
    common = {"coalesce": True, "max_instances": 1, "misfire_grace_time": 120}

    scheduler.add_job(
        _safe("due_soon", jobs.remind_upcoming_tasks, notifier),
        CronTrigger(minute="*", timezone=IST),
        id="due_soon",
        **common,
    )
    for channel in notifier.channels:
        hours = DIGEST_HOURS[channel]
        scheduler.add_job(
            _safe(f"today_{channel}", jobs.digest_today, notifier, channel),
            CronTrigger(hour=hours["today"], minute="0", timezone=IST),
            id=f"today_{channel}",
            **common,
        )
        scheduler.add_job(
            _safe(f"tomorrow_{channel}", jobs.digest_tomorrow, notifier, channel),
            CronTrigger(hour=hours["tomorrow"], minute="0", timezone=IST),
            id=f"tomorrow_{channel}",
            **common,
        )
    scheduler.add_job(
        _safe("roll_missed", jobs.roll_missed_recurring_tasks, notifier),
        IntervalTrigger(minutes=5, timezone=IST),
        id="roll_missed",
        **common,
    )

    scheduler.start()
    log.info("Reminder scheduler started (IST), channels: %s", ", ".join(notifier.channels) or "none")
    return scheduler
