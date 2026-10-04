import os
import json
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional
import pytz
from dotenv import load_dotenv

from pywebpush import webpush, WebPushException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from bson import ObjectId

from database import db
from utils.security import create_push_action_token

# Load environment variables
load_dotenv()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_EMAIL = os.getenv("VAPID_EMAIL")

if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
    raise ValueError("Missing VAPID keys in environment variables!")

# Ensure the sub claim is formatted correctly
VAPID_CLAIMS = {"sub": f"mailto:{VAPID_EMAIL}" if not VAPID_EMAIL.startswith("mailto:") else VAPID_EMAIL}
IST = pytz.timezone("Asia/Kolkata")

# Public URL of THIS backend (e.g. https://your-api.onrender.com). The service worker
# calls {PUBLIC_API_URL}/webpush/action when you tap "Mark done" / "Snooze".
# If it is not set, notifications are sent without action buttons.
PUBLIC_API_URL = os.getenv("PUBLIC_API_URL", "").rstrip("/")

def to_mongo_id(val: str):
    """Safely converts string to ObjectId if applicable."""
    return ObjectId(val) if ObjectId.is_valid(val) else val

async def send_push_async(user_id, subscription_info: dict, title: str, message: str, extra: Optional[dict] = None):
    if not subscription_info:
        print(f"[DEBUG] send_push_async: No subscription info for user {user_id}. Aborting.", flush=True)
        return

    payload = json.dumps({"title": title, "body": message, **(extra or {})})

    def _sync_send():
        return webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=dict(VAPID_CLAIMS),   # copy: pywebpush mutates this dict
            ttl=3600,                          # default is 0 = dropped if the phone is asleep
            headers={"Urgency": "high"},
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

async def send_task_reminder(task: dict, title: str, body: str):
    """Send a reminder for ONE task to every device of its owner,
    including the signed token that powers the Done / Snooze buttons."""
    user_id_str = str(task.get("user_id"))
    user = await db["users"].find_one({"_id": to_mongo_id(user_id_str)})

    if not user or not user.get("push_subscriptions"):
        print(f"[DEBUG] User {user_id_str} has no push subscriptions. Skipped.", flush=True)
        return

    task_id = str(task["_id"])
    extra = {
        "task_id": task_id,
        "task_title": task.get("title", "Untitled Task"),
        "url": "/dashboard",
    }
    if PUBLIC_API_URL:
        extra["action_token"] = create_push_action_token(task_id, user_id_str)
        extra["action_url"] = f"{PUBLIC_API_URL}/webpush/action"

    for sub in list(user["push_subscriptions"]):
        await send_push_async(user["_id"], sub, title, body, extra)

async def remind_upcoming_tasks():
    now = datetime.now(IST)
    print(f"\n[DEBUG - {now.strftime('%H:%M:%S')}] Running 1-Hour Upcoming Task Check...", flush=True)

    target_start = now + timedelta(minutes=59)
    target_end = now + timedelta(minutes=61)

    query = {
        "due_date": {"$gte": target_start, "$lt": target_end},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    print(f"[DEBUG] Found {len(tasks)} tasks due between {target_start.strftime('%H:%M:%S')} and {target_end.strftime('%H:%M:%S')}", flush=True)

    for task in tasks:
        task_title = task.get("title", "Untitled Task")
        print(f"[DEBUG] Sending reminder for task '{task_title}'", flush=True)
        await send_task_reminder(task, "Task Due Soon!", f"'{task_title}' is due in 1 hour.")

async def remind_snoozed_tasks():
    """Re-send reminders for tasks whose snooze time has arrived."""
    now = datetime.now(timezone.utc)

    tasks = await db["tasks"].find({
        "snoozed_until": {"$lte": now},
        "status": {"$ne": "completed"},
    }).to_list(length=None)

    for task in tasks:
        # Claim the task atomically so overlapping runs never send it twice
        claimed = await db["tasks"].update_one(
            {"_id": task["_id"], "snoozed_until": task["snoozed_until"]},
            {"$unset": {"snoozed_until": ""}},
        )
        if claimed.modified_count == 0:
            continue

        task_title = task.get("title", "Untitled Task")
        print(f"[DEBUG] Snooze finished, re-sending reminder for '{task_title}'", flush=True)
        await send_task_reminder(task, "Snoozed reminder", f"'{task_title}' is still waiting for you.")

async def remind_todays_tasks():
    now = datetime.now(IST)
    print(f"\n[DEBUG - {now.strftime('%H:%M:%S')}] Running Today's Task Check...", flush=True)
    
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today = start_of_today + timedelta(days=1)

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
    now = datetime.now(IST)
    print(f"\n[DEBUG - {now.strftime('%H:%M:%S')}] Running Tomorrow's Task Check...", flush=True)
    
    start_of_tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    end_of_tomorrow = start_of_tomorrow + timedelta(days=1)

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
    
    scheduler.add_job(remind_upcoming_tasks, IntervalTrigger(minutes=1, timezone=IST))
    scheduler.add_job(remind_snoozed_tasks, IntervalTrigger(minutes=1, timezone=IST))
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,13,18,19,20", minute="0,51,52,53,54,55,56,57,58,1,2,3,4,5,6,7,8,9,59", timezone=IST))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="20", minute="0", timezone=IST))
    
    scheduler.start()
    print("\n[INFO] WebPush background task scheduler started (IST).", flush=True)
    
    # CRITICAL: Return the scheduler instance so main.py can shut it down
    return scheduler