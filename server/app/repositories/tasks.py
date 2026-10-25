"""Reminders (collection ``tasks``): every query, and the encrypt / decrypt step (findings A1, A9, P2).

Rules enforced here, structurally, for every caller:

  * Reminder text (title, description, category) is encrypted on the way in and decrypted on the way out
    (``utils.task_store``). Nothing outside this module sees ciphertext or has to remember to encrypt.
  * Every query is scoped to the owner (``user_id``, an ObjectId) AND to live documents, so one user can never
    reach another user's reminder, and a deleted one can never be read, edited or notified.
  * Every change a client can see bumps ``updated_at`` (UTC, millisecond precision). That field is the delta-sync
    clock. Internal bookkeeping (the "already notified" flags) deliberately does NOT bump it.
  * Deleting writes a TOMBSTONE instead of removing the document: the content is erased, ``deleted`` is set, and
    ``purge_at`` lets a TTL index drop it after the retention period. A client that syncs later learns about the
    delete from the tombstone, and converges without re-downloading everything.
"""

from collections.abc import Callable, Iterable
from datetime import datetime, timedelta
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.core.clock import now_ms
from app.notifications.rules import NOTIFICATION_FLAGS
from utils.task_store import from_storage, to_storage

LIVE: dict[str, Any] = {"deleted": {"$ne": True}}

# Everything a tombstone forgets. What remains: _id, user_id, deleted, deleted_at, updated_at, purge_at.
_TOMBSTONE_DROP: tuple[str, ...] = (
    "title", "description", "category", "status", "due_date", "schedule_type", "time_of_day", "weekdays",
    "ends_on", "completed_count", "last_completed_at", "completed_at", "missed_count", "client_id", "created_at",
    *NOTIFICATION_FLAGS,
)  # fmt: skip

DEFAULT_TOMBSTONE_RETENTION = timedelta(days=30)

# A position in the change feed: (updated_at, _id). Strictly ordered, so pages never skip or repeat a document.
Position = tuple[datetime, ObjectId]


class TaskRepository:
    def __init__(
        self,
        db: Any,
        *,
        clock: Callable[[], datetime] = now_ms,
        tombstone_retention: timedelta = DEFAULT_TOMBSTONE_RETENTION,
    ) -> None:
        self._c = db["tasks"]
        self._clock = clock
        self._retention = tombstone_retention

    def _scoped(self, user_id: Any, extra: dict | None = None) -> dict:
        query: dict[str, Any] = {"user_id": user_id, **LIVE}
        query.update(extra or {})
        return query

    # ---- reads -------------------------------------------------------------------------------------------
    async def get(self, user_id: ObjectId, task_id: ObjectId) -> dict | None:
        doc = await self._c.find_one(self._scoped(user_id, {"_id": task_id}))
        return from_storage(doc) if doc else None

    async def get_by_client_id(self, user_id: ObjectId, client_id: str) -> dict | None:
        doc = await self._c.find_one(self._scoped(user_id, {"client_id": client_id}))
        return from_storage(doc) if doc else None

    async def changes_after(
        self, user_id: ObjectId, after: Position | None, limit: int, *, include_deleted: bool = True
    ) -> list[dict]:
        """Documents that changed after ``after``, oldest change first, at most ``limit`` of them.

        ``after=None`` starts from the beginning. ``include_deleted=False`` (a SNAPSHOT) returns live documents
        only; with True, tombstones are included so the caller can remove what was deleted. Live documents come
        back decrypted; tombstones as ``{"_id", "deleted": True, "deleted_at", "updated_at"}``.
        """
        query: dict[str, Any] = {"user_id": user_id}
        if not include_deleted:
            query.update(LIVE)
        if after is not None:
            moment, last_id = after
            query["$or"] = [{"updated_at": {"$gt": moment}}, {"updated_at": moment, "_id": {"$gt": last_id}}]
        docs = await self._c.find(query).sort([("updated_at", 1), ("_id", 1)]).limit(limit).to_list(length=limit)
        return [self._present(doc) for doc in docs]

    @staticmethod
    def _present(doc: dict) -> dict:
        if doc.get("deleted"):
            return {
                "_id": doc["_id"], "deleted": True,
                "deleted_at": doc.get("deleted_at"), "updated_at": doc.get("updated_at"),
            }  # fmt: skip
        return from_storage(doc)

    async def find_many(self, query: dict, length: int | None = None) -> list[dict]:
        """Live reminders matching ``query`` (any owner), decrypted. For the notification jobs."""
        merged = {**query, **LIVE}
        docs = await self._c.find(merged).to_list(length=length)
        return [from_storage(doc) for doc in docs]

    # ---- writes (visible to clients: bump updated_at) -----------------------------------------------------------
    async def insert(self, user_id: ObjectId, plain: dict) -> tuple[dict, bool]:
        """Store a new reminder. Returns ``(document, created)``.

        ``created`` is False when ``plain["client_id"]`` was already stored for this user: the unique index
        (user_id, client_id) makes a retried create harmless even if two requests race.
        """
        now = self._clock()
        doc = {**plain, "user_id": user_id, "updated_at": now}
        doc.setdefault("created_at", now)
        stored = to_storage(user_id, doc)
        try:
            result = await self._c.insert_one(stored)
        except DuplicateKeyError:
            client_id = plain.get("client_id")
            existing = await self.get_by_client_id(user_id, client_id) if client_id else None
            if existing is None:
                raise
            return existing, False
        stored["_id"] = result.inserted_id
        return from_storage(stored), True

    async def update_fields(
        self, user_id: ObjectId, task_id: ObjectId, plain: dict, *, clear_flags: Iterable[str] = ()
    ) -> dict | None:
        """Change fields (plain text in, encrypted at rest). ``clear_flags`` re-arms the notifications."""
        update: dict[str, Any] = {"$set": {**to_storage(user_id, plain), "updated_at": self._clock()}}
        unset = {flag: "" for flag in clear_flags}
        if unset:
            update["$unset"] = unset
        result = await self._c.update_one(self._scoped(user_id, {"_id": task_id}), update)
        if not result.matched_count:
            return None
        return await self.get(user_id, task_id)

    async def set_status(self, user_id: ObjectId, task_id: ObjectId, status: str) -> bool:
        """Complete or re-open. ``completed_at`` (UTC instant) is stamped on completion and cleared on re-open."""
        now = self._clock()
        update: dict[str, Any] = {"$set": {"status": status, "updated_at": now}}
        if status == "completed":
            update["$set"]["completed_at"] = now
        else:
            update["$unset"] = {"completed_at": ""}
        result = await self._c.update_one(self._scoped(user_id, {"_id": task_id}), update)
        return result.matched_count == 1

    async def apply_change(
        self, user_id: Any, task_id: Any, change: dict, *, guard: dict | None = None
    ) -> bool:
        """Apply a ``{"set", "unset", "inc"}`` change computed by ``utils.recurrence`` (roll to the next
        occurrence). ``guard`` adds conditions (e.g. the old due date) so a concurrent edit is never overwritten."""
        update: dict[str, Any] = {"$set": {**change["set"], "updated_at": self._clock()}}
        if change.get("inc"):
            update["$inc"] = change["inc"]
        if change.get("unset"):
            update["$unset"] = change["unset"]
        query = self._scoped(user_id, {"_id": task_id, **(guard or {})})
        result = await self._c.update_one(query, update)
        return result.modified_count == 1

    async def delete(self, user_id: ObjectId, task_id: ObjectId) -> bool:
        """Turn a live reminder into a tombstone. False if it does not exist (or is already deleted)."""
        now = self._clock()
        result = await self._c.update_one(
            self._scoped(user_id, {"_id": task_id}),
            {
                "$set": {"deleted": True, "deleted_at": now, "updated_at": now, "purge_at": now + self._retention},
                "$unset": {field: "" for field in _TOMBSTONE_DROP},
            },
        )
        return result.matched_count == 1

    async def delete_all_for_user(self, user_id: ObjectId) -> int:
        """Account deletion: remove everything, tombstones included (rows from before the ObjectId migration too)."""
        result = await self._c.delete_many({"user_id": {"$in": [user_id, str(user_id)]}})
        return result.deleted_count

    # ---- notification bookkeeping (invisible to clients: does NOT bump updated_at) -------------------------------
    async def claim_reminder(self, task_id: ObjectId, flag: str, fields: dict) -> bool:
        """Atomically mark a reminder as announced. True only for the caller that won the claim."""
        result = await self._c.update_one({"_id": task_id, flag: {"$ne": True}, **LIVE}, {"$set": fields})
        return result.modified_count == 1

    async def release_reminder(self, task_id: ObjectId, fields: dict) -> None:
        await self._c.update_one({"_id": task_id}, {"$unset": {key: "" for key in fields}})

    async def mark_notified(self, task_ids: list[ObjectId], fields: dict) -> None:
        if task_ids:
            await self._c.update_many({"_id": {"$in": task_ids}}, {"$set": fields})

    async def find_missed_recurring(self, cutoff: datetime, recurring_types: Iterable[str]) -> list[dict]:
        """Live daily / weekly reminders whose occurrence is older than ``cutoff`` and not completed (raw)."""
        query = {
            "schedule_type": {"$in": list(recurring_types)},
            "status": {"$ne": "completed"},
            "due_date": {"$lt": cutoff},
            **LIVE,
        }
        return [doc async for doc in self._c.find(query)]

    # ---- diagnostics ----------------------------------------------------------------------------------------------
    async def count_string_owners(self) -> int:
        return await self._c.count_documents({"user_id": {"$type": "string"}})

    async def count_missing_updated_at(self) -> int:
        return await self._c.count_documents({"updated_at": {"$exists": False}})
