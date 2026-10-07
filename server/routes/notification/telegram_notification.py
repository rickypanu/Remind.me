import asyncio
import os
from collections import defaultdict
from datetime import datetime, timedelta
import httpx
from dotenv import load_dotenv

# MUST BE CALLED BEFORE OS.GETENV
load_dotenv()

from fastapi import APIRouter
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import db
from utils.timezone import IST, UTC, now_utc, now_ist, as_utc, ist_day_bounds_utc
from .reminder_rules import REMINDER_OFFSETS, reminder_flag, reminder_window, minutes_left
from .notification_messages import (
    get_due_soon_copy,
    get_short_reminder_copy,
    get_today_digest_copy,
    get_tomorrow_digest_copy,
)

router = APIRouter()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")


# ---------------------------------------------------------
# DISPATCH HELPERS
# ---------------------------------------------------------
async def send_telegram(chat_id: str, title: str, body: str) -> bool:
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": chat_id, "text": f"<b>{title}</b>\n{body}", "parse_mode": "HTML"}

    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(url, json=payload)
            if res.status_code == 429:  # rate limited
                wait = res.json().get("parameters", {}).get("retry_after", 1)
                await asyncio.sleep(wait)
                res = await client.post(url, json=payload)
            return res.status_code == 200
        except Exception as e:
            print(f"--> [TELE REQUEST EXCEPTION]: {e}")
            return False


async def dispatch_notifications(user: dict, title: str, body: str):
    """Dispatches notifications exclusively via Telegram."""
    telegram_chat_id = user.get("telegram_chat_id")
    print(f"--> [TELE DEBUG] Found user: {user.get('_id')}, Telegram ID: {telegram_chat_id}")
    if telegram_chat_id:
        await send_telegram(telegram_chat_id, title, body)
    else:
        print("--> [TELE DEBUG] Skipping user - No telegram_chat_id found in database.")


# ---------------------------------------------------------
# ATOMIC SCHEDULER TASKS
# ---------------------------------------------------------

async def remind_upcoming_tasks():
    """Sends the 1h / 10m / 1m reminders. Runs every minute."""
    now = now_utc()

    for minutes in REMINDER_OFFSETS:
        flag = reminder_flag("tele", minutes)
        start, end = reminder_window(now, minutes)

        query = {
            "due_date": {"$gt": start, "$lte": end},
            "status": {"$ne": "completed"},
            flag: {"$ne": True},
        }
        if minutes == 60:
            query["notified_due_soon"] = {"$ne": True}  # flag used before this update

        tasks = await db["tasks"].find(query).to_list(length=None)
        if tasks:
            print(f"--> [TELE DEBUG] {len(tasks)} task(s) due in ~{minutes} min.")

        for task in tasks:
            set_fields = {flag: True}
            if minutes == 60:
                # Only the 1-hour reminder feeds the digest cooldown (point: 10m/1m must not hide tasks from digests)
                set_fields.update({"notified_due_soon": True, "last_notified_at": now})

            # ATOMIC LOCK: claim the reminder in MongoDB FIRST, send only if we won the claim
            result = await db["tasks"].update_one(
                {"_id": task["_id"], flag: {"$ne": True}},
                {"$set": set_fields},
            )
            if result.modified_count == 0:
                continue

            user = await db["users"].find_one({"_id": task.get("user_id")})
            if not user:
                continue

            task_title = task.get("title", "Untitled Task")
            category = task.get("category", "Other")
            if minutes == 60:
                title, body = await get_due_soon_copy(task_title=task_title, category=category)
            else:
                title, body = get_short_reminder_copy(
                    task_title, category, min(minutes, minutes_left(task["due_date"], now)), html=True
                )
            await dispatch_notifications(user, title, body)


async def remind_todays_tasks():
    print("--> [DEBUG] Cron Job 'remind_todays_tasks' triggered.")
    now_local = now_ist()
    now = now_utc()

    start_utc, end_utc = ist_day_bounds_utc(0)   # today in IST, as UTC
    cooldown = now - timedelta(minutes=45)

    query = {
        "due_date": {"$gte": start_utc, "$lt": end_utc},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    user_tasks = defaultdict(list)
    tasks_to_update = []

    for task in tasks:
        last_notified = task.get("last_notified_at")
        if last_notified:
            last_notified = as_utc(last_notified)

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
            {"$set": {"last_notified_at": now}}
        )

    for user_id, task_list in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title, body = await get_today_digest_copy(task_list, now_local.hour)
            await dispatch_notifications(user, title, body)


async def remind_tomorrows_tasks():
    print("--> [TELE DEBUG] Cron Job 'remind_tomorrows_tasks' triggered.")
    now = now_utc()
    start_utc, end_utc = ist_day_bounds_utc(1)   # tomorrow in IST, as UTC

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
            {"$set": {"notified_tomorrow_digest": True, "last_notified_at": now}}
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

def start_scheduler_tele():
    print("--> [DEBUG] App Startup triggered. Initializing Scheduler...")
    scheduler = AsyncIOScheduler(timezone=IST)

    scheduler.add_job(remind_upcoming_tasks, CronTrigger(minute="*"), coalesce=True, max_instances=1, misfire_grace_time=120)
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,17,21,23", minute="0"))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="21", minute="0"))

    scheduler.start()
    print("--> [TELE DEBUG] Telegram notification background scheduler active.")
    
    return scheduler # Return it so it can be shut down gracefully later