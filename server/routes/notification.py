from fastapi import APIRouter
from pywebpush import webpush, WebPushException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime, timedelta
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

if not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
    raise ValueError("Missing VAPID keys in environment variables!")
#  Allow custom titles so notifications look cleaner
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


async def remind_todays_tasks():
    print("Running Today's Task Check...")
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_today = start_of_today + timedelta(days=1)
    
    query = {
        "due_date": {"$gte": start_of_today, "$lt": end_of_today},
        "status": {"$ne": "completed"} 
    }
    
    tasks = await db["tasks"].find(query).to_list(length=None)
    
    user_tasks = {}
    for task in tasks:
        user_id = task.get("user_id")
        if user_id not in user_tasks:
            user_tasks[user_id] = []
        user_tasks[user_id].append(task['title'])

    for user_id, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        
        # UPDATED: Check for the array 'push_subscriptions'
        if user and "push_subscriptions" in user:
            if len(task_titles) == 1:
                title = "Today's Task"
                body = f"Don't forget to: {task_titles[0]}"
            else:
                title = f"{len(task_titles)} Tasks Today"
                body = f"You have {len(task_titles)} things to do, starting with: {task_titles[0]}"
                
            # UPDATED: Loop through all devices (laptop, mobile, etc.) and send to each
            for subscription in user["push_subscriptions"]:
                send_push(subscription, title, body)


async def remind_tomorrows_tasks():
    print("Running Tomorrow's Task Check...")
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    
    start_of_tomorrow = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    end_of_tomorrow = start_of_tomorrow + timedelta(days=1)
    
    query = {
        "due_date": {"$gte": start_of_tomorrow, "$lt": end_of_tomorrow},
        "status": {"$ne": "completed"}
    }
    
    tasks = await db["tasks"].find(query).to_list(length=None)
    
    user_tasks = {}
    for task in tasks:
        user_id = task.get("user_id")
        if user_id not in user_tasks:
            user_tasks[user_id] = []
        user_tasks[user_id].append(task['title'])

    for user_id, task_titles in user_tasks.items():
        user = await db["users"].find_one({"_id": user_id})
        
        # UPDATED: Check for the array 'push_subscriptions'
        if user and "push_subscriptions" in user:
            if len(task_titles) == 1:
                title = "Tomorrow's Agenda"
                body = f"Heads up for tomorrow: {task_titles[0]}"
            else:
                title = f"{len(task_titles)} Tasks Tomorrow"
                body = f"Get ready! You have {len(task_titles)} tasks scheduled for tomorrow."
                
            # UPDATED: Loop through all devices
            for subscription in user["push_subscriptions"]:
                send_push(subscription, title, body)

IST = pytz.timezone('Asia/Kolkata')

@router.on_event("startup")
async def start_scheduler():
    scheduler = AsyncIOScheduler(timezone=IST)
    
    scheduler.add_job(remind_todays_tasks, CronTrigger(hour="8,13,18,10", minute="0,21,23,34,25,27,29,33,31"))
    scheduler.add_job(remind_tomorrows_tasks, CronTrigger(hour="18,22", minute="0"))
    
    scheduler.start()
    print("Background task scheduler started with production intervals!")