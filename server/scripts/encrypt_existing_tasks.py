"""
One-off migration: encrypt reminders that were saved as plain text before encryption was enabled,
and give old reminders the new recurring-schedule fields (as one-time reminders).

Safe to run more than once (already-encrypted values are skipped).

    cd server
    python -m scripts.encrypt_existing_tasks --dry-run     # see what would change
    python -m scripts.encrypt_existing_tasks               # do it

Back up your database first. Requires REMINDER_ENCRYPTION_KEY (and the usual MONGODB_URL / DATABASE_NAME).
"""
import argparse
import asyncio

from dotenv import load_dotenv

load_dotenv()

from database import db  # noqa: E402
from utils.crypto import assert_encryption_configured, is_encrypted  # noqa: E402
from utils.task_store import ENCRYPTED_FIELDS, to_storage  # noqa: E402


async def main(dry_run: bool):
    assert_encryption_configured()
    scanned = encrypted = defaulted = 0
    async for task in db["tasks"].find({}):
        scanned += 1
        user_id = str(task.get("user_id"))
        changes = {}

        plain_fields = {f: task[f] for f in ENCRYPTED_FIELDS if f in task and task[f] is not None and not is_encrypted(task[f])}
        if plain_fields:
            changes.update(to_storage(user_id, plain_fields))
            encrypted += 1

        if "schedule_type" not in task:
            changes.update({"schedule_type": "once", "time_of_day": None, "weekdays": [], "ends_on": None, "completed_count": 0})
            defaulted += 1

        if changes and not dry_run:
            await db["tasks"].update_one({"_id": task["_id"]}, {"$set": changes})

    verb = "Would update" if dry_run else "Updated"
    print(f"Scanned {scanned} reminder(s). {verb}: {encrypted} encrypted, {defaulted} given schedule fields.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    asyncio.run(main(parser.parse_args().dry_run))
