"""
Notification wording for Telegram (HTML) and Web Push (plain text).

All wording is fixed text built on the server. Reminder titles and notes are only added inside the notification
that is delivered to that user; they are never sent anywhere else.
"""
import random
from html import escape

CATEGORY_EMOJIS = {
    "Assignment": "📝", "Project": "💻", "Exam / Quiz": "🎓",
    "Placement / Internship": "💼", "Extracurricular": "🏆",
    "Personal": "🌱", "Other": "📌",
}

def _get_emoji(category: str) -> str:
    return CATEGORY_EMOJIS.get(category, "⏰")


def _clean(text: str, limit: int) -> str:
    return " ".join((text or "").split())[:limit]


def _titles_block(tasks: list[dict], limit: int = 8) -> str:
    """Bullet list of the user's own reminder titles, escaped for Telegram HTML."""
    lines = [f"• {escape(t.get('title', 'Task'))}" for t in tasks[:limit]]
    if len(tasks) > limit:
        lines.append(f"…and {len(tasks) - limit} more")
    return "\n".join(lines)


async def get_due_soon_copy(task_title: str, category: str = "Other") -> tuple[str, str]:
    emoji = _get_emoji(category)
    return f"{emoji} 1 Hour Left!", f"Time to lock in! <b>{escape(task_title)}</b> is due in 60 minutes."


def get_short_reminder_copy(task_title: str, category: str, minutes: int, html: bool = False) -> tuple[str, str]:
    """Instant, fixed-text copy for the 10-min / 1-min reminders (no AI call = no delay, no quota).
    html=True escapes the title for Telegram's HTML parse mode."""
    emoji = _get_emoji(category)
    safe_title = escape(task_title) if html else task_title
    if minutes >= 120:
        span = "tomorrow" if minutes >= 1440 else f"in {minutes // 60} hours"
        return f"{emoji} Due {span}", f"'{safe_title}' is due {span}. Plan ahead."
    unit = "minute" if minutes == 1 else "minutes"
    if minutes <= 1:
        return f"{emoji} Due in 1 minute!", f"'{safe_title}' is due right now. Finish up!"
    return f"{emoji} Due in {minutes} {unit}", f"'{safe_title}' is due in {minutes} {unit}. Time to wrap it up."


async def get_today_digest_copy(tasks: list[dict], hour: int) -> tuple[str, str]:
    count = len(tasks)
    if count == 0:
        return "🎉 All Clear!", "You have no pending tasks for today. Great job!"
    intro = f"You have <b>{count} task{'s' if count != 1 else ''}</b> today. Let's keep the momentum going!"
    return "📋 Today's Check-in", f"{intro}\n{_titles_block(tasks)}"


async def get_tomorrow_digest_copy(tasks: list[dict]) -> tuple[str, str]:
    count = len(tasks)
    if count == 0:
        return "🌙 Clear Skies", "Nothing on the radar for tomorrow. Rest easy!"
    intro = random.choice([
        f"You have {count} task{'s' if count != 1 else ''} lined up for tomorrow. Rest up, you're prepared!",
        f"{count} thing{'s' if count != 1 else ''} planned for tomorrow. Sleep well, you've got this!",
    ])
    return "🌙 Tomorrow's Gameplan", f"{intro}\n{_titles_block(tasks)}"


# ---------------------------------------------------------------------------
# Web Push copy (plain text: the browser shows it as-is, so nothing is escaped)
# ---------------------------------------------------------------------------
def get_push_due_soon_copy(task_title: str) -> tuple[str, str]:
    return "Task Due Soon!", f"'{task_title}' is due in 1 hour."


def get_push_today_copy(titles: list[str]) -> tuple[str, str]:
    if len(titles) == 1:
        return "Today's Task", f"Don't forget: {titles[0]}"
    return f"{len(titles)} Tasks Today", f"You have {len(titles)} items scheduled, starting with: {titles[0]}"


def get_push_tomorrow_copy(titles: list[str]) -> tuple[str, str]:
    if len(titles) == 1:
        return "Tomorrow's Agenda", f"Heads up for tomorrow: {titles[0]}"
    return f"{len(titles)} Tasks Tomorrow", f"You have {len(titles)} tasks scheduled for tomorrow."
