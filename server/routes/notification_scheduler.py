import asyncio
from collections import defaultdict
from datetime import datetime, timedelta
import pytz

from fastapi import APIRouter
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database import db
from routes.webpush_service import send_web_push
from routes.telegram_service import send_telegram_notification
from notification_messages import (
    get_due_soon_copy,
    get_today_digest_copy,
    get_tomorrow_digest_copy,
)

router = APIRouter()
IST = pytz.timezone('Asia/Kolkata')


async def dispatch_user_notifications(user: dict, title: str, body: str):
    """Triggers Web Push and Telegram notifications with non-blocking calls & token cleanup."""
    # 1. Web Push Dispatch
    subscriptions = user.get("push_subscriptions", [])
    stale_subscriptions = []

    for subscription in subscriptions:
        try:
            # Offload synchronous push execution to a thread to avoid blocking the event loop
            await asyncio.to_thread(send_web_push, subscription, title, body)
        except Exception as e:
            err_msg = str(e).lower()
            print(f"Web Push Dispatch Error: {e}")
            if "410" in err_msg or "404" in err_msg or "expired" in err_msg:
                stale_subscriptions.append(subscription)

    # Prune stale tokens from database
    if stale_subscriptions:
        await db["users"].update_one(
            {"_id": user["_id"]},
            {"$pull": {"push_subscriptions": {"$in": stale_subscriptions}}}
        )

    # 2. Telegram Dispatch
    telegram_chat_id = user.get("telegram_chat_id")
    if telegram_chat_id:
        try:
            await send_telegram_notification(telegram_chat_id, title, body)
        except Exception as e:
            print(f"Telegram Dispatch Error: {e}")


# ---------------------------------------------------------
# SCHEDULER TASKS
# ---------------------------------------------------------

async def remind_upcoming_tasks():
    now_utc = datetime.now(pytz.utc)
    target_start = now_utc + timedelta(minutes=55)
    target_end = now_utc + timedelta(minutes=65)

    # Query tasks due in ~60 mins that haven't received a 1-hour warning
    query = {
        "due_date": {"$gte": target_start, "$lt": target_end},
        "status": {"$ne": "completed"},
        "notified_due_soon": {"$ne": True}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    for task in tasks:
        user_id = task.get("user_id")
        user = await db["users"].find_one({"_id": user_id})
        if user:
            # Pass title AND category to trigger tailored dynamic copy
            title, body = get_due_soon_copy(
                task_title=task.get("title", "Untitled Task"),
                category=task.get("category", "Other")
            )
            await dispatch_user_notifications(user, title, body)
            
            # Set tracking flags and timestamp
            await db["tasks"].update_one(
                {"_id": task["_id"]},
                {
                    "$set": {
                        "notified_due_soon": True,
                        "last_notified_at": now_utc
                    }
                }
            )


async def remind_todays_tasks():
    now_ist = datetime.now(IST)
    now_utc = datetime.now(pytz.utc)
    start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today_ist = start_of_today_ist + timedelta(days=1)

    start_utc = start_of_today_ist.astimezone(pytz.utc)
    end_utc = end_of_today_ist.astimezone(pytz.utc)
    recent_cooldown = now_utc - timedelta(minutes=45)

    # Query active tasks due today
    query = {
        "due_date": {"$gte": start_utc, "$lt": end_utc},
        "status": {"$ne": "completed"}
    }

    tasks = await db["tasks"].find(query).to_list(length=None)
    user_tasks = defaultdict(list)
    task_ids_to_update = []

    for task in tasks:
        last_notified = task.get("last_notified_at")
        
        # Ensure UTC comparison for timestamps
        if last_notified and last_notified.tzinfo is None:
            last_notified = pytz.utc.localize(last_notified)

        # Skip tasks that received an urgent 1-hour reminder within the last 45 minutes
        if last_notified and last_notified > recent_cooldown:
            continue

        # Append full task details (title + category) for the category-aware digest
        user_tasks[task.get("user_id")].append({
            "title": task.get("title", "Untitled Task"),
            "category": task.get("category", "Other")
        })
        task_ids_to_update.append(task["_id"])

    for user_id, tasks_list in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title, body = get_today_digest_copy(tasks_list, now_ist.hour)
            await dispatch_user_notifications(user, title, body)

    # Mark tasks with current timestamp to enforce the cooldown window
    if task_ids_to_update:
        await db["tasks"].update_many(
            {"_id": {"$in": task_ids_to_update}},
            {"$set": {"last_notified_at": now_utc}}
        )


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
    task_ids_to_update = []

    for task in tasks:
        user_tasks[task.get("user_id")].append({
            "title": task.get("title", "Untitled Task"),
            "category": task.get("category", "Other")
        })
        task_ids_to_update.append(task["_id"])

    for user_id, tasks_list in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title, body = get_tomorrow_digest_copy(tasks_list)
            await dispatch_user_notifications(user, title, body)

    if task_ids_to_update:
        await db["tasks"].update_many(
            {"_id": {"$in": task_ids_to_update}},
            {"$set": {"notified_tomorrow_digest": True, "last_notified_at": now_utc}}
        )


# ---------------------------------------------------------
# SCHEDULER INITIALIZATION
# ---------------------------------------------------------

@router.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler(timezone=IST)

    scheduler.add_job(remind_upcoming_tasks, CronTrigger(minute="*"))
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,14,20", minute="0"))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="21", minute="0"))

    scheduler.start()
    print("Notification background scheduler running with category-aware logic.")