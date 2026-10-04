from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from bson import ObjectId
from database import db
from utils.security import decode_push_action_token

router = APIRouter(prefix="/webpush", tags=["WebPush"])

class SubscriptionPayload(BaseModel):
    subscription: dict
    userId: str

def to_mongo_id(val: str):
    return ObjectId(val) if ObjectId.is_valid(val) else val

@router.post("/subscribe")
async def subscribe(payload: SubscriptionPayload):
    # Use $addToSet to add unique subscriptions to an array. 
    # 'push_subscriptions' is now an array instead of a single object.
    result = await db["users"].update_one(
        {"_id": to_mongo_id(payload.userId)},
        {"$addToSet": {"push_subscriptions": payload.subscription}},
        upsert=True
    )
    if result.modified_count == 0 and result.upserted_id is None:
        return {"status": "info", "message": "Subscription already exists."}
    return {"status": "success", "message": "Subscription registered."}

@router.delete("/unsubscribe/{user_id}")
async def unsubscribe(user_id: str, payload: SubscriptionPayload = None):
    # DHYAN DEIN: Agar array use kar rahe hain, toh sirf 'push_subscriptions' 
    # field ko delete karne se sabhi devices ke notification band ho jayenge.
    # Agar sirf current device ko hatana hai, toh frontend se 
    # current device ki subscription bhejni hogi aur $pull use karna hoga.
    
    # Ye block current device ko remove karne ke liye hai (agar payload bheja jaye)
    if payload and payload.subscription:
        result = await db["users"].update_one(
            {"_id": to_mongo_id(user_id)},
            {"$pull": {"push_subscriptions": payload.subscription}}
        )
    else:
        # Ye block saare devices ki subscriptions delete kar dega
        result = await db["users"].update_one(
            {"_id": to_mongo_id(user_id)},
            {"$unset": {"push_subscriptions": ""}} 
        )

    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User or subscription not found.")
    return {"status": "success", "message": "Subscription removed successfully."}


# ---------------------------------------------------------------------------
# Notification action buttons: "Mark done" / "Snooze"
# Called by the service worker (push-sw.js), authenticated by the signed token
# that was embedded in the push payload.
# ---------------------------------------------------------------------------
class PushActionPayload(BaseModel):
    token: str
    action: Literal["done", "snooze"]
    minutes: int = Field(10, ge=1, le=1440)   # only used for "snooze"

@router.post("/action")
async def handle_push_action(payload: PushActionPayload):
    data = decode_push_action_token(payload.token)

    if not ObjectId.is_valid(data.get("task_id", "")):
        raise HTTPException(status_code=400, detail="Invalid task id")

    # NOTE: tasks store user_id as a string (see routes/tasks/task.py)
    task_filter = {"_id": ObjectId(data["task_id"]), "user_id": data["uid"]}

    if payload.action == "done":
        update = {"$set": {"status": "completed"}, "$unset": {"snoozed_until": ""}}
    else:
        snoozed_until = datetime.now(timezone.utc) + timedelta(minutes=payload.minutes)
        update = {"$set": {"snoozed_until": snoozed_until}}

    result = await db["tasks"].update_one(task_filter, update)
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"status": "success", "action": payload.action}