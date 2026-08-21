from fastapi import APIRouter
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from collections import defaultdict
from datetime import datetime, timedelta
import pytz

from database import db
from webpush_service import send_web_push
from telegram_service import send_telegram_notification

router = APIRouter()
IST = pytz.timezone('Asia/Kolkata')

async def dispatch_user_notifications(user: dict, title: str, body: str):
    """Triggers both Web Push and Telegram notifications for a user."""
    # 1. Web Push Dispatch
    if "push_subscriptions" in user and user["push_subscriptions"]:
        for subscription in user["push_subscriptions"]:
            send_web_push(subscription, title, body)
            
    # 2. Telegram Dispatch
    telegram_chat_id = user.get("telegram_chat_id")
    if telegram_chat_id:
        await send_telegram_notification(telegram_chat_id, title, body)

# ---------------------------------------------------------
# SCHEDULER TASKS
# ---------------------------------------------------------
async def remind_upcoming_tasks():
    now_utc = datetime.now(pytz.utc)
    target_start = now_utc + timedelta(minutes=59)
    target_end = now_utc + timedelta(minutes=60)
    
    query = {
        "due_date": {"$gte": target_start, "$lt": target_end},
        "status": {"$ne": "completed"}
    }
    
    tasks = await db["tasks"].find(query).to_list(length=None)
    for task in tasks:
        user_id = task.get("user_id")
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title = "⏰ Task Due Soon!"
            body = f"'{task['title']}' is due in 1 hour."
            await dispatch_user_notifications(user, title, body)

async def remind_todays_tasks():
    now_ist = datetime.now(IST)
    start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today_ist = start_of_today_ist + timedelta(days=1)
    
    start_utc = start_of_today_ist.astimezone(pytz.utc)
    end_utc = end_of_today_ist.astimezone(pytz.utc)
    
    query = {
        "due_date": {"$gte": start_utc, "$lt": end_utc},
        "status": {"$ne": "completed"} 
    }
    
    tasks = await db["tasks"].find(query).to_list(length=None)
    user_tasks = defaultdict(list)
    for task in tasks:
        user_tasks[task.get("user_id")].append(task['title'])
        
    for user_id, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title = "📌 Today's Tasks Summary"
            body = f"You have {len(task_titles)} pending task(s) for today:\n• " + "\n• ".join(task_titles)
            await dispatch_user_notifications(user, title, body)

async def remind_tomorrows_tasks():
    now_ist = datetime.now(IST)
    start_of_tomorrow_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    end_of_tomorrow_ist = start_of_tomorrow_ist + timedelta(days=1)
    
    start_utc = start_of_tomorrow_ist.astimezone(pytz.utc)
    end_utc = end_of_tomorrow_ist.astimezone(pytz.utc)
    
    query = {
        "due_date": {"$gte": start_utc, "$lt": end_utc},
        "status": {"$ne": "completed"}
    }
    
    tasks = await db["tasks"].find(query).to_list(length=None)
    user_tasks = defaultdict(list)
    for task in tasks:
        user_tasks[task.get("user_id")].append(task['title'])
        
    for user_id, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title = "📅 Tomorrow's Planned Tasks"
            body = f"You have {len(task_titles)} task(s) scheduled for tomorrow:\n• " + "\n• ".join(task_titles)
            await dispatch_user_notifications(user, title, body)

# ---------------------------------------------------------
# SCHEDULER INITIALIZATION
# ---------------------------------------------------------
@router.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler(timezone=IST)
    
    scheduler.add_job(remind_upcoming_tasks, CronTrigger(minute="*"))
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,13,15,18,20", minute="0"))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="16,20", minute="0"))
    
    scheduler.start()
    print("Notification background scheduler running.")