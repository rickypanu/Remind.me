import os
import httpx

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

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