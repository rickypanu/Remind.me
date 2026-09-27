from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from database import db 

router = APIRouter(prefix="/webpush", tags=["WebPush"])

class SubscriptionPayload(BaseModel):
    subscription: dict
    userId: str

def to_mongo_id(val: str):
    return ObjectId(val) if ObjectId.is_valid(val) else val

@router.post("/subscribe")
async def subscribe(payload: SubscriptionPayload):
    # Upsert the subscription info into the user's document
    result = await db["users"].update_one(
        {"_id": to_mongo_id(payload.userId)},
        {"$set": {"push_subscription": payload.subscription}},
        upsert=True
    )
    if result.modified_count == 0 and result.upserted_id is None:
        return {"status": "info", "message": "Subscription already up to date."}
    return {"status": "success", "message": "Subscription registered."}

@router.delete("/unsubscribe/{user_id}")
async def unsubscribe(user_id: str):
    # Remove the push_subscription field entirely from the user document
    result = await db["users"].update_one(
        {"_id": to_mongo_id(user_id)},
        {"$unset": {"push_subscription": ""}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User or subscription not found.")
    return {"status": "success", "message": "Subscription removed successfully."}