"""Reminder delivery: ONE implementation for every channel (findings A2, A3, A4, P5).

``Notifier`` owns the things the Telegram and Web Push schedulers each used to re-implement:

  * ``load_users``   ONE batched ``$in`` query for all users of a job (was one query per task: the N+1 of P5),
                     keyed by ``ObjectId`` (A3), no shadow documents, no ``upsert``.
  * ``send_telegram`` / ``send_push``  deliver to one user and say what happened (SENT / SKIPPED / FAILED), so a
                     job can give a claim back when the network failed (A4: no silently lost reminder).
  * ``run_bounded``  runs many deliveries at once, at most ``concurrency`` in flight (an ``asyncio.Semaphore``),
                     and LOGS any exception instead of letting ``gather`` swallow it.
  * ``claim_slot``   a one-winner lock per (job, time slot) in MongoDB, so two workers/instances never both send the
                     same digest (A4).
"""

import asyncio
import logging
from collections.abc import Awaitable, Iterable
from datetime import timedelta
from enum import Enum
from typing import Any

from bson import ObjectId

from app.db.ids import to_object_id
from app.integrations.telegram import Outcome, TelegramClient
from app.integrations.webpush import PushOutcome, WebPushSender
from app.notifications.rules import CHANNELS
from app.repositories import LockRepository, UserRepository
from utils.timezone import now_utc

log = logging.getLogger("notifier")

_USER_PROJECTION = {"telegram_chat_id": 1, "push_subscriptions": 1}
_ID_BATCH = 500


class Delivery(str, Enum):
    SENT = "sent"
    SKIPPED = "skipped"  # nothing to deliver to (no linked chat / no device), or a permanent failure
    FAILED = "failed"  # a temporary failure: the caller may give the claim back so the next run retries


class Notifier:
    def __init__(self, db: Any, telegram: TelegramClient, push: WebPushSender, *, concurrency: int = 10) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.locks = LockRepository(db)
        self.telegram = telegram
        self.push = push
        self._sem = asyncio.Semaphore(max(1, concurrency))

    @property
    def channels(self) -> tuple[str, ...]:
        """Channels that are actually configured (an unconfigured channel is not even queried for)."""
        enabled = {"tele": self.telegram.enabled, "web": self.push.enabled}
        return tuple(channel for channel in CHANNELS if enabled[channel])

    # ---- users (one batched query) -------------------------------------------------------------
    async def load_users(self, user_ids: Iterable[Any]) -> dict[ObjectId, dict]:
        """``{ObjectId: user}`` for every distinct valid id. Ids that are not ObjectIds are logged and skipped."""
        wanted: set[ObjectId] = set()
        bad = 0
        for raw in user_ids:
            oid = to_object_id(raw)
            if oid is None:
                bad += 1
            else:
                wanted.add(oid)
        if bad:
            log.warning("Skipped %d task(s) whose user_id is not a valid ObjectId", bad)

        users: dict[ObjectId, dict] = {}
        ids = list(wanted)
        for start in range(0, len(ids), _ID_BATCH):
            chunk = ids[start : start + _ID_BATCH]
            for user in await self.users.load_many(chunk, _USER_PROJECTION):
                users[user["_id"]] = user
        return users

    # ---- delivery --------------------------------------------------------------------------------
    async def send_telegram(self, user: dict, title_html: str, body_html: str) -> Delivery:
        chat_id = user.get("telegram_chat_id")
        if not chat_id or not self.telegram.enabled:
            return Delivery.SKIPPED
        outcome = await self.telegram.send(chat_id, title_html, body_html)
        if outcome is Outcome.SENT:
            return Delivery.SENT
        if outcome is Outcome.TRANSIENT:
            return Delivery.FAILED
        return Delivery.SKIPPED  # blocked bot / unknown chat / not configured: retrying cannot help

    async def send_push(self, user: dict, title: str, body: str) -> Delivery:
        subscriptions = list(user.get("push_subscriptions") or [])
        if not subscriptions or not self.push.enabled:
            return Delivery.SKIPPED

        outcomes = await asyncio.gather(
            *(self.push.send(s if isinstance(s, dict) else {}, title, body) for s in subscriptions)
        )
        for subscription, outcome in zip(subscriptions, outcomes, strict=True):
            if outcome in (PushOutcome.GONE, PushOutcome.INVALID):
                await self._drop_subscription(user["_id"], subscription, outcome)
        if PushOutcome.SENT in outcomes:
            return Delivery.SENT
        if PushOutcome.FAILED in outcomes:
            return Delivery.FAILED
        return Delivery.SKIPPED

    async def _drop_subscription(self, user_id: ObjectId, subscription: Any, outcome: PushOutcome) -> None:
        endpoint = subscription.get("endpoint") if isinstance(subscription, dict) else None
        condition = {"endpoint": endpoint} if endpoint else subscription
        log.info("Removing a %s web-push subscription", outcome.value)  # the endpoint URL is a credential: not logged
        await self.users.pull_push_subscription(user_id, condition)

    # ---- concurrency -----------------------------------------------------------------------------
    async def run_bounded(self, coroutines: Iterable[Awaitable[Any]], label: str = "job") -> list[Any]:
        """Run all awaitables with at most ``concurrency`` active. Failures are logged, never swallowed."""

        async def guarded(coroutine: Awaitable[Any]) -> Any:
            async with self._sem:
                return await coroutine

        results = await asyncio.gather(*(guarded(c) for c in coroutines), return_exceptions=True)
        for result in results:
            if isinstance(result, BaseException):
                log.error("%s: one delivery raised %s", label, type(result).__name__, exc_info=result)
        return results

    # ---- multi-worker safety ---------------------------------------------------------------------
    async def claim_slot(self, job: str, slot: str, ttl: timedelta = timedelta(hours=3)) -> bool:
        """True for exactly ONE caller per (job, slot), however many workers run the same schedule."""
        return await self.locks.acquire(f"{job}:{slot}", now_utc() + ttl)
