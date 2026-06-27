# webpush.py
from fastapi import APIRouter
from pydantic import BaseModel
from database import db 
router = APIRouter()

class SubscriptionPayload(BaseModel):
    subscription: dict
    userId: str

@router.post("/subscribe")
async def subscribe(payload: SubscriptionPayload):
    # Use $addToSet instead of $set to store multiple devices
    await db["users"].update_one(
        {"_id": payload.userId}, 
        {"$addToSet": {"push_subscriptions": payload.subscription}}, 
        upsert=True
    )
    return {"message": "Subscription saved to database."}

@router.post("/unsubscribe")
async def unsubscribe(payload: SubscriptionPayload):
    # Use $pull to remove the specific subscription matching the endpoint
    await db["users"].update_one(
        {"_id": payload.userId},
        {"$pull": {"push_subscriptions": {"endpoint": payload.subscription["endpoint"]}}}
    )
    return {"message": "Unsubscribed successfully."}