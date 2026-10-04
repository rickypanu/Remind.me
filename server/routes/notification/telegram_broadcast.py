import os
import asyncio
import httpx
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from pydantic import BaseModel
from database import db

router = APIRouter()

ADMIN_SECRET = os.getenv("ADMIN_SECRET")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")


class BroadcastIn(BaseModel):
    title: str
    body: str


async def send_telegram(chat_id: str, title: str, body: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": f"<b>{title}</b>\n{body}", "parse_mode": "HTML"}

    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload)
            if res.status_code == 429:
                wait = res.json().get("parameters", {}).get("retry_after", 1)
                await asyncio.sleep(wait)
                res = await client.post(url, json=payload)
            return res.status_code == 200
        except Exception as e:
            print(f"--> [TELE REQUEST EXCEPTION]: {e}")
            return False


async def broadcast_to_all(title: str, body: str, report_chat_id: str | None = None):
    sent = failed = 0
    query = {"telegram_chat_id": {"$exists": True, "$nin": [None, ""]}}

    async for user in db["users"].find(query):
        ok = await send_telegram(user["telegram_chat_id"], title, body)
        if ok:
            sent += 1
        else:
            failed += 1
        await asyncio.sleep(0.05)

    print(f"--> [BROADCAST] sent={sent} failed={failed}")

    if report_chat_id:
        await send_telegram(report_chat_id, "Broadcast done", f"Sent: {sent}\nFailed: {failed}")


@router.post("/admin/broadcast")
async def broadcast(data: BroadcastIn, bg: BackgroundTasks, x_admin_key: str | None = Header(None)):
    if not ADMIN_SECRET or x_admin_key != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    bg.add_task(broadcast_to_all, data.title, data.body)
    return {"status": "broadcast started"}