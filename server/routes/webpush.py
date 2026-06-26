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
    # Save or update the push_subscription inside the user's document
    await db["users"].update_one(
        {"_id": payload.userId}, # Or whatever your user ID field is
        {"$set": {"push_subscription": payload.subscription}},
        upsert=True
    )
    return {"message": "Subscription saved to database."}