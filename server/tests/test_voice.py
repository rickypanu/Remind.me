"""Notification wording: the server must pick exactly the lines the phone app picks (fixture made by the app's JS)."""

import json
from pathlib import Path

from app.notifications.messages import (
    get_push_due_soon_copy,
    get_push_today_copy,
    get_short_reminder_copy,
    get_today_digest_copy,
)
from app.notifications.voice import digest_copy, hash32, reminder_copy, voice_of

FIXTURE = Path(__file__).parent / "fixtures" / "voice_js_parity.json"


def test_picks_the_same_lines_as_the_app():
    rows = json.loads(FIXTURE.read_text(encoding="utf8"))
    assert len(rows) > 200
    for row in rows:
        voice = (row["tone"], row["lang"])
        if row["kind"] == "reminder":
            got = reminder_copy(row["title"], row["minutes"], voice, row["seed"])
        else:
            got = digest_copy(row["titles"], row["when"], voice, row["seed"])
        assert list(got) == [row["out"]["title"], row["out"]["body"]], row


def test_hash_is_fnv1a():
    assert hash32("abc") == 440920331


def test_voice_defaults_and_validation():
    assert voice_of(None) == ("friendly", "en")
    assert voice_of({"notify_tone": "calm", "notify_lang": "hinglish"}) == ("calm", "hinglish")
    assert voice_of({"notify_tone": "rude", "notify_lang": "fr"}) == ("friendly", "en")


def test_telegram_text_is_html_escaped_and_push_is_plain():
    head, body = get_short_reminder_copy("Fix <b>bug</b> & ship", "Project", 10, html=True, voice=("friendly", "en"), seed="s")
    assert "<b>bug</b>" not in head + body and "&lt;b&gt;bug" in head
    head, body = get_short_reminder_copy("Fix <b>bug</b> & ship", "Project", 10, voice=("friendly", "en"), seed="s")
    assert "<b>bug</b> & ship" in head
    head, body = get_push_due_soon_copy("Gym", ("strict", "en"), "s")
    assert head == "Gym · in 1 hour" and body


async def _digest():
    return await get_today_digest_copy([{"title": "A<b>"}, {"title": "B"}], 8, ("funny", "en"), "s")


def test_digest_lists_the_titles_escaped():
    import asyncio

    head, body = asyncio.run(_digest())
    assert "A&lt;b&gt;" in body and "• B" in body and "2 tasks" in head + body
    assert get_push_today_copy([], ("calm", "en"), "s")[0]
