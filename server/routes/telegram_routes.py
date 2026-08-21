from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from database import db
import os
import httpx

router = APIRouter()

BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

class TelegramPayload(BaseModel):
    userId: str

@router.get("/telegram/status/{user_id}")
async def check_telegram_status(user_id: str):
    """Checks if user has connected Telegram."""
    user = await db["users"].find_one({"_id": user_id})
    if not user:
        return {"connected": False, "phone_number": None}
        
    is_connected = bool(user.get("telegram_chat_id"))
    phone_number = user.get("phone_number")
    
    return {
        "connected": is_connected,
        "phone_number": phone_number
    }

@router.post("/telegram/get-link")
async def get_telegram_link(payload: TelegramPayload):
    """Generates Telegram start link."""
    if not BOT_USERNAME:
        raise HTTPException(status_code=500, detail="TELEGRAM_BOT_USERNAME is not configured.")
    return {"telegram_url": f"https://t.me/{BOT_USERNAME}?start={payload.userId}"}

@router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    """Handles Telegram Webhook updates."""
    data = await request.json()
    
    if "message" in data:
        message = data["message"]
        chat_id = str(message["chat"]["id"])
        text = message.get("text", "")

        # 1. /start command execution
        if text.startswith("/start"):
            parts = text.split(" ")
            if len(parts) > 1:
                user_id = parts[1]

                await db["users"].update_one(
                    {"_id": user_id},
                    {"$set": {"telegram_chat_id": chat_id}},
                    upsert=True
                )

                payload = {
                    "chat_id": chat_id,
                    "text": (
                        "*Account Linked Successfully!*\n\n"
                        "To ensure you receive SMS notifications, *sharing your phone number is strongly recommended*.\n\n"
                        "Please tap the button below to complete your profile verification."
                    ),
                    "parse_mode": "Markdown",
                    "reply_markup": {
                        "keyboard": [[{
                            "text": "📱 Share Phone Number (Recommended)",
                            "request_contact": True
                        }]],
                        "resize_keyboard": True,
                        "one_time_keyboard": True
                    }
                }
                if TELEGRAM_BOT_TOKEN:
                    async with httpx.AsyncClient() as client:
                        await client.post(
                            f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                            json=payload
                        )

        # 2. Contact shared
        elif "contact" in message:
            phone_number = message["contact"]["phone_number"]

            await db["users"].update_one(
                {"telegram_chat_id": chat_id},
                {"$set": {"phone_number": phone_number}}
            )

            payload = {
                "chat_id": chat_id,
                "text": (
                    "🎉 *Verification Complete!*\n\n"
                    f"Your phone number (`{phone_number}`) has been securely verified and saved.\n"
                    "You will now receive notifications directly."
                ),
                "parse_mode": "Markdown",
                "reply_markup": {"remove_keyboard": True}
            }
            if TELEGRAM_BOT_TOKEN:
                async with httpx.AsyncClient() as client:
                    await client.post(
                        f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage",
                        json=payload
                    )

    return {"status": "ok"}

@router.post("/telegram/disconnect")
async def disconnect_telegram(payload: TelegramPayload):
    """Disconnects Telegram account from user profile."""
    await db["users"].update_one(
        {"_id": payload.userId},
        {"$unset": {"telegram_chat_id": "", "phone_number": ""}}
    )
    return {"message": "Telegram account disconnected successfully."}