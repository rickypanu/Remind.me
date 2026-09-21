import asyncio
import os
from collections import defaultdict
from datetime import datetime, timedelta
import pytz
import httpx
from dotenv import load_dotenv

# MUST BE CALLED BEFORE OS.GETENV
load_dotenv()

from fastapi import APIRouter
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import db
from .notification_messages import (
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
    print(f"--> [DEBUG] Attempting to send to chat_id: {chat_id}")
    
    if not TELEGRAM_BOT_TOKEN:
        print("--> [ERROR] TELEGRAM_BOT_TOKEN is missing!")
        return
    if not chat_id:
        print("--> [ERROR] chat_id is missing!")
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
                print(f"--> [TELEGRAM API ERROR]: {res.text}")
            else:
                print("--> [SUCCESS] Message sent to Telegram!")
        except Exception as e:
            print(f"--> [REQUEST EXCEPTION]: {e}")


async def dispatch_notifications(user: dict, title: str, body: str):
    """Dispatches notifications exclusively via Telegram."""
    telegram_chat_id = user.get("telegram_chat_id")
    print(f"--> [DEBUG] Found user: {user.get('_id')}, Telegram ID: {telegram_chat_id}")
    if telegram_chat_id:
        await send_telegram(telegram_chat_id, title, body)
    else:
        print("--> [DEBUG] Skipping user - No telegram_chat_id found in database.")


# ---------------------------------------------------------
# ATOMIC SCHEDULER TASKS
# ---------------------------------------------------------

async def remind_upcoming_tasks():
    print("--> [DEBUG] Cron Job 'remind_upcoming_tasks' triggered.")
    now_utc = datetime.now(pytz.utc)
    target_start = now_utc + timedelta(minutes=55)
    target_end = now_utc + timedelta(minutes=65)

    query = {
        "due_date": {"$gte": target_start, "$lt": target_end},
        "status": {"$ne": "completed"},
        "notified_due_soon": {"$ne": True}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    print(f"--> [DEBUG] Found {len(tasks)} tasks due soon.")

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
                title, body = await get_due_soon_copy(
                    task_title=task.get("title", "Untitled Task"),
                    category=task.get("category", "Other")
                )
                await dispatch_notifications(user, title, body)


async def remind_todays_tasks():
    print("--> [DEBUG] Cron Job 'remind_todays_tasks' triggered.")
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
            title, body = await get_today_digest_copy(task_list, now_ist.hour)
            await dispatch_notifications(user, title, body)


async def remind_tomorrows_tasks():
    print("--> [DEBUG] Cron Job 'remind_tomorrows_tasks' triggered.")
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
            title, body = await get_tomorrow_digest_copy(task_list)
            await dispatch_notifications(user, title, body)


# ---------------------------------------------------------
# SINGLE SCHEDULER INITIALIZATION
# ---------------------------------------------------------

# Change the function to be a standard setup function

def start_scheduler():
    print("--> [DEBUG] App Startup triggered. Initializing Scheduler...")
    scheduler = AsyncIOScheduler(timezone=IST)

    scheduler.add_job(remind_upcoming_tasks, CronTrigger(minute="*"))
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,12,14,18,20", minute="0,53,54,56,54,55,57,52"))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="21", minute="0"))

    scheduler.start()
    print("--> [DEBUG] Telegram notification background scheduler active.")
    
    return scheduler # Return it so it can be shut down gracefully later