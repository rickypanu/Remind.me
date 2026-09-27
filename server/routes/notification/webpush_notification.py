import os
import json
import asyncio
from datetime import datetime, timedelta
import pytz
from dotenv import load_dotenv

from pywebpush import webpush, WebPushException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from bson import ObjectId

from database import db

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

def to_mongo_id(val: str):
    """Safely converts string to ObjectId if applicable."""
    return ObjectId(val) if ObjectId.is_valid(val) else val

async def send_push_async(user_id, subscription_info: dict, title: str, message: str):
    """
    Sends a web push notification asynchronously.
    If the subscription is dead (404/410), it removes it from the database.
    """
    if not subscription_info:
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
        # Run blocking network call in a separate thread so FastAPI doesn't freeze
        await asyncio.to_thread(_sync_send)
        print(f"Push notification sent successfully to user {user_id}")
    except WebPushException as e:
        status_code = getattr(e.response, "status_code", None)
        print(f"WebPush failed for user {user_id}: {e}")
        
        # Clean up expired, unsubscribed, or invalidated browser subscriptions
        if status_code in (404, 410):
            print(f"Cleaning dead subscription for user {user_id} (HTTP {status_code})")
            await db["users"].update_one(
                {"_id": to_mongo_id(str(user_id))},
                {"$unset": {"push_subscription": ""}}
            )

async def remind_upcoming_tasks():
    """Checks every minute for tasks due exactly one hour from now."""
    now = datetime.now(IST)
    
    # Define a 1-minute window exactly 1 hour in the future
    target_start = now + timedelta(minutes=59)
    target_end = now + timedelta(minutes=60)

    query = {
        "due_date": {"$gte": target_start, "$lt": target_end},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)

    for task in tasks:
        user_id_str = str(task.get("user_id"))
        task_title = task.get("title", "Untitled Task")
        
        user = await db["users"].find_one({"_id": to_mongo_id(user_id_str)})
        
        if user and user.get("push_subscription"):
            title = "Task Due Soon!"
            body = f"'{task_title}' is due in 1 hour."
            
            await send_push_async(user["_id"], user["push_subscription"], title, body)

async def remind_todays_tasks():
    """Fetches incomplete tasks due today and sends a summary notification."""
    print("Running Today's Task Check...")
    now = datetime.now(IST)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today = start_of_today + timedelta(days=1)

    query = {
        "due_date": {"$gte": start_of_today, "$lt": end_of_today},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)

    # Group tasks by user_id
    user_tasks = {}
    for task in tasks:
        uid = task.get("user_id")
        if uid:
            user_tasks.setdefault(str(uid), []).append(task.get("title", "Untitled Task"))

    # Send one consolidated notification per user
    for user_id_str, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": to_mongo_id(user_id_str)})
        if user and user.get("push_subscription"):
            if len(task_titles) == 1:
                title = "Today's Task"
                body = f"Don't forget: {task_titles[0]}"
            else:
                title = f"{len(task_titles)} Tasks Today"
                body = f"You have {len(task_titles)} items scheduled, starting with: {task_titles[0]}"

            await send_push_async(user["_id"], user["push_subscription"], title, body)

async def remind_tomorrows_tasks():
    """Fetches incomplete tasks due tomorrow and sends a summary notification."""
    print("Running Tomorrow's Task Check...")
    now = datetime.now(IST)
    start_of_tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    end_of_tomorrow = start_of_tomorrow + timedelta(days=1)

    query = {
        "due_date": {"$gte": start_of_tomorrow, "$lt": end_of_tomorrow},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)

    # Group tasks by user_id
    user_tasks = {}
    for task in tasks:
        uid = task.get("user_id")
        if uid:
            user_tasks.setdefault(str(uid), []).append(task.get("title", "Untitled Task"))

    # Send one consolidated notification per user
    for user_id_str, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": to_mongo_id(user_id_str)})
        if user and user.get("push_subscription"):
            if len(task_titles) == 1:
                title = "Tomorrow's Agenda"
                body = f"Heads up for tomorrow: {task_titles[0]}"
            else:
                title = f"{len(task_titles)} Tasks Tomorrow"
                body = f"You have {len(task_titles)} tasks scheduled for tomorrow."

            await send_push_async(user["_id"], user["push_subscription"], title, body)

def start_scheduler():
    """Initializes and starts the background task scheduler."""
    scheduler = AsyncIOScheduler(timezone=IST)
    
    # Run exact 1-hour prior check every 1 minute
    scheduler.add_job(remind_upcoming_tasks, IntervalTrigger(minutes=1, timezone=IST))
    
    # Run today's task check at 8:00 AM, 1:00 PM, and 6:00 PM IST
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,13,18", minute="0", timezone=IST))
    
    # Run tomorrow's task check at 8:00 PM IST
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="20", minute="0", timezone=IST))
    
    scheduler.start()
    print("WebPush background task scheduler started (IST). Polling active.")