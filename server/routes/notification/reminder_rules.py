"""
Per-task "due soon" reminder rules, shared by the Telegram and Web Push schedulers.

A task gets one reminder at each offset below (minutes before the due time).
Each channel tracks its own flag per offset, e.g. notified_tele_10m / notified_web_10m,
so a reminder is never sent twice and one channel can never block the other.
"""
import math
from datetime import datetime, timedelta

from utils.timezone import as_utc

# Minutes before due time. Order matters: earliest reminder first.
REMINDER_OFFSETS = (60, 10, 1)


def grace_minutes(offset: int) -> int:
    """How late (after the exact moment) a reminder may still be sent.
    Covers a slow/restarted server, but never runs past the due time
    (the 1-minute reminder gets at most 1 minute of grace)."""
    return min(5, offset)


def reminder_flag(channel: str, offset: int) -> str:
    """channel is 'tele' or 'web'."""
    return f"notified_{channel}_{offset}m"


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
