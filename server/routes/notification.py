from fastapi import APIRouter
from pywebpush import webpush, WebPushException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import json
import pytz 
import os
import httpx
from dotenv import load_dotenv

load_dotenv()
from database import db 

router = APIRouter()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_CLAIMS = {"sub": os.getenv("VAPID_EMAIL")}
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

IST = pytz.timezone('Asia/Kolkata')

# ---------------------------------------------------------
# NOTIFICATION HELPERS
# ---------------------------------------------------------
def send_push(subscription_info: dict, title: str, message: str):
    if not subscription_info:
        return
    try:
        webpush(
            subscription_info=subscription_info,
            data=json.dumps({"title": title, "body": message}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS
        )
    except WebPushException as e:
        print(f"WebPush Error: {e}")

async def send_telegram(chat_id: str, message: str):
    """Sends an asynchronous message to a specific Telegram chat_id."""
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        return
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "HTML"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload)
            if response.status_code != 200:
                print(f"Telegram API Error: {response.text}")
        except Exception as e:
            print(f"Failed to send Telegram message: {e}")

async def dispatch_notifications(user: dict, title: str, body: str):
    """Helper function to dispatch both Web Push and Telegram notifications."""
    # 1. Send Web Push
    if "push_subscriptions" in user and user["push_subscriptions"]:
        for subscription in user["push_subscriptions"]:
            send_push(subscription, title, body)
            
    # 2. Send Telegram Message
    telegram_chat_id = user.get("telegram_chat_id")
    if telegram_chat_id:
        telegram_message = f"<b>{title}</b>\n{body}"
        await send_telegram(telegram_chat_id, telegram_message)

# ---------------------------------------------------------
# REMINDER TASKS
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
            title = "Task Due Soon!"
            body = f"'{task['title']}' is due in 1 hour."
            await dispatch_notifications(user, title, body)

async def remind_todays_tasks():
    print("Running Today's Task Check...")
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
    
    # Example grouping logic sending to each user:
    # Group tasks by user_id and call `await dispatch_notifications(user, title, body)`

async def remind_tomorrows_tasks():
    print("Running Tomorrow's Task Check...")
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
    
    # Group tasks by user_id and call `await dispatch_notifications(user, title, body)`

# ---------------------------------------------------------
# SCHEDULER
# ---------------------------------------------------------
@router.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler(timezone=IST)
    
    scheduler.add_job(remind_upcoming_tasks, CronTrigger(minute="*"))
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,13,15,18,20", minute="0"))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="16,20", minute="0"))
    
    scheduler.start()
    print("Background task scheduler started!") 

# ---------------------------------------------------------
# TASK CREATION MODEL & HANDLING
# ---------------------------------------------------------
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    due_date: datetime
    status: str = "pending"

@router.post("/tasks/")
async def create_task(task: TaskCreate):
    if task.due_date.tzinfo is None:
        task.due_date = IST.localize(task.due_date)
    
    utc_due_date = task.due_date.astimezone(pytz.utc)
    
    task_dict = task.dict()
    task_dict["due_date"] = utc_due_date
    
    await db["tasks"].insert_one(task_dict)
    return {"message": "Task created successfully"}