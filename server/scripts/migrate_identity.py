"""One-off migration for the integrations hardening and delta sync (findings A3, S1, P2).

Run it BEFORE deploying, and once more after.

Problem: the old Telegram webhook did ``update_one({"_id": "<user id string>"}, ..., upsert=True)``. The real user's
``_id`` is an ObjectId, so the string never matched and MongoDB created a second, "shadow" user document per linked
account that held ``telegram_chat_id`` (and ``phone_number``). Tasks stored ``user_id`` as a string. The new code
uses ObjectIds everywhere, so without this script linked chats would look unlinked and tasks would disappear.

What it does
    1. For every ``users`` document whose ``_id`` is a STRING:
         * a real user with that id exists -> copy ``telegram_chat_id``, ``phone_number`` and ``push_subscriptions``
           onto the real user (shadow values win: they are what the user linked), then delete the shadow;
         * no real user -> an orphan; reported, kept (``--delete-orphans`` removes them).
    2. Converts ``tasks.user_id`` from a 24-character hex string to the ObjectId (tasks of users that do not exist
       are reported and left alone). Task encryption is not affected: its key context is the id as text.
    3. Gives every task that has no ``updated_at`` one (its ``created_at``, else the time of the run). Delta sync
       (``GET /v1/tasks``) orders by that field; a task without it would never be sent to a client.
    4. ``--reset-telegram-links`` (recommended): clears every telegram_chat_id / phone_number. Before this release
       ANYONE could link ANY chat to ANY account (finding S1), so existing links cannot be trusted. Users link again
       from Settings in a few seconds with the new single-use link.

    python -m scripts.migrate_identity                        # dry run: prints the plan, changes nothing
    python -m scripts.migrate_identity --apply
    python -m scripts.migrate_identity --apply --reset-telegram-links --delete-orphans

Safe to run repeatedly. Nothing is deleted except merged shadow documents (and orphans, only with the flag).
"""

import argparse
import asyncio
import sys
from datetime import datetime
from typing import Any

from bson import ObjectId

from app.core.clock import as_aware_utc, now_ms, truncate_ms
from app.db.ids import to_object_id

MERGE_FIELDS = ("telegram_chat_id", "phone_number", "push_subscriptions")


async def plan(db: Any) -> dict:
    """Pure reads. Returns what ``apply`` would do."""
    shadows: list[dict] = []
    async for user in db["users"].find({}):
        if isinstance(user["_id"], str):
            shadows.append(user)

    merges: list[tuple[dict, ObjectId]] = []
    orphans: list[dict] = []
    for shadow in shadows:
        real_id = to_object_id(shadow["_id"])
        if real_id is not None and await db["users"].find_one({"_id": real_id}, {"_id": 1}) is not None:
            merges.append((shadow, real_id))
        else:
            orphans.append(shadow)

    task_owner_strings = [v for v in await db["tasks"].distinct("user_id") if isinstance(v, str)]
    convertible: list[tuple[str, ObjectId]] = []
    unconvertible: list[str] = []
    for value in task_owner_strings:
        oid = to_object_id(value)
        if oid is None:
            unconvertible.append(value)
        else:
            convertible.append((value, oid))
    unstamped = await db["tasks"].count_documents({"updated_at": {"$exists": False}})
    return {
        "merges": merges,
        "orphans": orphans,
        "task_owners": convertible,
        "bad_task_owners": unconvertible,
        "unstamped_tasks": unstamped,
    }


async def stamp_updated_at(db: Any, now: datetime) -> int:
    """Give every task without ``updated_at`` one (``created_at`` if it has it). Idempotent; returns the count."""
    stamped = 0
    async for task in db["tasks"].find({"updated_at": {"$exists": False}}, {"created_at": 1}):
        moment = truncate_ms(as_aware_utc(task["created_at"])) if task.get("created_at") else now
        outcome = await db["tasks"].update_one(
            {"_id": task["_id"], "updated_at": {"$exists": False}}, {"$set": {"updated_at": moment}}
        )
        stamped += outcome.modified_count
    return stamped


async def apply(db: Any, result: dict, *, delete_orphans: bool, reset_telegram: bool) -> dict:
    counts = {"merged": 0, "orphans_deleted": 0, "tasks_converted": 0, "tasks_stamped": 0, "telegram_reset": 0}
    for shadow, real_id in result["merges"]:
        carry = {field: shadow[field] for field in MERGE_FIELDS if shadow.get(field)}
        if carry:
            if "telegram_chat_id" in carry:  # a chat belongs to one account only
                await db["users"].update_many(
                    {"telegram_chat_id": carry["telegram_chat_id"], "_id": {"$ne": real_id}},
                    {"$unset": {"telegram_chat_id": "", "phone_number": ""}},
                )
            await db["users"].update_one({"_id": real_id}, {"$set": carry})
        await db["users"].delete_one({"_id": shadow["_id"]})
        counts["merged"] += 1

    if delete_orphans:
        for shadow in result["orphans"]:
            await db["users"].delete_one({"_id": shadow["_id"]})
            counts["orphans_deleted"] += 1

    for text, oid in result["task_owners"]:
        outcome = await db["tasks"].update_many({"user_id": text}, {"$set": {"user_id": oid}})
        counts["tasks_converted"] += outcome.modified_count

    counts["tasks_stamped"] = await stamp_updated_at(db, now_ms())

    if reset_telegram:
        outcome = await db["users"].update_many(
            {"$or": [{"telegram_chat_id": {"$exists": True}}, {"phone_number": {"$exists": True}}]},
            {"$unset": {"telegram_chat_id": "", "phone_number": ""}},
        )
        counts["telegram_reset"] = outcome.modified_count
    return counts


async def main(do_apply: bool, delete_orphans: bool, reset_telegram: bool) -> int:
    from app.db.client import open_database  # imported late so `--help` works without a configured .env

    client, db = open_database()

    try:
        result = await plan(db)
        print(f"{len(result['merges'])} shadow user document(s) to merge into the real user")
        for shadow, real_id in result["merges"]:
            has = ", ".join(f for f in MERGE_FIELDS if shadow.get(f)) or "nothing to carry over"
            print(f"  {shadow['_id']} -> {real_id}  ({has})")
        print(f"{len(result['orphans'])} orphan string-id user document(s) (no matching real user)")
        for shadow in result["orphans"]:
            print(f"  {shadow['_id']}")
        print(f"{len(result['task_owners'])} distinct string tasks.user_id value(s) to convert to ObjectId")
        if result["bad_task_owners"]:
            print(f"{len(result['bad_task_owners'])} tasks.user_id value(s) are not valid ids and stay untouched:")
            for value in result["bad_task_owners"]:
                print(f"  {value!r}")
        print(f"{result['unstamped_tasks']} task(s) without updated_at (will be stamped for delta sync)")
        if reset_telegram:
            print("--reset-telegram-links: every Telegram link will be cleared (users link again)")

        if not do_apply:
            print("\nDry run: nothing was changed. Re-run with --apply.")
            return 0
        counts = await apply(db, result, delete_orphans=delete_orphans, reset_telegram=reset_telegram)
        print("\nDone:", ", ".join(f"{k}={v}" for k, v in counts.items()))
        return 0
    finally:
        await client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="make the changes (default: dry run)")
    parser.add_argument("--delete-orphans", action="store_true", help="also delete string-id users with no real user")
    parser.add_argument("--reset-telegram-links", action="store_true", help="clear all Telegram links (recommended)")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.apply, args.delete_orphans, args.reset_telegram_links)))
