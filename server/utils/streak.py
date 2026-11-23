"""Completion streaks. Pure functions over a set of IST calendar days (``datetime.date``)."""

from datetime import date, timedelta


def current_streak(days: set[date], today: date) -> int:
    """Consecutive days with at least one completion, ending today.

    A day that has not produced a completion YET does not break the streak: if the last completion was yesterday
    the streak is still alive (the user has until the end of today to extend it). Two days of silence ends it.
    """
    cursor = today if today in days else today - timedelta(days=1)
    count = 0
    while cursor in days:
        count += 1
        cursor -= timedelta(days=1)
    return count


def best_streak(days: set[date]) -> int:
    """The longest run of consecutive days in ``days``."""
    best = run = 0
    previous: date | None = None
    for day in sorted(days):
        run = run + 1 if previous is not None and day - previous == timedelta(days=1) else 1
        best = max(best, run)
        previous = day
    return best
