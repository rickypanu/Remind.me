import os
import json
import asyncio
from datetime import datetime, timedelta
from dotenv import load_dotenv

from pywebpush import webpush, WebPushException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from bson import ObjectId

from database import db
from .reminder_rules import REMINDER_OFFSETS, reminder_flag, reminder_window, minutes_left
from .notification_messages import get_short_reminder_copy
from utils.timezone import IST, now_utc, now_ist, ist_day_bounds_utc

# Load environment variables
load_dotenv()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_EMAIL = os.getenv("VAPID_EMAIL")

if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
    raise ValueError("Missing VAPID keys in environment variables!")

# Ensure the sub claim is formatted correctly
VAPID_CLAIMS = {"sub": f"mailto:{VAPID_EMAIL}" if not VAPID_EMAIL.startswith("mailto:") else VAPID_EMAIL}

def to_mongo_id(val: str):
    """Safely converts string to ObjectId if applicable."""
    return ObjectId(val) if ObjectId.is_valid(val) else val

async def send_push_async(user_id, subscription_info: dict, title: str, message: str):
    if not subscription_info:
        print(f"[DEBUG] send_push_async: No subscription info for user {user_id}. Aborting.", flush=True)
        return

    payload = json.dumps({"title": title, "body": message})

    def _sync_send():
        return webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )

    try:
        await asyncio.to_thread(_sync_send)
        print(f"[SUCCESS] WebPush notification sent to user {user_id}", flush=True)
    except WebPushException as e:
        status_code = getattr(e.response, "status_code", None)
        print(f"[ERROR] WebPush failed for user {user_id}. Status: {status_code}, Error: {e}", flush=True)
        
        if status_code in (404, 410):
            print(f"[CLEANUP] Removing dead WebPush subscription for user {user_id} (HTTP {status_code})", flush=True)
            # Use $pull to remove only this specific dead subscription from the array
            await db["users"].update_one(
                {"_id": to_mongo_id(str(user_id))},
                {"$pull": {"push_subscriptions": subscription_info}}
            )

async def remind_upcoming_tasks():
    """Sends the 1h / 10m / 1m push reminders. Runs every minute."""
    now = now_utc()

    for minutes in REMINDER_OFFSETS:
        flag = reminder_flag("web", minutes)
        start, end = reminder_window(now, minutes)

        query = {
            "due_date": {"$gt": start, "$lte": end},
            "status": {"$ne": "completed"},
            flag: {"$ne": True},
        }
        if minutes == 60:
            query["notified_due_soon_web"] = {"$ne": True}  # flag used before this update

        tasks = await db["tasks"].find(query).to_list(length=None)
        if tasks:
            print(f"[DEBUG - {now_ist().strftime('%H:%M:%S')} IST] {len(tasks)} task(s) due in ~{minutes} min (push)", flush=True)

        for task in tasks:
            task_id = task.get("_id")
            user_id_str = str(task.get("user_id"))
            task_title = task.get("title", "Untitled Task")

            # Atomic claim so the same reminder is never pushed twice
            claim = await db["tasks"].update_one(
                {"_id": task_id, flag: {"$ne": True}},
                {"$set": {flag: True}},
            )
            if claim.modified_count == 0:
                continue

            user = await db["users"].find_one({"_id": to_mongo_id(user_id_str)})
            if not (user and user.get("push_subscriptions")):
                print(f"[DEBUG] User {user_id_str} has no push subscriptions. Skipped.", flush=True)
                continue

            if minutes == 60:
                title = "Task Due Soon!"
                body = f"'{task_title}' is due in 1 hour."
            else:
                title, body = get_short_reminder_copy(
                    task_title, task.get("category", "Other"),
                    min(minutes, minutes_left(task["due_date"], now)),
                )

            # Loop through all devices the user is subscribed on
            for sub in user["push_subscriptions"]:
                await send_push_async(user["_id"], sub, title, body)


async def remind_todays_tasks():
    print(f"\n[DEBUG - {now_ist().strftime('%H:%M:%S')} IST] Running Today's Task Check...", flush=True)
    
    start_of_today, end_of_today = ist_day_bounds_utc(0)

    query = {
        "due_date": {"$gte": start_of_today, "$lt": end_of_today},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    
    user_tasks = {}
    for task in tasks:
        uid = task.get("user_id")
        if uid:
            user_tasks.setdefault(str(uid), []).append(task.get("title", "Untitled Task"))

    for user_id_str, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": to_mongo_id(user_id_str)})
        
        # Check for the new push_subscriptions array
        if user and user.get("push_subscriptions"):
            if len(task_titles) == 1:
                title = "Today's Task"
                body = f"Don't forget: {task_titles[0]}"
            else:
                title = f"{len(task_titles)} Tasks Today"
                body = f"You have {len(task_titles)} items scheduled, starting with: {task_titles[0]}"

            # Loop through all devices
            for sub in user["push_subscriptions"]:
                await send_push_async(user["_id"], sub, title, body)

async def remind_tomorrows_tasks():
    print(f"\n[DEBUG - {now_ist().strftime('%H:%M:%S')} IST] Running Tomorrow's Task Check...", flush=True)
    
    start_of_tomorrow, end_of_tomorrow = ist_day_bounds_utc(1)

    query = {
        "due_date": {"$gte": start_of_tomorrow, "$lt": end_of_tomorrow},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    
    user_tasks = {}
    for task in tasks:
        uid = task.get("user_id")
        if uid:
            user_tasks.setdefault(str(uid), []).append(task.get("title", "Untitled Task"))

    for user_id_str, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": to_mongo_id(user_id_str)})
        
        # Check for the new push_subscriptions array
        if user and user.get("push_subscriptions"):
            if len(task_titles) == 1:
                title = "Tomorrow's Agenda"
                body = f"Heads up for tomorrow: {task_titles[0]}"
            else:
                title = f"{len(task_titles)} Tasks Tomorrow"
                body = f"You have {len(task_titles)} tasks scheduled for tomorrow."

            # Loop through all devices
            for sub in user["push_subscriptions"]:
                await send_push_async(user["_id"], sub, title, body)

def start_scheduler_web():
    scheduler = AsyncIOScheduler(timezone=IST)
    
    scheduler.add_job(remind_upcoming_tasks, IntervalTrigger(minutes=1, timezone=IST), coalesce=True, max_instances=1, misfire_grace_time=120)
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,13,17,21", minute="0", timezone=IST))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="21,23", minute="0", timezone=IST))
    
    scheduler.start()
    print("\n[INFO] WebPush background task scheduler started (IST).", flush=True)
    
    # CRITICAL: Return the scheduler instance so main.py can shut it down
    return scheduler