"""
Shared helpers for reading / writing reminders so that ENCRYPTION is applied in exactly one place.

  * Anything written to MongoDB goes through `to_storage()` (title / description / category are encrypted).
  * Anything read from MongoDB goes through `from_storage()` (decrypted in memory, for the owner only).
"""

from utils.crypto import decrypt_fields, encrypt_fields
from utils.recurrence import describe_schedule

ENCRYPTED_FIELDS = ("title", "description", "category")


def to_storage(user_id, doc: dict) -> dict:
    """Return a copy of `doc` that is safe to insert / update in MongoDB."""
    # The encryption key context is the id as TEXT, so a task keeps decrypting whether user_id is stored as an
    # ObjectId (now) or a string (before the identity migration).
    return encrypt_fields(str(user_id), doc, ENCRYPTED_FIELDS)


def from_storage(doc: dict) -> dict:
    """Return a decrypted copy of a task document (does not touch `_id`)."""
    return decrypt_fields(str(doc.get("user_id")), doc, ENCRYPTED_FIELDS)


def to_response(doc: dict) -> dict:
    """Decrypted, JSON-ready dict matching schemas.task.TaskResponse (``doc`` is the stored, encrypted form)."""
    return shape_response(from_storage(doc))


def shape_response(task: dict) -> dict:
    """JSON-ready dict from an ALREADY DECRYPTED task (what ``TaskRepository`` returns)."""
    task = dict(task)
    if "_id" in task:
        task["id"] = str(task.pop("_id"))
    task["user_id"] = str(task.get("user_id"))
    task.setdefault("schedule_type", "once")
    task["schedule_label"] = describe_schedule(task["schedule_type"], task.get("time_of_day"), task.get("weekdays"))
    # Internal bookkeeping flags are not part of the API.
    for k in [k for k in task if k.startswith("notified_") or k == "last_notified_at"]:
        task.pop(k, None)
    # Delta-sync clock. Rows written before it existed fall back to their creation time.
    if task.get("updated_at") is None:
        task["updated_at"] = task.get("created_at")
    for k in ("deleted", "deleted_at", "purge_at", "created_at"):
        task.pop(k, None)
    return task
