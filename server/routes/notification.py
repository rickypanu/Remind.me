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
from dotenv import load_dotenv

load_dotenv()
from database import db 

router = APIRouter()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_CLAIMS = {"sub": os.getenv("VAPID_EMAIL")}

IST = pytz.timezone('Asia/Kolkata')

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

# ---------------------------------------------------------
# NEW: 1-Hour Upcoming Reminder
# ---------------------------------------------------------
async def remind_upcoming_tasks():
    # Get current time in UTC
    now_utc = datetime.now(pytz.utc)
    
    # Define a 1-minute window exactly 60 minutes from now
    target_start = now_utc + timedelta(minutes=59)
    target_end = now_utc + timedelta(minutes=60)
    
    # Query MongoDB using UTC times
    query = {
        "due_date": {"$gte": target_start, "$lt": target_end},
        "status": {"$ne": "completed"}
    }
    
    tasks = await db["tasks"].find(query).to_list(length=None)
    
    for task in tasks:
        user_id = task.get("user_id")
        user = await db["users"].find_one({"_id": user_id})
        
        if user and "push_subscriptions" in user:
            title = "Task Due Soon!"
            body = f"'{task['title']}' is due in 1 hour."
            for subscription in user["push_subscriptions"]:
                send_push(subscription, title, body)

# ---------------------------------------------------------
# UPDATED: Today's Tasks (Timezone Fixed)
# ---------------------------------------------------------
async def remind_todays_tasks():
    print("Running Today's Task Check...")
    now_ist = datetime.now(IST)
    
    # Get start and end of the day in IST
    start_of_today_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today_ist = start_of_today_ist + timedelta(days=1)
    
    # Convert IST boundaries to UTC for the MongoDB query
    start_utc = start_of_today_ist.astimezone(pytz.utc)
    end_utc = end_of_today_ist.astimezone(pytz.utc)
    
    query = {
        "due_date": {"$gte": start_utc, "$lt": end_utc},
        "status": {"$ne": "completed"} 
    }
    
    tasks = await db["tasks"].find(query).to_list(length=None)
    
    # ... (Keep your existing grouping and push logic here) ...

# ---------------------------------------------------------
# UPDATED: Tomorrow's Tasks (Timezone Fixed)
# ---------------------------------------------------------
async def remind_tomorrows_tasks():
    print("Running Tomorrow's Task Check...")
    now_ist = datetime.now(IST)
    
    # Get start and end of tomorrow in IST
    start_of_tomorrow_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    end_of_tomorrow_ist = start_of_tomorrow_ist + timedelta(days=1)
    
    # Convert IST boundaries to UTC for the MongoDB query
    start_utc = start_of_tomorrow_ist.astimezone(pytz.utc)
    end_utc = end_of_tomorrow_ist.astimezone(pytz.utc)
    
    query = {
        "due_date": {"$gte": start_utc, "$lt": end_utc},
        "status": {"$ne": "completed"}
    }
    
    tasks = await db["tasks"].find(query).to_list(length=None)
    
    # ... (Keep your existing grouping and push logic here) ...

# ---------------------------------------------------------
# SCHEDULER
# ---------------------------------------------------------
@router.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler(timezone=IST)
    
    # Add the new 1-hour check to run every single minute
    scheduler.add_job(remind_upcoming_tasks, CronTrigger(minute="*"))
    
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,13,15,18, 20", minute="0"))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="16,20", minute="0"))
    
    scheduler.start()
    print("Background task scheduler started!") 

# ---------------------------------------------------------
# UPDATED: Task Creation Model & Handling
# ---------------------------------------------------------
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    due_date: datetime
    status: str = "pending"

# When you save the task in your route, ensure it converts to UTC:
@router.post("/tasks/")
async def create_task(task: TaskCreate):
    # Check if the datetime is naive (no timezone info). If so, assume it's IST and localize it.
    if task.due_date.tzinfo is None:
        task.due_date = IST.localize(task.due_date)
    
    # Convert to UTC before inserting into MongoDB
    utc_due_date = task.due_date.astimezone(pytz.utc)
    
    task_dict = task.dict()
    task_dict["due_date"] = utc_due_date # Save the UTC time
    
    await db["tasks"].insert_one(task_dict)
    return {"message": "Task created successfully"}