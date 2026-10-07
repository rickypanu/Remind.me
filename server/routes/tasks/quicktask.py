import os
import json
from datetime import datetime
from itertools import cycle
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from google import genai
from google.genai import types, errors

from database import get_db
from utils.security import get_current_user
from utils.timezone import now_ist, to_utc

router = APIRouter(tags=["Task"])

# 1. API Key Pool for Rate Limit Resilience
# Add multiple keys to your .env like: GEMINI_API_KEYS="key1,key2,key3"
# Strip spaces and quotes (both single and double) from the .env string
raw_keys = os.getenv("GEMINI_API_KEYS", os.getenv("GEMINI_API_KEY", ""))
API_KEYS = [key.strip(" '\"") for key in raw_keys.split(",") if key.strip(" '\"")]

if not API_KEYS:
    raise ValueError("No Gemini API keys found in environment.")

key_pool = cycle(API_KEYS)


# 2. Modern 2026 Fast Models (Ordered by speed)
FALLBACK_MODELS = [
    "gemini-3.8-flash",      
    "gemini-3.5-flash-lite", 
    "gemini-2.5-flash",      
]

class MagicAddRequest(BaseModel):
    text: str

# 3. Pydantic Schema for Native Structured Outputs
class TaskExtractionSchema(BaseModel):
    title: str = Field(description="Clean, concise task title translated to English")
    description: Optional[str] = Field(description="Brief summary of extra details or instructions")
    due_date: datetime = Field(description="Deadline in Indian Standard Time as ISO 8601 WITH the +05:30 offset, e.g. 2026-10-08T17:00:00+05:30")
    category: str = Field(description="Relevant category like Assignment, Project, Exam, etc.")

async def generate_task_data(prompt: str) -> dict:
    """Instantly cycles through models and API keys to bypass rate limits without sleeping."""
    last_exception = None
    
    # Try up to X times before failing completely
    max_attempts = len(FALLBACK_MODELS) * len(API_KEYS) 

    for attempt in range(max_attempts):
        model_name = FALLBACK_MODELS[attempt % len(FALLBACK_MODELS)]
        current_key = next(key_pool)
        
        # Instantiate a temporary client with the current round-robin key
        client = genai.Client(api_key=current_key)

        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=TaskExtractionSchema,
                    temperature=0.0,
                )
            )
            
            if response.text:
                return json.loads(response.text)
            
        except errors.APIError as e:
            last_exception = e
            
            # Print which key failed to your console so you can find the bad one
            print(f"Skipping key ending in ...{current_key[-4:]} or model {model_name}. Reason: {e.code}")
            
            # 400 (Invalid Key/Bad Request), 401/403 (Auth Error), 404 (Not Found)
            # 429 (Quota), 503 (Overloaded) -> Instantly skip to next key/model
            if getattr(e, 'code', None) in (400, 401, 403, 404, 429, 503):
                continue 
                
            raise e # Unhandled API errors
            
        except Exception as e:
            last_exception = e
            continue

    # Only reached after EVERY key/model combination has failed
    raise RuntimeError(f"All API keys and models exhausted. Last error: {last_exception}")

@router.post("/magic-add", status_code=status.HTTP_201_CREATED)
async def magic_add_task(
    payload: MagicAddRequest, 
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    current_time = now_ist().strftime("%A, %Y-%m-%d %H:%M IST (UTC+05:30)")
    
    # The prompt is now much smaller because Pydantic handles the formatting instructions
    prompt = f"""
    Current time: {current_time}. 
    Extract task details from this text. Resolve relative dates (kal, sham, etc.) in IST based on the current time, and return due_date in IST with the +05:30 offset.
    User's text: "{payload.text}"
    """

    try:
        task_data = await generate_task_data(prompt)
        
        # Schema guarantees these keys exist and are correctly formatted
        new_task = {
            "title": task_data["title"],
            "description": task_data.get("description"),
            "category": task_data["category"],
            "due_date": to_utc(datetime.fromisoformat(task_data["due_date"])),  # naive -> IST, aware -> UTC
            "status": "pending",
            "user_id": current_user["_id"]
        }
        
        result = await db["tasks"].insert_one(new_task)
        
        new_task["id"] = str(result.inserted_id)
        new_task["user_id"] = str(new_task["user_id"])
        new_task.pop("_id", None)
        
        return new_task

    except RuntimeError as e:
        print(f"Gemini Exhausted: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="AI servers are busy. Please try again."
        )
    except Exception as e:
        print(f"Magic Add Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="Failed to parse task from text. Please try rephrasing."
        )