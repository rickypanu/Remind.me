import os
import json
import pytz
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types

from database import get_db
from utils.security import get_current_user

router = APIRouter()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

IST = pytz.timezone('Asia/Kolkata')

class MagicAddRequest(BaseModel):
    text: str

@router.post("/magic-add", status_code=201)
async def magic_add_task(
    payload: MagicAddRequest, 
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    current_time = datetime.now(IST).strftime("%A, %B %d, %Y at %I:%M %p IST")
    
    prompt = f"""
    Extract task details from the user's text. They might use English, Hindi, or Hinglish.
    The current date and time is: {current_time}. Resolve relative words like "kal", "tomorrow", "sham", "parso" based on this exact current time.

    Categories strictly allowed: "Assignment", "Project", "Exam / Quiz", "Placement / Internship", "Extracurricular", "Personal", "Other".

    Return ONLY a raw JSON object with these exact keys:
    - "title": A clean, concise task title translated to English (e.g., "Submit OS Assignment").
    - "due_date": The deadline formatted as an ISO 8601 string with UTC timezone offset (e.g., "2026-09-15T18:30:00+00:00"). If no time is specified, default to 23:59:59 UTC of the target day.
    - "category": The most relevant category from the strict list above.

    User's text: "{payload.text}"
    """

    try:
        response = await asyncio.to_thread(
            client.models.generate_content,
            model='gemini-3.6-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            )
        )
        
        task_data = json.loads(response.text)
        utc_due_date = datetime.fromisoformat(task_data["due_date"])
        
        new_task = {
            "title": task_data["title"],
            "description": None,
            "category": task_data["category"],
            "due_date": utc_due_date,
            "status": "pending",
            "user_id": current_user["_id"]
        }
        
        result = await db["tasks"].insert_one(new_task)
        
        new_task["id"] = str(result.inserted_id)
        new_task["user_id"] = str(new_task["user_id"])
        
        # Pop MongoDB's un-serializable ObjectId before returning
        new_task.pop("_id", None)
        
        return new_task

    except Exception as e:
        print(f"Gemini Magic Add Error: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Failed to parse task from text. Please try rephrasing."
        )