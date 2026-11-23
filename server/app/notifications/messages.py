"""
Notification wording for Telegram (HTML) and Web Push (plain text).

All wording is fixed text built on the server (see voice.py: the user picks a tone, Friendly / Funny / Strict /
Calm, in English or Hinglish). Reminder titles and notes are only added inside the notification that is delivered to
that user; they are never sent anywhere else.
"""
from html import escape

from app.notifications.voice import Voice, digest_copy, reminder_copy

CATEGORY_EMOJIS = {
    "Assignment": "📝", "Project": "💻", "Exam / Quiz": "🎓",
    "Placement / Internship": "💼", "Extracurricular": "🏆",
    "Personal": "🌱", "Other": "📌",
}

def _get_emoji(category: str) -> str:
    return CATEGORY_EMOJIS.get(category, "⏰")


def _clean(text: str, limit: int) -> str:
    return " ".join((text or "").split())[:limit]


def _h(text: str) -> str:
    """Telegram HTML: only < > & need escaping."""
    return escape(text, quote=False)


def _titles_block(tasks: list[dict], limit: int = 8) -> str:
    """Bullet list of the user's own reminder titles, escaped for Telegram HTML."""
    lines = [f"• {escape(t.get('title', 'Task'))}" for t in tasks[:limit]]
    if len(tasks) > limit:
        lines.append(f"…and {len(tasks) - limit} more")
    return "\n".join(lines)


async def get_due_soon_copy(task_title: str, category: str = "Other", voice: Voice | None = None, seed: str = "") -> tuple[str, str]:
    """Telegram, the 1-hour reminder."""
    return get_short_reminder_copy(task_title, category, 60, html=True, voice=voice, seed=seed)


def get_short_reminder_copy(task_title: str, category: str, minutes: int, html: bool = False, voice: Voice | None = None, seed: str = "") -> tuple[str, str]:
    """Instant, fixed-text copy for every "due in N minutes / hours" reminder (no AI call = no delay, no quota).
    html=True escapes the text for Telegram's HTML parse mode."""
    emoji = _get_emoji(category)
    head, line = reminder_copy(task_title, minutes, voice, f"{seed or task_title}|{minutes}")
    if html:
        head, line = _h(head), _h(line)
    return f"{emoji} {head}", line


async def get_today_digest_copy(tasks: list[dict], hour: int, voice: Voice | None = None, seed: str = "") -> tuple[str, str]:
    head, line = digest_copy([t.get("title", "Task") for t in tasks], "today", voice, seed or f"today{hour}")
    body = f"{_h(line)}\n{_titles_block(tasks)}" if tasks else _h(line)
    return f"📋 {_h(head)}" if tasks else f"🎉 {_h(head)}", body


async def get_tomorrow_digest_copy(tasks: list[dict], voice: Voice | None = None, seed: str = "") -> tuple[str, str]:
    head, line = digest_copy([t.get("title", "Task") for t in tasks], "tomorrow", voice, seed or "tomorrow")
    body = f"{_h(line)}\n{_titles_block(tasks)}" if tasks else _h(line)
    return f"🌙 {_h(head)}", body


# ---------------------------------------------------------------------------
# Web Push copy (plain text: the browser shows it as-is, so nothing is escaped)
# ---------------------------------------------------------------------------
def get_push_due_soon_copy(task_title: str, voice: Voice | None = None, seed: str = "") -> tuple[str, str]:
    return reminder_copy(task_title, 60, voice, f"{seed or task_title}|60")


def get_push_today_copy(titles: list[str], voice: Voice | None = None, seed: str = "") -> tuple[str, str]:
    return digest_copy(titles, "today", voice, seed or "today")


def get_push_tomorrow_copy(titles: list[str], voice: Voice | None = None, seed: str = "") -> tuple[str, str]:
    return digest_copy(titles, "tomorrow", voice, seed or "tomorrow")
