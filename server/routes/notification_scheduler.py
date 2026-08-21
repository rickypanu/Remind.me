from fastapi import APIRouter
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from collections import defaultdict
from datetime import datetime, timedelta
import pytz
import random

from database import db
from routes.webpush_service import send_web_push
from routes.telegram_service import send_telegram_notification

router = APIRouter()
IST = pytz.timezone('Asia/Kolkata')

async def dispatch_user_notifications(user: dict, title: str, body: str):
    """Triggers both Web Push and Telegram notifications for a user."""
    # 1. Web Push Dispatch
    if "push_subscriptions" in user and user["push_subscriptions"]:
        for subscription in user["push_subscriptions"]:
            try:
                send_web_push(subscription, title, body)
            except Exception as e:
                print(f"Web Push Dispatch Error: {e}")
            
    # 2. Telegram Dispatch
    telegram_chat_id = user.get("telegram_chat_id")
    if telegram_chat_id:
        try:
            await send_telegram_notification(telegram_chat_id, title, body)
        except Exception as e:
            print(f"Telegram Dispatch Error: {e}")

# ---------------------------------------------------------
# PSYCHOLOGICAL DYNAMIC COPY GENERATORS
# ---------------------------------------------------------

def get_due_soon_copy(task_title: str) -> tuple[str, str]:
    """Urgency & Action-Oriented (T-60 Minutes)"""
    templates = [
        ("🚨 Action Required | 1 Hour Left", f"'{task_title}' is due shortly!"),
        ("⌛ Final Stretch!", f"Just 60 minutes remaining for '{task_title}'. Time to focus and finish strong."),
        ("⏰ Clock is Ticking", f"'{task_title}' deadline is approaching. Take action now to check it off your list!"),
    ]
    return random.choice(templates)

def get_today_digest_copy(task_titles: list[str], hour: int) -> tuple[str, str]:
    """Time-Contextual Copy for Today's Digest"""
    count = len(task_titles)
    task_list_str = "\n• " + "\n• ".join(task_titles)

    # Morning Focus (8 AM)
    if hour < 12:
        title = "🌅 Good Morning! Today's Action Plan"
        body = f"You have {count} critical task(s) lined up today:\n{task_list_str}\n\nStart strong and set the momentum!"
    # Midday Check-in (1 PM - 3 PM)
    elif hour < 17:
        title = "⚡ Midday Momentum Check"
        body = f"Halfway through the day! You still have {count} task(s) pending:\n{task_list_str}\n\nKeep driving forward."
    # Evening Wrap-up (6 PM - 8 PM)
    else:
        title = "🌙 Evening Review | Pending Tasks"
        body = f"Clear your mind before calling it a day. {count} task(s) remaining:\n{task_list_str}\n\nFinish up or reschedule!"

    return title, body

def get_tomorrow_digest_copy(task_titles: list[str]) -> tuple[str, str]:
    """Preparation & Peace of Mind Copy (Night Before)"""
    count = len(task_titles)
    task_list_str = "\n• " + "\n• ".join(task_titles)

    templates = [
        (
            "📅 Tomorrow's Head Start",
            f"Planning ahead reduces stress. You have {count} task(s) queued for tomorrow:\n{task_list_str}"
        ),
        (
            "🧠 Prepare Your Mind for Tomorrow",
            f"Here is your agenda for tomorrow ({count} task(s)):\n{task_list_str}\n\nGet rest knowing you're fully prepared."
        )
    ]
    return random.choice(templates)

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
            title, body = get_due_soon_copy(task.get("title", "Untitled Task"))
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
        user_tasks[task.get("user_id")].append(task.get('title', 'Untitled Task'))
        
    for user_id, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title, body = get_today_digest_copy(task_titles, now_ist.hour)
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
        user_tasks[task.get("user_id")].append(task.get('title', 'Untitled Task'))
        
    for user_id, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        if user:
            title, body = get_tomorrow_digest_copy(task_titles)
            await dispatch_user_notifications(user, title, body)

# ---------------------------------------------------------
# SCHEDULER INITIALIZATION
# ---------------------------------------------------------

@router.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler(timezone=IST)
    
    scheduler.add_job(remind_upcoming_tasks, CronTrigger(minute="*"))
    
    # Reduced frequencies to avoid notification fatigue: 8 AM (Morning), 2 PM (Midday), 8 PM (Evening)
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,14,20", minute="0"))
    
    # 9 PM for tomorrow's planning
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="21", minute="0"))
    
    scheduler.start()
    print("Notification background scheduler running.")