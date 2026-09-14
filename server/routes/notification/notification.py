import asyncio
import os
from collections import defaultdict
from datetime import datetime, timedelta
import pytz
import httpx

from fastapi import APIRouter
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import db

from .notification_messages  import (
    get_due_soon_copy,
    get_today_digest_copy,
    get_tomorrow_digest_copy,
)

router = APIRouter()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
IST = pytz.timezone('Asia/Kolkata')


# ---------------------------------------------------------
# DISPATCH HELPERS
# ---------------------------------------------------------

async def send_telegram(chat_id: str, title: str, body: str):
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": f"<b>{title}</b>\n{body}",
        "parse_mode": "HTML"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload)
            if res.status_code != 200:
                print(f"Telegram API Error: {res.text}")
        except Exception as e:
            print(f"Telegram Request Exception: {e}")


async def dispatch_notifications(user: dict, title: str, body: str):
    """Dispatches notifications exclusively via Telegram."""
    telegram_chat_id = user.get("telegram_chat_id")
    if telegram_chat_id:
        await send_telegram(telegram_chat_id, title, body)


# ---------------------------------------------------------
# ATOMIC SCHEDULER TASKS
# ---------------------------------------------------------

async def remind_upcoming_tasks():
    now_utc = datetime.now(pytz.utc)
    target_start = now_utc + timedelta(minutes=55)
    target_end = now_utc + timedelta(minutes=65)

    query = {
        "due_date": {"$gte": target_start, "$lt": target_end},
        "status": {"$ne": "completed"},
        "notified_due_soon": {"$ne": True}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)

    for task in tasks:
        # ATOMIC LOCK: Claim/Lock the task in MongoDB FIRST before dispatching
        result = await db["tasks"].update_one(
            {"_id": task["_id"], "notified_due_soon": {"$ne": True}},
            {"$set": {"notified_due_soon": True, "last_notified_at": now_utc}}
        )

        # Dispatch ONLY if this execution successfully modified the database document
        if result.modified_count > 0:
            user = await db["users"].find_one({"_id": task.get("user_id")})
            if user:
                title, body = get_due_soon_copy(
                    task_title=task.get("title", "Untitled Task"),
                    category=task.get("category", "Other")
                )
                await dispatch_notifications(user, title, body)


async def remind_todays_tasks():
    now_ist = datetime.now(IST)
    now_utc = datetime.now(pytz.utc)
    
    start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today_ist = start_of_today_ist + timedelta(days=1)

    start_utc = start_of_today_ist.astimezone(pytz.utc)
    end_utc = end_of_today_ist.astimezone(pytz.utc)
    cooldown = now_utc - timedelta(minutes=45)

    query = {
        "due_date": {"$gte": start_utc, "$lt": end_utc},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    user_tasks = defaultdict(list)
    tasks_to_update = []

    for task in tasks:
        last_notified = task.get("last_notified_at")
        if last_notified and last_notified.tzinfo is None:
            last_notified = pytz.utc.localize(last_notified)

        # Suppress digest if task had an urgent 1-hour warning within the last 45 mins
        if last_notified and last_notified > cooldown:
            continue

        user_tasks[task.get("user_id")].append({
            "title": task.get("title", "Untitled Task"),
            "category": task.get("category", "Other")
        })
        tasks_to_update.append(task["_id"])

    # Update notification state prior to dispatching messages
    if tasks_to_update:
        await db["tasks"].update_many(
            {"_id": {"$in": tasks_to_update}},
            {"$set": {"last_notified_at": now_utc}}
        )

    for user_id, task_list in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title, body = get_today_digest_copy(task_list, now_ist.hour)
            await dispatch_notifications(user, title, body)


async def remind_tomorrows_tasks():
    now_ist = datetime.now(IST)
    now_utc = datetime.now(pytz.utc)
    
    start_of_tomorrow_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    end_of_tomorrow_ist = start_of_tomorrow_ist + timedelta(days=1)

    start_utc = start_of_tomorrow_ist.astimezone(pytz.utc)
    end_utc = end_of_tomorrow_ist.astimezone(pytz.utc)

    query = {
        "due_date": {"$gte": start_utc, "$lt": end_utc},
        "status": {"$ne": "completed"},
        "notified_tomorrow_digest": {"$ne": True}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    user_tasks = defaultdict(list)
    tasks_to_update = []

    for task in tasks:
        user_tasks[task.get("user_id")].append({
            "title": task.get("title", "Untitled Task"),
            "category": task.get("category", "Other")
        })
        tasks_to_update.append(task["_id"])

    if tasks_to_update:
        await db["tasks"].update_many(
            {"_id": {"$in": tasks_to_update}},
            {"$set": {"notified_tomorrow_digest": True, "last_notified_at": now_utc}}
        )

    for user_id, task_list in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title, body = get_tomorrow_digest_copy(task_list)
            await dispatch_notifications(user, title, body)


# ---------------------------------------------------------
# SINGLE SCHEDULER INITIALIZATION
# ---------------------------------------------------------

@router.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler(timezone=IST)

    scheduler.add_job(remind_upcoming_tasks, CronTrigger(minute="*"))
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,14,18,20", minute="0,8,10,11,12,13,14,15,16,17,18"))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="21", minute="0"))

    scheduler.start()
    print("Telegram notification background scheduler active.")