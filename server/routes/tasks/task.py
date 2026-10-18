from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from database import get_db
from schemas.task import TaskCreate, TaskResponse, TaskStatusUpdate, TaskUpdate
from utils.moderation import enforce
from utils.recurrence import (
    NOTIFICATION_FLAGS,
    RECURRING_TYPES,
    advance_after_completion,
    next_occurrence,
    parse_time_of_day,
)
from utils.security import get_current_user
from utils.timezone import now_utc, to_utc

from utils.task_store import to_response, to_storage

router = APIRouter(tags=["Task"])


def build_task_document(task: TaskCreate, user_id: str) -> dict:
    """Plain-text task document (encryption is applied by the caller via to_storage)."""
    doc = {
        "title": task.title,
        "description": task.description,
        "category": task.category,
        "status": "pending",
        "user_id": user_id,
        "schedule_type": task.schedule_type,
        "time_of_day": task.time_of_day,
        "weekdays": task.weekdays,
        "ends_on": task.ends_on,
        "completed_count": 0,
        "created_at": now_utc(),
    }
    if task.client_id:
        doc["client_id"] = task.client_id
    if task.schedule_type in RECURRING_TYPES:
        first = next_occurrence(task.schedule_type, task.time_of_day, task.weekdays, now_utc(), task.ends_on)
        if first is None:
            raise HTTPException(status_code=422, detail="That schedule has no upcoming occurrence. Check the end date.")
        doc["due_date"] = first
    else:
        doc["due_date"] = to_utc(task.due_date)  # a datetime with no timezone is treated as IST
    return doc


# --- API Routes ---
@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def add_task(task: TaskCreate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    user_id = str(current_user["_id"])

    # 0. Idempotency: the offline client retries a create until it gets an answer. If this
    #    client_id was already saved (the response was lost on the way back), return that task.
    if task.client_id:
        existing = await db["tasks"].find_one({"user_id": user_id, "client_id": task.client_id})
        if existing:
            return to_response(existing)

    # 1. Content moderation BEFORE anything is stored
    enforce(task.title, task.description, task.category)

    # 2. Build the plain document, encrypt the private fields, insert ciphertext only
    plain = build_task_document(task, user_id)
    stored = to_storage(user_id, plain)
    result = await db["tasks"].insert_one(stored)

    stored["_id"] = result.inserted_id
    return to_response(stored)


@router.get("/", response_model=List[TaskResponse])
async def get_tasks(current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    # Only the logged-in user's reminders, decrypted in memory for them alone
    cursor = db["tasks"].find({"user_id": str(current_user["_id"])})
    tasks = await cursor.to_list(length=1000)
    return [to_response(t) for t in tasks]


@router.put("/{task_id}", response_model=TaskResponse)
async def edit_task(task_id: str, payload: TaskUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    """Edit a reminder's text / time. (Completing a reminder still goes through PATCH.)"""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    user_id = str(current_user["_id"])
    query = {"_id": ObjectId(task_id), "user_id": user_id}
    task = await db["tasks"].find_one(query)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    changes = payload.model_dump(exclude_unset=True)
    enforce(changes.get("title"), changes.get("description"), changes.get("category"))

    plain = {k: changes[k] for k in ("title", "description", "category") if k in changes}
    stype = task.get("schedule_type", "once")

    if stype == "once":
        if changes.get("due_date") is not None:
            plain["due_date"] = to_utc(changes["due_date"])
    elif changes.get("time_of_day"):
        try:
            t = parse_time_of_day(changes["time_of_day"])
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        tod = f"{t.hour:02d}:{t.minute:02d}"
        nxt = next_occurrence(stype, tod, task.get("weekdays"), now_utc(), task.get("ends_on"))
        if nxt is None:
            raise HTTPException(status_code=422, detail="That schedule has no upcoming occurrence. Check the end date.")
        plain["time_of_day"] = tod
        plain["due_date"] = nxt

    if plain:
        update = {"$set": to_storage(user_id, plain)}
        if "due_date" in plain:
            # A new time means the reminder must be announced again.
            update["$unset"] = {flag: "" for flag in NOTIFICATION_FLAGS if flag in task}
            if not update["$unset"]:
                del update["$unset"]
        await db["tasks"].update_one(query, update)

    fresh = await db["tasks"].find_one(query)
    return to_response(fresh)


@router.patch("/{task_id}")
async def update_task_status(task_id: str, payload: TaskStatusUpdate, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    query = {"_id": ObjectId(task_id), "user_id": str(current_user["_id"])}
    task = await db["tasks"].find_one(query)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    # Completing a daily / weekly reminder finishes only THIS occurrence: it rolls to the next one.
    if payload.status == "completed" and task.get("schedule_type", "once") in RECURRING_TYPES:
        change = advance_after_completion(task, now_utc())
        update = {"$set": change["set"], "$inc": change["inc"]}
        if change["unset"]:
            update["$unset"] = change["unset"]
        await db["tasks"].update_one(query, update)
        return {
            "message": "Done for now. Next one is scheduled." if change["next_due"] else "Series finished.",
            "recurring": True,
            "next_due": change["next_due"],
        }

    result = await db["tasks"].update_one(query, {"$set": {"status": payload.status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"message": "Task updated successfully", "recurring": False}


@router.delete("/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user), db=Depends(get_db)):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")

    result = await db["tasks"].delete_one({"_id": ObjectId(task_id), "user_id": str(current_user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found or you are not authorized to delete it")

    return {"message": "Task deleted successfully"}
