"""Per-task "due soon" reminder rules, shared by every delivery channel (finding A2).

A task gets one reminder at each offset below (minutes before the due time). Each channel tracks its own flag per
offset (``notified_tele_10m`` / ``notified_web_10m``), so a reminder is never sent twice and one channel can never
block the other.

``NOTIFICATION_FLAGS`` (the fields cleared when a recurring reminder rolls to its next occurrence) is DERIVED from
the offsets and channels here, so adding an offset or a channel can no longer leave a stale flag behind.
"""

import math
from datetime import datetime, timedelta

from utils.timezone import as_utc

# Minutes before due time. Order matters: earliest reminder first.
REMINDER_OFFSETS = (60, 10, 1)
CHANNELS = ("tele", "web")

# Flags written by earlier versions of the schedulers; still cleared for tasks that carry them.
LEGACY_FLAGS = ("notified_due_soon", "notified_due_soon_web", "notified_tomorrow_digest", "last_notified_at")


def grace_minutes(offset: int) -> int:
    """How late (after the exact moment) a reminder may still be sent.
    Covers a slow/restarted server, but never runs past the due time
    (the 1-minute reminder gets at most 1 minute of grace)."""
    return min(5, offset)


def reminder_flag(channel: str, offset: int) -> str:
    """channel is 'tele' or 'web'."""
    return f"notified_{channel}_{offset}m"


NOTIFICATION_FLAGS = (
    *LEGACY_FLAGS,
    *(reminder_flag(channel, offset) for channel in CHANNELS for offset in REMINDER_OFFSETS),
)


def reminder_window(now: datetime, offset: int):
    """Tasks whose due_date is in (start, end] should get this reminder now.
    i.e. 'now' has reached (due - offset) but not by more than the grace period.
    Tasks created already inside the window are naturally skipped for the
    larger offsets, because their due time is too close."""
    end = now + timedelta(minutes=offset)
    start = end - timedelta(minutes=grace_minutes(offset))
    return start, end


def minutes_left(due: datetime, now: datetime) -> int:
    """Whole minutes remaining, rounded up, never below 1."""
    secs = (as_utc(due) - now).total_seconds()
    return max(1, math.ceil(secs / 60))
