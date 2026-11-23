"""The words of every notification, by tone (friendly / funny / strict / calm) and language (English / Hinglish).

The lines live in ``voice_lines.json``, which is a copy of the phone app's ``src/notifications/voiceLines.js``
(regenerate it with ``node scripts/export-voice-json.mjs`` in the app folder), so a phone alarm, a Telegram message
and a browser push all sound the same. A line is picked with a fixed hash of a seed (never at random): the same
reminder always gets the same line. ``hash32`` is the same FNV-1a as the app's ``hash()``.
"""

import json
import re
from pathlib import Path
from typing import Any

_LINES: dict[str, dict[str, dict[str, list]]] = json.loads((Path(__file__).parent / "voice_lines.json").read_text(encoding="utf8"))

DEFAULT_TONE = "friendly"
DEFAULT_LANG = "en"
Voice = tuple[str, str]  # (tone, lang)


def voice_of(user: dict[str, Any] | None) -> Voice:
    """The tone and language this user chose (friendly + English until they pick)."""
    tone = (user or {}).get("notify_tone")
    lang = (user or {}).get("notify_lang")
    return (tone if tone in _LINES else DEFAULT_TONE, lang if lang in ("en", "hinglish") else DEFAULT_LANG)


def hash32(text: str) -> int:
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def _bank(voice: Voice | None) -> dict[str, list]:
    tone, lang = voice or (DEFAULT_TONE, DEFAULT_LANG)
    by_lang = _LINES.get(tone) or _LINES[DEFAULT_TONE]
    return by_lang.get(lang) or by_lang[DEFAULT_LANG]


def _choose(items: list, seed: str):
    return items[hash32(seed) % len(items)]


def _fill(text: str, values: dict[str, Any]) -> str:
    return re.sub(r"\{(\w+)\}", lambda m: str(values[m.group(1)]) if m.group(1) in values else m.group(0), text)


def _tasks_text(n: int) -> str:
    return f"{n} task{'' if n == 1 else 's'}"


def _span_text(minutes: int, lang: str) -> str:
    if minutes >= 60 and minutes % 60 == 0:
        h = minutes // 60
        return f"{h} ghante mein" if lang == "hinglish" else f"in {h} {'hour' if h == 1 else 'hours'}"
    return f"{minutes} min mein" if lang == "hinglish" else f"in {minutes} min"


def _when_text(minutes: int, lang: str) -> str:
    if minutes >= 1440:
        return "kal" if lang == "hinglish" else "tomorrow"
    h = round(minutes / 60)
    return f"{h} ghante baad" if lang == "hinglish" else f"in {h} hours"


def reminder_copy(title: str, minutes: int, voice: Voice | None, seed: str) -> tuple[str, str]:
    """(headline, line) for one reminder ``minutes`` before it is due (0 or less = due now). The headline says WHAT
    (and "in 10 min" for a heads-up); the line is in the person's tone. ``title`` is returned as given: the caller
    escapes it where the channel needs that (Telegram HTML)."""
    bank = _bank(voice)
    lang = (voice or (DEFAULT_TONE, DEFAULT_LANG))[1]
    key = "due" if minutes <= 0 else "far" if minutes >= 120 else "lead1" if minutes <= 1 else "lead10" if minutes <= 10 else "lead60"
    line = _fill(_choose(bank[key], f"{seed}|{key}"), {"t": title, "when": _when_text(minutes, lang)})
    if key == "due":
        return title, line
    return f"{title} · {_when_text(minutes, lang) if key == 'far' else _span_text(minutes, lang)}", line


def digest_copy(titles: list[str], when: str, voice: Voice | None, seed: str) -> tuple[str, str]:
    """(headline, line) for the "today" / "tomorrow" digest. The caller adds the bullet list of titles if it wants one."""
    bank = _bank(voice)
    n = len(titles)
    key = ("digest" if n else "clear") if when == "today" else ("tomorrow" if n else "tomorrowClear")
    head, body = _choose(bank[key], f"{seed}|{key}")
    values = {"tasks": _tasks_text(n), "first": titles[0] if titles else "", "n": n}
    return _fill(head, values), _fill(body, values)
