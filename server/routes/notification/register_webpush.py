from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from bson import ObjectId
from database import db
from utils.security import get_current_user

router = APIRouter(prefix="/webpush", tags=["WebPush"])

class SubscriptionPayload(BaseModel):
    subscription: dict
    userId: str | None = None  # ignored: the authenticated user from the token is always used

def to_mongo_id(val: str):
    return ObjectId(val) if ObjectId.is_valid(val) else val

@router.post("/subscribe")
async def subscribe(payload: SubscriptionPayload, current_user: dict = Depends(get_current_user)):
    # Requires a valid login, and only ever touches the CALLER's own record
    # (previously anyone could register a device on any user id).
    result = await db["users"].update_one(
        {"_id": to_mongo_id(str(current_user["_id"]))},
        {"$addToSet": {"push_subscriptions": payload.subscription}},
        upsert=True
    )
    if result.modified_count == 0 and result.upserted_id is None:
        return {"status": "info", "message": "Subscription already exists."}
    return {"status": "success", "message": "Subscription registered."}

@router.delete("/unsubscribe/{user_id}")
async def unsubscribe(user_id: str, payload: SubscriptionPayload = None, current_user: dict = Depends(get_current_user)):
    user_id = str(current_user["_id"])  # a user can only remove their own devices
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