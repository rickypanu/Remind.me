"""Admin broadcast to every linked Telegram chat (finding S14, A2).

Title and body are PLAIN text. They are HTML-escaped before sending, so an admin message (or a stolen admin key)
cannot inject markup or links into users' chats; Telegram's HTML parser would otherwise accept ``<a href>`` tags.
"""

import logging
from typing import Any

from app.integrations.telegram import Outcome
from app.notifications.dispatch import Notifier
from app.repositories import UserRepository

log = logging.getLogger("broadcast")

_BATCH = 200


async def broadcast_to_all(notifier: Notifier, title: str, body: str, report_chat_id: str | None = None) -> dict:
    telegram = notifier.telegram
    counts = {"sent": 0, "failed": 0}

    async def deliver(chat_id: str) -> None:
        outcome = await telegram.send_plain(chat_id, title, body)
        counts["sent" if outcome is Outcome.SENT else "failed"] += 1

    batch: list[Any] = []
    async for chat_id in UserRepository(notifier.db).telegram_chat_ids():
        batch.append(chat_id)
        if len(batch) >= _BATCH:
            await notifier.run_bounded((deliver(c) for c in batch), "broadcast")
            batch = []
    if batch:
        await notifier.run_bounded((deliver(c) for c in batch), "broadcast")

    log.info("Broadcast finished: sent=%d failed=%d", counts["sent"], counts["failed"])
    if report_chat_id:
        report = f"Sent: {counts['sent']}\nFailed: {counts['failed']}"
        await telegram.send_plain(report_chat_id, "Broadcast done", report)
    return counts
