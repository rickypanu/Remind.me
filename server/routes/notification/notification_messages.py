"""
Notification wording for Telegram / Web Push.

PRIVACY: reminder titles and notes are NEVER sent to Gemini. The AI is only asked for a short, generic
motivational line (it sees at most a whitelisted category name and a count). The user's own reminder text
is added locally, after the AI call, and only inside the notification that is delivered to that user.
"""
import logging
import random
from html import escape

from pydantic import BaseModel

from utils.gemini_pool import GeminiUnavailable, get_pool

log = logging.getLogger("notification_messages")

CATEGORY_EMOJIS = {
    "Assignment": "📝", "Project": "💻", "Exam / Quiz": "🎓",
    "Placement / Internship": "💼", "Extracurricular": "🏆",
    "Personal": "🌱", "Other": "📌",
}
KNOWN_CATEGORIES = tuple(CATEGORY_EMOJIS)

SYSTEM_PROMPT = "You are a concise productivity assistant. Write short, punchy, friendly push notifications. Plain text only, no markdown or HTML."


class NotificationCopy(BaseModel):
    title: str
    body: str


def _get_emoji(category: str) -> str:
    return CATEGORY_EMOJIS.get(category, "⏰")


def _safe_category(category: str) -> str:
    """Only fixed category names may reach the AI; custom user text is reduced to 'Other'."""
    return category if category in KNOWN_CATEGORIES else "Other"


async def _ai_copy(prompt: str) -> NotificationCopy:
    text = await get_pool().generate(
        prompt, schema=NotificationCopy, system_instruction=SYSTEM_PROMPT, temperature=0.7, max_output_tokens=150
    )
    return NotificationCopy.model_validate_json(text)


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
    safe_title = escape(task_title)
    prompt = (
        f"Category: {_safe_category(category)}. A task in this category is due in 60 minutes. "
        "Rules: title 3-5 words. Body: ONE short sentence with an actionable nudge. Do not mention any specific task name."
    )
    try:
        data = await _ai_copy(prompt)
        return f"{emoji} {_clean(escape(data.title), 60)}", f"{_clean(escape(data.body), 160)}\n<b>{safe_title}</b> is due in 1 hour."
    except (GeminiUnavailable, Exception) as e:  # noqa: BLE001 - never block a reminder on the AI
        log.warning("Due-soon copy fell back to template: %s", e)
        return f"{emoji} 1 Hour Left!", f"Time to lock in! <b>{safe_title}</b> is due in 60 minutes."


def get_short_reminder_copy(task_title: str, category: str, minutes: int, html: bool = False) -> tuple[str, str]:
    """Instant, fixed-text copy for the 10-min / 1-min reminders (no AI call = no delay, no quota).
    html=True escapes the title for Telegram's HTML parse mode."""
    emoji = _get_emoji(category)
    safe_title = escape(task_title) if html else task_title
    unit = "minute" if minutes == 1 else "minutes"
    if minutes <= 1:
        return f"{emoji} Due in 1 minute!", f"'{safe_title}' is due right now. Finish up!"
    return f"{emoji} Due in {minutes} {unit}", f"'{safe_title}' is due in {minutes} {unit}. Time to wrap it up."


async def get_today_digest_copy(tasks: list[dict], hour: int) -> tuple[str, str]:
    count = len(tasks)
    if count == 0:
        return "🎉 All Clear!", "You have no pending tasks for today. Great job!"

    phase = "morning kickoff" if hour < 12 else "midday check" if hour < 17 else "evening wrap-up"
    cats = sorted({_safe_category(t.get("category", "Other")) for t in tasks})
    prompt = (
        f"Phase: {phase}. The user has {count} pending task(s) today in these categories: {', '.join(cats)}. "
        "Rules: title with one emoji, max 5 words. Body: ONE short encouraging sentence (max 20 words). Do not name specific tasks."
    )
    try:
        data = await _ai_copy(prompt)
        title, intro = _clean(escape(data.title), 60), _clean(escape(data.body), 160)
    except Exception as e:  # noqa: BLE001
        log.warning("Today digest fell back to template: %s", e)
        title, intro = "📋 Today's Check-in", f"You have <b>{count} task{'s' if count != 1 else ''}</b> today. Let's keep the momentum going!"
    return title, f"{intro}\n{_titles_block(tasks)}"


async def get_tomorrow_digest_copy(tasks: list[dict]) -> tuple[str, str]:
    count = len(tasks)
    if count == 0:
        return "🌙 Clear Skies", "Nothing on the radar for tomorrow. Rest easy!"

    cats = sorted({_safe_category(t.get("category", "Other")) for t in tasks})
    prompt = (
        f"The user has {count} task(s) tomorrow in these categories: {', '.join(cats)}. "
        "Rules: calming title with a night emoji, max 5 words. Body: ONE short reassuring sentence (max 20 words). Do not name specific tasks."
    )
    try:
        data = await _ai_copy(prompt)
        title, intro = _clean(escape(data.title), 60), _clean(escape(data.body), 160)
    except Exception as e:  # noqa: BLE001
        log.warning("Tomorrow digest fell back to template: %s", e)
        title, intro = "🌙 Tomorrow's Gameplan", random.choice([
            f"You have {count} task{'s' if count != 1 else ''} lined up for tomorrow. Rest up, you're prepared!",
            f"{count} thing{'s' if count != 1 else ''} planned for tomorrow. Sleep well, you've got this!",
        ])
    return title, f"{intro}\n{_titles_block(tasks)}"
