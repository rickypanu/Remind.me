import os
import json
import pytz
import asyncio
import random
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from google import genai
from google.genai import types, errors

from database import get_db
from utils.security import get_current_user

router = APIRouter()

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

IST = pytz.timezone('Asia/Kolkata')

# Candidate models ordered by preference
FALLBACK_MODELS = [
    "gemini-3.6-flash",
    "gemini-3.6-flash-lite",
    "gemini-3.6-pro",
    "gemini-2.5-flash",  
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]

class MagicAddRequest(BaseModel):
    text: str

async def generate_task_json_with_fallback(prompt: str) -> str:
    """Iterates through fallback models with backoff to withstand 503/429 spikes."""
    max_retries_per_model = 2
    last_exception = None

    for model_name in FALLBACK_MODELS:
        for attempt in range(max_retries_per_model):
            try:
                # Use client.aio for native async generation
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                    )
                )
                if response.text:
                    return response.text

            except errors.APIError as e:
                last_exception = e
                # Retry on transient server saturation or rate limits
                if e.code in (503, 429):
                    if attempt < max_retries_per_model - 1:
                        delay = (1.5 ** attempt) + random.uniform(0.3, 0.8)
                        await asyncio.sleep(delay)
                        continue
                    else:
                        break  # Fallback to the next model in the list

                if e.code == 404:
                    break

                raise e  # Bad request / auth errors fail immediately
            except Exception as e:
                last_exception = e
                break

    raise RuntimeError(f"All Gemini fallback models exhausted: {last_exception}")

@router.post("/magic-add", status_code=status.HTTP_201_CREATED)
async def magic_add_task(
    payload: MagicAddRequest, 
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    current_time = datetime.now(IST).strftime("%A, %B %d, %Y at %I:%M %p IST")
    
    prompt = f"""
    Extract task details from the user's text. They might use English, Hindi, or Hinglish.
    The current date and time is: {current_time}. Resolve relative words like "kal", "tomorrow", "sham", "parso" based on this exact current time.

    Suggested categories: "Assignment", "Project", "Exam / Quiz", "Placement / Internship", "Extracurricular", "Personal". If the task doesn't fit any of these, generate a short, relevant custom category name.

    Return ONLY a raw JSON object with these exact keys:
    - "title": A clean, concise task title translated to English (e.g., "Submit OS Assignment").
    - "description": A brief summary of any extra details, instructions, or context mentioned (max 1-2 short sentences).
    - "due_date": The deadline formatted as an ISO 8601 string with UTC timezone offset (e.g., "2026-09-15T18:30:00+00:00"). If no time is specified, default to 23:59:59 UTC of the target day.
    - "category": The most relevant category from the suggested list, or a custom one if needed.

    User's text: "{payload.text}"
    """

    try:
        raw_json = await generate_task_json_with_fallback(prompt)
        task_data = json.loads(raw_json)
        utc_due_date = datetime.fromisoformat(task_data["due_date"])
        
        new_task = {
            "title": task_data["title"],
            "description": task_data.get("description"),  # Now pulls dynamically from Gemini
            "category": task_data["category"],
            "due_date": utc_due_date,
            "status": "pending",
            "user_id": current_user["_id"]
        }
        
        result = await db["tasks"].insert_one(new_task)
        
        new_task["id"] = str(result.inserted_id)
        new_task["user_id"] = str(new_task["user_id"])
        new_task.pop("_id", None)
        
        return new_task

    except RuntimeError as e:
        print(f"Gemini Service Unavailable: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="AI model capacity is currently saturated. Please retry in a few moments."
        )
    except Exception as e:
        print(f"Gemini Magic Add Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to parse task from text. Please try rephrasing."
        )