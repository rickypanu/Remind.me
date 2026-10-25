"""The reminder jobs: due-soon reminders, today / tomorrow digests, and the missed-recurrence roll-over.

Before: ``telegram_notification.py`` and ``webpush_notification.py`` each had their own copy of every job
(finding A2). Now each job exists once and loops over the configured channels.

Delivery guarantees
    * Due-soon reminders are CLAIMED in MongoDB before sending (an atomic ``update_one`` guarded by the flag), so a
      reminder is never sent twice even with several workers. If the send fails for a TEMPORARY reason the claim is
      given back, so the next minute tries again while the grace window is still open. A crash between claim and
      send can still lose one reminder (at-most-once); that is the deliberate trade against duplicates.
    * Digests are guarded by a one-winner slot lock per (job, hour) and, for Telegram, by the same per-task flags
      as before.
    * Everything is batched (one user query per job) and bounded (``Notifier.run_bounded``).
"""

import logging
from collections import defaultdict
from datetime import timedelta
from typing import Any

from app.db.ids import to_object_id
from app.notifications.dispatch import Delivery, Notifier
from app.notifications.messages import (
    get_due_soon_copy,
    get_push_due_soon_copy,
    get_push_today_copy,
    get_push_tomorrow_copy,
    get_short_reminder_copy,
    get_today_digest_copy,
    get_tomorrow_digest_copy,
)
from app.notifications.queries import find_recurring_projected_to_day, find_tasks
from app.notifications.rules import REMINDER_OFFSETS, minutes_left, reminder_flag, reminder_window
from app.repositories import TaskRepository
from utils.recurrence import MISSED_GRACE, RECURRING_TYPES, advance_after_miss
from utils.timezone import as_utc, ist_day_bounds_utc, now_ist, now_utc

log = logging.getLogger("notification_jobs")

TELEGRAM_COOLDOWN = timedelta(minutes=45)  # a digest skips tasks that got an urgent 1-hour warning this recently


# =====================================================================================================
# Due-soon reminders (1h / 10m / 1m), every minute
# =====================================================================================================
def _unclaimed(channel: str, minutes: int) -> dict:
    """Mongo condition: this channel has not announced this offset yet (incl. the pre-offset legacy flags)."""
    condition: dict[str, Any] = {reminder_flag(channel, minutes): {"$ne": True}}
    if minutes == 60:
        condition["notified_due_soon" if channel == "tele" else "notified_due_soon_web"] = {"$ne": True}
    return condition


def _claim_fields(channel: str, minutes: int, now) -> dict:
    fields: dict[str, Any] = {reminder_flag(channel, minutes): True}
    if channel == "tele" and minutes == 60:
        # Only the 1-hour reminder feeds the digest cooldown (10m / 1m must not hide tasks from digests)
        fields.update({"notified_due_soon": True, "last_notified_at": now})
    return fields


async def _remind_one(n: Notifier, task: dict, minutes: int, now, users: dict) -> None:
    user = users.get(to_object_id(task.get("user_id")))
    title = task.get("title", "Untitled Task")
    category = task.get("category", "Other")

    for channel in n.channels:
        flag = reminder_flag(channel, minutes)
        fields = _claim_fields(channel, minutes, now)
        # ATOMIC LOCK: claim the reminder in MongoDB FIRST, send only if we won the claim
        if not await TaskRepository(n.db).claim_reminder(task["_id"], flag, fields):
            continue
        if user is None:
            continue

        left = min(minutes, minutes_left(task["due_date"], now))
        if channel == "tele":
            if minutes == 60:
                copy = await get_due_soon_copy(task_title=title, category=category)
            else:
                copy = get_short_reminder_copy(title, category, left, html=True)
            delivery = await n.send_telegram(user, *copy)
        else:
            copy = get_push_due_soon_copy(title) if minutes == 60 else get_short_reminder_copy(title, category, left)
            delivery = await n.send_push(user, *copy)

        if delivery is Delivery.FAILED:
            # try again next minute, if the grace window allows
            await TaskRepository(n.db).release_reminder(task["_id"], fields)


async def remind_upcoming_tasks(n: Notifier) -> None:
    channels = n.channels
    if not channels:
        return
    now = now_utc()
    for minutes in REMINDER_OFFSETS:
        start, end = reminder_window(now, minutes)
        query: dict[str, Any] = {"due_date": {"$gt": start, "$lte": end}, "status": {"$ne": "completed"}}
        conditions = [_unclaimed(channel, minutes) for channel in channels]
        if len(conditions) == 1:
            query.update(conditions[0])
        else:
            query["$or"] = conditions

        tasks = await find_tasks(n.db, query)
        if not tasks:
            continue
        log.info("%d task(s) due in ~%d min", len(tasks), minutes)
        users = await n.load_users(task.get("user_id") for task in tasks)  # ONE query for the whole batch
        await n.run_bounded((_remind_one(n, task, minutes, now, users) for task in tasks), f"due-in-{minutes}m")


# =====================================================================================================
# Digests (today / tomorrow)
# =====================================================================================================
def _group_by_user(tasks: list[dict]) -> dict:
    grouped: dict = defaultdict(list)
    for task in tasks:
        oid = to_object_id(task.get("user_id"))
        if oid is not None:
            item = {"title": task.get("title", "Untitled Task"), "category": task.get("category", "Other")}
            grouped[oid].append(item)
    return grouped


async def _send_digest(n: Notifier, channel: str, user: dict | None, items: list[dict], when: str, hour: int) -> None:
    if user is None:
        return
    if channel == "tele":
        if when == "today":
            copy = await get_today_digest_copy(items, hour)
        else:
            copy = await get_tomorrow_digest_copy(items)
        await n.send_telegram(user, *copy)
    else:
        titles = [item["title"] for item in items]
        copy = get_push_today_copy(titles) if when == "today" else get_push_tomorrow_copy(titles)
        await n.send_push(user, *copy)


async def digest_today(n: Notifier, channel: str) -> None:
    if channel not in n.channels:
        return
    now_local = now_ist()
    if not await n.claim_slot(f"digest-today-{channel}", now_local.strftime("%Y-%m-%d-%H")):
        return  # another worker already owns this hour's digest

    now = now_utc()
    start_utc, end_utc = ist_day_bounds_utc(0)  # today in IST, as UTC
    tasks = await find_tasks(
        n.db, {"due_date": {"$gte": start_utc, "$lt": end_utc}, "status": {"$ne": "completed"}}
    )

    if channel == "tele":
        # Suppress the digest for a task that got an urgent 1-hour warning within the last 45 minutes
        cooldown = now - TELEGRAM_COOLDOWN
        tasks = [t for t in tasks if not (t.get("last_notified_at") and as_utc(t["last_notified_at"]) > cooldown)]
        if tasks:  # update notification state before dispatching messages
            await TaskRepository(n.db).mark_notified([t["_id"] for t in tasks], {"last_notified_at": now})

    grouped = _group_by_user(tasks)
    users = await n.load_users(grouped)
    await n.run_bounded(
        (_send_digest(n, channel, users.get(uid), items, "today", now_local.hour) for uid, items in grouped.items()),
        f"digest-today-{channel}",
    )


async def digest_tomorrow(n: Notifier, channel: str) -> None:
    if channel not in n.channels:
        return
    now_local = now_ist()
    if not await n.claim_slot(f"digest-tomorrow-{channel}", now_local.strftime("%Y-%m-%d-%H")):
        return

    now = now_utc()
    start_utc, end_utc = ist_day_bounds_utc(1)  # tomorrow in IST, as UTC
    extra = {"notified_tomorrow_digest": {"$ne": True}} if channel == "tele" else None
    query: dict[str, Any] = {"due_date": {"$gte": start_utc, "$lt": end_utc}, "status": {"$ne": "completed"}}
    query.update(extra or {})
    tasks = await find_tasks(n.db, query)
    # Daily / weekly reminders whose NEXT occurrence is still today also happen tomorrow
    tasks += await find_recurring_projected_to_day(n.db, start_utc, extra)

    if channel == "tele" and tasks:
        await TaskRepository(n.db).mark_notified(
            [t["_id"] for t in tasks], {"notified_tomorrow_digest": True, "last_notified_at": now}
        )

    grouped = _group_by_user(tasks)
    users = await n.load_users(grouped)
    await n.run_bounded(
        (_send_digest(n, channel, users.get(uid), items, "tomorrow", now_local.hour) for uid, items in grouped.items()),
        f"digest-tomorrow-{channel}",
    )


# =====================================================================================================
# Recurring reminders that nobody completed
# =====================================================================================================
async def roll_missed_recurring_tasks(n: Notifier) -> int:
    """Roll daily / weekly reminders forward once the missed occurrence is MISSED_GRACE (3 h) old, clear their
    notification flags and count them in ``missed_count`` so tomorrow's reminders still fire on time."""
    now = now_utc()
    tasks_repo = TaskRepository(n.db)

    async def roll(task: dict) -> int:
        change = advance_after_miss(task, now)
        # Guard on the old due_date so a concurrent completion is never overwritten
        changed = await tasks_repo.apply_change(
            task["user_id"], task["_id"], change, guard={"due_date": task["due_date"]}
        )
        return 1 if changed else 0

    tasks = await tasks_repo.find_missed_recurring(now - MISSED_GRACE, RECURRING_TYPES)
    results = await n.run_bounded((roll(task) for task in tasks), "roll-missed")
    rolled = sum(r for r in results if isinstance(r, int))
    if rolled:
        log.info("Rolled %d missed recurring reminder(s) to their next occurrence", rolled)
    return rolled
