import os
import httpx
from fastapi import APIRouter, HTTPException, Request
from database import db
from schemas.notification import TelegramPayload

router = APIRouter()

BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

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
                        "To ensure you receive notifications, *sharing your phone number is strongly recommended*.\n\n"
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

async def send_telegram_notification(chat_id: str, title: str, body: str):
    """Sends formatted HTML notification directly to a Telegram Chat ID."""
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    formatted_message = f"<b>{title}</b>\n{body}"
    
    payload = {
        "chat_id": chat_id,
        "text": formatted_message,
        "parse_mode": "HTML"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                print(f"Telegram Notification API Error: {response.text}")
        except Exception as e:
            print(f"Failed to send Telegram message: {e}")