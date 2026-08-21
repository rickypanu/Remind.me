from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import db 
from bson import ObjectId

router = APIRouter()

class SubscriptionPayload(BaseModel):
    subscription: dict
    userId: str

def get_user_filter(user_id: str):
    """Safely convert string userId to ObjectId or string filter"""
    try:
        return {"_id": ObjectId(user_id)}
    except Exception:
        # Agar aapki DB me IDs pure string me store hain (e.g. custom string IDs)
        return {"_id": user_id}

@router.post("/subscribe")
async def subscribe(payload: SubscriptionPayload):
    user_filter = get_user_filter(payload.userId)
    
    # 1. Pehle check karein ki user exist karta hai ya nahi
    user = await db["users"].find_one(user_filter)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. upsert=True HATA DIYA hai taaki naya document na bane.
    # $addToSet ki jagah $pull + $push use kar rahe hain taaki duplicate endpoint update ho sake.
    
    # Pehle agar same endpoint already exist karta hai toh use remove karein
    await db["users"].update_one(
        user_filter,
        {"$pull": {"push_subscriptions": {"endpoint": payload.subscription["endpoint"]}}}
    )

    # Ab fresh subscription push karein
    await db["users"].update_one(
        user_filter, 
        {"$push": {"push_subscriptions": payload.subscription}}
    )
    
    return {"message": "Subscription updated successfully in existing user."}

@router.post("/unsubscribe")
async def unsubscribe(payload: SubscriptionPayload):
    user_filter = get_user_filter(payload.userId)
    
    # Specific endpoint ko user ke push_subscriptions array se remove karein
    result = await db["users"].update_one(
        user_filter,
        {"$pull": {"push_subscriptions": {"endpoint": payload.subscription.get("endpoint")}}}
    )
    
    return {"message": "Unsubscribed successfully."}