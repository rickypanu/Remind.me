"""MongoDB index definitions and the idempotent routine that creates them (finding A7).

``ensure_indexes`` runs from the FastAPI lifespan on every start. Creating an index
that already exists with identical options is a no-op, so it is safe with several
workers booting at once.

Run it by hand (e.g. before a deploy) from the ``server`` folder:

    python -m app.db.indexes --check    # report duplicate data that would block the unique indexes
    python -m app.db.indexes            # create / verify all indexes

IMPORTANT - why password-reset tokens live in their own collection
-----------------------------------------------------------------
A TTL index deletes the WHOLE DOCUMENT when its date passes. A TTL index on
``users.reset_token_expires`` would therefore delete the user's account one hour after
they click "forgot password". Expiring reset tokens must live in a collection of their own:

    password_resets: { reset_token_hash, user_id, reset_token_expires }

The password-reset routes (finding S6) must write there. The TTL monitor in MongoDB runs
about once a minute, so the route must still compare ``reset_token_expires`` to "now" when it
validates a token; the TTL index is cleanup, not the security check.
"""

import argparse
import asyncio
import logging
import sys
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from pymongo.errors import OperationFailure

log = logging.getLogger("indexes")

# MongoDB server error codes
_DUPLICATE_KEY = 11000
_INDEX_OPTIONS_CONFLICT = 85
_INDEX_KEY_SPECS_CONFLICT = 86


class IndexSetupError(RuntimeError):
    """An index could not be created. The message says what to do about it."""


@dataclass(frozen=True)
class IndexSpec:
    collection: str
    keys: tuple[tuple[str, int], ...]
    name: str
    options: dict[str, Any] = field(default_factory=dict)
    # Aggregation stages that list documents which would violate a unique index (diagnostics only).
    duplicate_pipeline: tuple[dict[str, Any], ...] = ()


def _duplicates_by(field_expr: Any, *extra_match: dict[str, Any]) -> tuple[dict[str, Any], ...]:
    return (
        *extra_match,
        {"$group": {"_id": field_expr, "count": {"$sum": 1}}},
        {"$match": {"count": {"$gt": 1}}},
        {"$limit": 20},
    )


INDEX_SPECS: tuple[IndexSpec, ...] = (
    # --- users -------------------------------------------------------------------------------
    IndexSpec(
        collection="users",
        keys=(("email", 1),),
        name="uq_users_email",
        options={"unique": True},
        duplicate_pipeline=_duplicates_by("$email"),
    ),
    # Telegram webhook looks users up by chat id when a contact is shared. Sparse: most users have none.
    IndexSpec(
        collection="users",
        keys=(("telegram_chat_id", 1),),
        name="ix_users_telegram_chat_id",
        options={"sparse": True},
    ),
    # --- tasks -------------------------------------------------------------------------------
    # "my reminders", dashboard buckets
    IndexSpec(collection="tasks", keys=(("user_id", 1), ("due_date", 1)), name="ix_tasks_user_due"),
    # Delta sync (P2): "what changed after (updated_at, _id)" for one user, in that order, without an in-memory sort.
    IndexSpec(collection="tasks", keys=(("user_id", 1), ("updated_at", 1), ("_id", 1)), name="ix_tasks_user_updated"),
    # Tombstones (deleted reminders) are removed by MongoDB once their retention period is over.
    # Only tombstones carry `purge_at`, so live reminders are never touched by this index.
    IndexSpec(
        collection="tasks",
        keys=(("purge_at", 1),),
        name="ttl_tasks_purge_at",
        options={"expireAfterSeconds": 0},
    ),
    # per-minute scheduler queries: pending tasks whose due_date falls in a window
    IndexSpec(collection="tasks", keys=(("status", 1), ("due_date", 1)), name="ix_tasks_status_due"),
    # Idempotent create for the offline client: one task per (user, client_id).
    # A *partial* index is used instead of `sparse`: on a compound index `sparse` still indexes every
    # document because user_id is always present, so tasks without a client_id would collide on
    # (user_id, null). The partial filter indexes only documents whose client_id is a string.
    IndexSpec(
        collection="tasks",
        keys=(("user_id", 1), ("client_id", 1)),
        name="uq_tasks_user_client",
        options={"unique": True, "partialFilterExpression": {"client_id": {"$type": "string"}}},
        duplicate_pipeline=_duplicates_by(
            {"user_id": "$user_id", "client_id": "$client_id"},
            {"$match": {"client_id": {"$type": "string"}}},
        ),
    ),
    # Streaks (dashboard motivation card): one row per (user, IST day), read newest first.
    IndexSpec(
        collection="completions",
        keys=(("user_id", 1), ("day", -1)),
        name="uq_completions_user_day",
        options={"unique": True},
        duplicate_pipeline=_duplicates_by({"user_id": "$user_id", "day": "$day"}),
    ),
    # --- password_resets (see module docstring: never TTL the users collection) -------------------
    IndexSpec(
        collection="password_resets",
        keys=(("reset_token_hash", 1),),
        name="uq_password_resets_token_hash",
        options={"unique": True, "sparse": True},
        duplicate_pipeline=_duplicates_by("$reset_token_hash"),
    ),
    IndexSpec(
        collection="password_resets",
        keys=(("reset_token_expires", 1),),
        name="ttl_password_resets_expires",
        options={"expireAfterSeconds": 0},  # delete the document as soon as the date has passed
    ),
    IndexSpec(
        collection="password_resets",
        keys=(("user_id", 1), ("created_at", -1)),
        name="ix_password_resets_user_created",
    ),
    # --- sessions (refresh-token families, finding S9) ------------------------------------------
    IndexSpec(
        collection="sessions",
        keys=(("token_hash", 1),),
        name="uq_sessions_token_hash",
        options={"unique": True},
        duplicate_pipeline=_duplicates_by("$token_hash"),
    ),
    IndexSpec(collection="sessions", keys=(("user_id", 1),), name="ix_sessions_user"),
    IndexSpec(collection="sessions", keys=(("family_id", 1),), name="ix_sessions_family"),
    IndexSpec(
        collection="sessions",
        keys=(("expires_at", 1),),
        name="ttl_sessions_expires",
        options={"expireAfterSeconds": 0},
    ),
    # --- telegram_link_tokens (single-use link tokens, finding S1) --------------------------------
    IndexSpec(
        collection="telegram_link_tokens",
        keys=(("expires", 1),),
        name="ttl_telegram_link_tokens_expires",
        options={"expireAfterSeconds": 0},
    ),
    IndexSpec(collection="telegram_link_tokens", keys=(("user_id", 1),), name="ix_telegram_link_tokens_user"),
    # --- scheduler_locks (one winner per scheduled job and time slot, finding A4) ------------------
    IndexSpec(
        collection="scheduler_locks",
        keys=(("expires_at", 1),),
        name="ttl_scheduler_locks_expires",
        options={"expireAfterSeconds": 0},
    ),
)


async def find_duplicates(db: Any, spec: IndexSpec) -> list[dict[str, Any]]:
    """Best-effort list of values that violate ``spec``'s unique constraint (empty if unknown)."""
    if not spec.duplicate_pipeline:
        return []
    try:
        cursor = await db[spec.collection].aggregate(list(spec.duplicate_pipeline))
        return list(await cursor.to_list(length=20))
    except Exception:  # diagnostics must never hide the original error
        log.exception("Could not list duplicates for %s", spec.name)
        return []


async def _explain(db: Any, spec: IndexSpec, exc: OperationFailure) -> IndexSetupError:
    target = f"{spec.collection}.{spec.name}"
    code = exc.code
    if code == _DUPLICATE_KEY:
        duplicates = await find_duplicates(db, spec)
        shown = "; ".join(f"{d.get('_id')} x{d.get('count')}" for d in duplicates)
        shown = shown or "run `python -m app.db.indexes --check`"
        return IndexSetupError(
            f"Cannot create unique index {target}: existing data contains duplicates ({shown}). "
            "Merge or delete the duplicate documents, then restart."
        )
    if code in (_INDEX_OPTIONS_CONFLICT, _INDEX_KEY_SPECS_CONFLICT):
        return IndexSetupError(
            f"Index {target} conflicts with an existing index on the same keys or name but with different options "
            f"({exc}). Drop the old index in MongoDB (db.{spec.collection}.dropIndexes('<name>')) and restart."
        )
    return IndexSetupError(f"Could not create index {target}: {exc}")


async def ensure_indexes(db: Any, specs: Sequence[IndexSpec] = INDEX_SPECS) -> list[str]:
    """Create every index in ``specs`` (idempotent). Returns the ``collection.index`` names ensured."""
    ensured: list[str] = []
    for spec in specs:
        try:
            await db[spec.collection].create_index(list(spec.keys), name=spec.name, **spec.options)
        except OperationFailure as exc:
            raise await _explain(db, spec, exc) from exc
        ensured.append(f"{spec.collection}.{spec.name}")
        log.debug("Index ready: %s.%s", spec.collection, spec.name)
    log.info("MongoDB indexes verified (%d)", len(ensured))
    return ensured


async def report_duplicates(db: Any, specs: Sequence[IndexSpec] = INDEX_SPECS) -> dict[str, list[dict[str, Any]]]:
    """Duplicates per unique index, so they can be fixed BEFORE a deploy. Only non-empty results are returned."""
    report: dict[str, list[dict[str, Any]]] = {}
    for spec in specs:
        if spec.options.get("unique"):
            found = await find_duplicates(db, spec)
            if found:
                report[f"{spec.collection}.{spec.name}"] = found
    return report


async def _cli(check_only: bool) -> int:
    from app.core.config import get_settings  # local import keeps the module usable without full config
    from app.db.client import create_mongo_client

    settings = get_settings()
    client = create_mongo_client(settings)
    try:
        db = client[settings.database_name]
        if check_only:
            report = await report_duplicates(db)
            if not report:
                print("No duplicate data found. Unique indexes can be created.")  # noqa: T201
                return 0
            for name, rows in report.items():
                print(f"{name}:")  # noqa: T201
                for row in rows:
                    print(f"  {row['_id']}  x{row['count']}")  # noqa: T201
            return 1
        for name in await ensure_indexes(db):
            print(f"ok  {name}")  # noqa: T201
        return 0
    except IndexSetupError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)  # noqa: T201
        return 1
    finally:
        await client.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or verify RemindMe MongoDB indexes.")
    parser.add_argument("--check", action="store_true", help="only report duplicate data; change nothing")
    args = parser.parse_args()
    raise SystemExit(asyncio.run(_cli(args.check)))


if __name__ == "__main__":
    main()
