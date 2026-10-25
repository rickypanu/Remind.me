"""Reminder business rules (findings A1, P2): create, edit, complete, delete and the delta-sync feed.

No HTTP and no MongoDB here: routes call this, this calls ``TaskRepository``, and errors are domain errors.

Delta sync (``list_changes``)
    A client keeps one opaque ``cursor``. Each poll sends it back and receives everything that changed since, in
    pages of at most ``limit`` (default 200, max 500), plus tombstones for reminders deleted in the meantime.

    * No cursor            -> SNAPSHOT: every live reminder, paged. ``snapshot=True`` on every page; when the last page
                              arrives the client deletes any local reminder the snapshot did not mention.
    * ``since=<datetime>`` -> like a cursor made by hand: changes with ``updated_at >= since``.
    * Cursor too old       -> 410 ``full_resync_required``: tombstones are purged after the retention period, so a
                              client that stayed away longer than that cannot learn about deletes any more.

    Ordering key is (``updated_at``, ``_id``): unique and strictly increasing per document, so paging never skips or
    repeats a change, even when many reminders share one millisecond.

    The cursor that ends a run (``has_more=False``) is "now minus a safety window" (default 5 s), never "now":
    a write stamped just before the query but committed just after it (or stamped by a server whose clock runs a few
    seconds slow) would otherwise be skipped for ever. The price is that changes from the last few seconds are sent
    again on the next poll. Applying a change twice is harmless (it is keyed by id), so the feed is idempotent.
"""

import base64
import binascii
import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any

from bson import ObjectId

from app.core.clock import as_aware_utc, now_ms, truncate_ms
from app.core.config import Settings, get_settings
from app.core.errors import BadRequest, Gone, NotFound, Unprocessable
from app.db.ids import to_object_id
from app.notifications.rules import NOTIFICATION_FLAGS
from app.repositories.completions import CompletionRepository
from app.repositories.tasks import Position, TaskRepository
from app.services.moderation import ensure_allowed
from schemas.task import TaskCreate, TaskStatusUpdate, TaskUpdate
from utils.recurrence import (
    RECURRING_TYPES,
    advance_after_completion,
    next_occurrence,
    parse_time_of_day,
)
from utils.streak import best_streak, current_streak
from utils.task_store import shape_response
from utils.timezone import as_ist, ist_day_key, to_utc

log = logging.getLogger("tasks")
_EPOCH = datetime(1970, 1, 1, tzinfo=UTC)
_MIN_OID = ObjectId("0" * 24)
_MS = timedelta(milliseconds=1)
NO_UPCOMING = "That schedule has no upcoming occurrence. Check the end date."


# ---------------------------------------------------------------------------------------------------------
# Cursor: opaque to clients. "<flag>.<epoch ms>.<object id>", base64url without padding.
#   flag "s": a snapshot is still in progress (live reminders only), "d": a delta position.
# ---------------------------------------------------------------------------------------------------------
def encode_cursor(position: Position, *, snapshot: bool) -> str:
    moment, oid = position
    millis = (as_aware_utc(moment) - _EPOCH) // _MS
    raw = f"{'s' if snapshot else 'd'}.{millis}.{oid}"
    return base64.urlsafe_b64encode(raw.encode("ascii")).decode("ascii").rstrip("=")


def decode_cursor(cursor: str) -> tuple[Position, bool]:
    """``((moment, oid), snapshot)``. Raises ``BadRequest(code="invalid_cursor")`` for anything not made by us."""
    invalid = BadRequest("Invalid cursor.", code="invalid_cursor")
    if not cursor or len(cursor) > 100:
        raise invalid
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4)).decode("ascii")
        flag, millis_text, oid_text = raw.split(".")
        millis = int(millis_text)
    except (binascii.Error, UnicodeDecodeError, ValueError):
        raise invalid from None
    oid = to_object_id(oid_text)
    if flag not in ("s", "d") or oid is None or not 0 <= millis <= 32_503_680_000_000:  # year 3000
        raise invalid
    return (_EPOCH + millis * _MS, oid), flag == "s"


@dataclass
class SyncPage:
    items: list[dict] = field(default_factory=list)
    deleted: list[dict] = field(default_factory=list)
    next_cursor: str = ""
    has_more: bool = False
    snapshot: bool = False
    server_time: datetime | None = None


class TaskService:
    def __init__(
        self,
        repo: TaskRepository,
        *,
        clock=now_ms,
        retention: timedelta = timedelta(days=30),
        default_page_size: int = 200,
        max_page_size: int = 500,
        safety_window: timedelta = timedelta(seconds=5),
        completions: CompletionRepository | None = None,
    ) -> None:
        self.repo = repo
        self.completions = completions
        self._clock = clock
        self._retention = retention
        self._default_page = default_page_size
        self._max_page = max_page_size
        self._safety = safety_window

    # ---- helpers ----------------------------------------------------------------------------------------
    @staticmethod
    def parse_id(task_id: str) -> ObjectId:
        oid = to_object_id(task_id)
        if oid is None:
            raise BadRequest("Invalid task ID")
        return oid

    def build_document(self, task: TaskCreate) -> dict:
        """Plain-text document for a new reminder (the repository adds owner, timestamps and encryption)."""
        doc: dict[str, Any] = {
            "title": task.title,
            "description": task.description,
            "category": task.category,
            "status": "pending",
            "schedule_type": task.schedule_type,
            "time_of_day": task.time_of_day,
            "weekdays": task.weekdays,
            "ends_on": task.ends_on,
            "completed_count": 0,
        }
        if task.client_id:
            doc["client_id"] = task.client_id
        if task.schedule_type in RECURRING_TYPES:
            first = next_occurrence(task.schedule_type, task.time_of_day, task.weekdays, self._clock(), task.ends_on)
            if first is None:
                raise Unprocessable(NO_UPCOMING)
            doc["due_date"] = first
        else:
            doc["due_date"] = to_utc(task.due_date)  # a datetime with no timezone is treated as IST
        return doc

    # ---- create / read ----------------------------------------------------------------------------------
    async def create(self, user_id: ObjectId, task: TaskCreate) -> dict:
        """Create a reminder. Idempotent per ``client_id``: a retried create returns the stored reminder."""
        if task.client_id:
            existing = await self.repo.get_by_client_id(user_id, task.client_id)
            if existing:
                return shape_response(existing)
        ensure_allowed(task.title, task.description, task.category)
        doc, _created = await self.repo.insert(user_id, self.build_document(task))
        return shape_response(doc)

    async def get(self, user_id: ObjectId, task_id: str) -> dict:
        doc = await self.repo.get(user_id, self.parse_id(task_id))
        if doc is None:
            raise NotFound("Task not found")
        return shape_response(doc)

    async def list_all(self, user_id: ObjectId, limit: int = 1000) -> list[dict]:
        """Every live reminder, newest change last, capped at ``limit``. Only for the legacy un-versioned list."""
        rows = await self.repo.changes_after(user_id, None, limit, include_deleted=False)
        return [shape_response(row) for row in rows]

    # ---- delta sync -------------------------------------------------------------------------------------
    async def list_changes(
        self,
        user_id: ObjectId,
        *,
        since: datetime | None = None,
        cursor: str | None = None,
        limit: int | None = None,
    ) -> SyncPage:
        if since is not None and cursor:
            raise Unprocessable("Send either 'since' or 'cursor', not both.", code="since_and_cursor")
        size = min(max(limit or self._default_page, 1), self._max_page)
        now = self._clock()

        after: Position | None = None
        snapshot_run = cursor is None and since is None
        if cursor:
            after, snapshot_run = decode_cursor(cursor)
        elif since is not None:
            after = (truncate_ms(as_aware_utc(since)), _MIN_OID)  # inclusive: ties at exactly `since` are resent

        if after is not None and not snapshot_run and as_aware_utc(after[0]) < now - self._retention:
            raise Gone(
                "Your last sync is older than the server remembers deletions. Download everything again.",
                code="full_resync_required",
            )

        rows = await self.repo.changes_after(user_id, after, size + 1, include_deleted=not snapshot_run)
        has_more = len(rows) > size
        rows = rows[:size]

        page = SyncPage(snapshot=snapshot_run, has_more=has_more, server_time=now)
        for row in rows:
            if row.get("deleted"):
                page.deleted.append(
                    {"id": str(row["_id"]), "deleted_at": row.get("deleted_at"), "updated_at": row.get("updated_at")}
                )
            else:
                page.items.append(shape_response(row))

        if has_more:
            last = rows[-1]
            page.next_cursor = encode_cursor((as_aware_utc(last["updated_at"]), last["_id"]), snapshot=snapshot_run)
        else:
            # Never move backwards, never closer than the safety window to "now".
            floor = after[0] if after is not None else _EPOCH
            moment = max(as_aware_utc(floor), now - self._safety)
            page.next_cursor = encode_cursor((moment, _MIN_OID), snapshot=False)
        return page

    # ---- edit -------------------------------------------------------------------------------------------
    async def update(self, user_id: ObjectId, task_id: str, payload: TaskUpdate) -> dict:
        """Edit text / time. A new due time re-arms the reminder notifications."""
        oid = self.parse_id(task_id)
        task = await self.repo.get(user_id, oid)
        if task is None:
            raise NotFound("Task not found")

        changes = payload.model_dump(exclude_unset=True)
        ensure_allowed(changes.get("title"), changes.get("description"), changes.get("category"))

        plain = {k: changes[k] for k in ("title", "description", "category") if k in changes}
        schedule_type = task.get("schedule_type", "once")

        if schedule_type == "once":
            if changes.get("due_date") is not None:
                plain["due_date"] = to_utc(changes["due_date"])
        elif changes.get("time_of_day"):
            try:
                parsed = parse_time_of_day(changes["time_of_day"])
            except ValueError as exc:
                raise Unprocessable(str(exc)) from None
            time_of_day = f"{parsed.hour:02d}:{parsed.minute:02d}"
            upcoming = next_occurrence(
                schedule_type, time_of_day, task.get("weekdays"), self._clock(), task.get("ends_on")
            )
            if upcoming is None:
                raise Unprocessable(NO_UPCOMING)
            plain["time_of_day"] = time_of_day
            plain["due_date"] = upcoming

        if not plain:
            return shape_response(task)
        clear = NOTIFICATION_FLAGS if "due_date" in plain else ()
        fresh = await self.repo.update_fields(user_id, oid, plain, clear_flags=clear)
        if fresh is None:
            raise NotFound("Task not found")
        return shape_response(fresh)

    async def set_status(self, user_id: ObjectId, task_id: str, payload: TaskStatusUpdate) -> dict:
        oid = self.parse_id(task_id)
        task = await self.repo.get(user_id, oid)
        if task is None:
            raise NotFound("Task not found")

        # Completing a daily / weekly reminder finishes only THIS occurrence: it rolls to the next one.
        if payload.status == "completed" and task.get("schedule_type", "once") in RECURRING_TYPES:
            change = advance_after_completion(task, self._clock())
            if not await self.repo.apply_change(user_id, oid, change):
                raise NotFound("Task not found")
            await self._count_completion(user_id)
            return {
                "message": "Done for now. Next one is scheduled." if change["next_due"] else "Series finished.",
                "recurring": True,
                "next_due": change["next_due"],
            }

        was_completed = task.get("status") == "completed"
        if not await self.repo.set_status(user_id, oid, payload.status):
            raise NotFound("Task not found")
        if payload.status == "completed" and not was_completed:
            await self._count_completion(user_id)
        elif payload.status == "pending" and was_completed and task.get("completed_at"):
            await self._uncount_completion(user_id, task["completed_at"])
        return {"message": "Task updated successfully", "recurring": False, "next_due": None}

    # ---- streak -----------------------------------------------------------------------------------------
    async def _count_completion(self, user_id: ObjectId) -> None:
        """Record one completion on today's IST day. Best effort: a failure here never fails the completion."""
        if self.completions is None:
            return
        try:
            await self.completions.add(user_id, ist_day_key(self._clock()))
        except Exception:  # noqa: BLE001
            log.warning("Could not record completion", exc_info=True)

    async def _uncount_completion(self, user_id: ObjectId, completed_at: datetime) -> None:
        if self.completions is None:
            return
        try:
            await self.completions.remove(user_id, ist_day_key(completed_at))
        except Exception:  # noqa: BLE001
            log.warning("Could not undo completion", exc_info=True)

    async def stats(self, user_id: ObjectId) -> dict:
        """``{streak, best_streak, completed_today}`` on IST calendar days, for the dashboard's motivation card."""
        today = as_ist(self._clock()).date()
        history = await self.completions.recent(user_id) if self.completions is not None else {}
        days = set(history)
        return {
            "streak": current_streak(days, today),
            "best_streak": best_streak(days),
            "completed_today": history.get(today, 0),
        }

    async def delete(self, user_id: ObjectId, task_id: str) -> None:
        if not await self.repo.delete(user_id, self.parse_id(task_id)):
            raise NotFound("Task not found or you are not authorized to delete it")


def build_task_service(db: Any, settings: Settings | None = None, *, clock=now_ms) -> TaskService:
    """Wire a ``TaskService`` from Settings (used by the FastAPI dependency and by tests)."""
    settings = settings or get_settings()
    retention = timedelta(days=settings.tombstone_retention_days)
    return TaskService(
        TaskRepository(db, clock=clock, tombstone_retention=retention),
        clock=clock,
        retention=retention,
        default_page_size=settings.sync_default_page_size,
        max_page_size=settings.sync_max_page_size,
        safety_window=timedelta(seconds=settings.sync_safety_window_seconds),
        completions=CompletionRepository(db),
    )
