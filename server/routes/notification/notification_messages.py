import os
from google import genai
from google.genai import types
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

client = genai.Client()

# 1. Define your automatic fallback chain (Cheapest/Fastest -> Most Robust)
MODEL_CHAIN = [
    "gemini-gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-3.8-flash"
]

CATEGORY_EMOJIS = {
    "Assignment": "📝", "Project": "💻", "Exam / Quiz": "🎓",
    "Placement / Internship": "💼", "Extracurricular": "🏆",
    "Personal": "🌱", "Other": "📌"
}

def _get_emoji(category: str) -> str:
    return CATEGORY_EMOJIS.get(category, "⏰")

class NotificationCopy(BaseModel):
    title: str
    body: str

BASE_CONFIG = types.GenerateContentConfig(
    system_instruction="You are a concise productivity assistant for an engineering student. Write short, punchy push notifications.",
    response_mime_type="application/json",
    response_schema=NotificationCopy,
    temperature=0.7,
    max_output_tokens=150,
)

# 2. Centralized AI Call Function with Auto-Fallback
async def _generate_with_fallback(prompt: str) -> NotificationCopy:
    """Tries models in order. Raises exception only if ALL models fail."""
    last_error = None
    
    for model_name in MODEL_CHAIN:
        try:
            response = await client.aio.models.generate_content(
                model=model_name,
                contents=prompt,
                config=BASE_CONFIG
            )
            return NotificationCopy.model_validate_json(response.text)
        except Exception as e:
            print(f"[Warning] {model_name} failed: {e}. Trying next model...")
            last_error = e
            continue # Try the next model in the list
            
    # If the loop finishes and we are here, ALL API models failed.
    raise Exception(f"All AI models exhausted. Last error: {last_error}")


# ---------------------------------------------------------
# 3. Updated Endpoints using the new fallback engine
# ---------------------------------------------------------

async def get_due_soon_copy(task_title: str, category: str = "Other") -> tuple[str, str]:
    emoji = _get_emoji(category)
    prompt = f"Task: {task_title}\nCategory: {category}\nContext: Due in 60 mins.\nRules: Title 3-5 words. Body 1-2 sentences with an actionable directive."

    try:
        # Calls our new helper function
        data = await _generate_with_fallback(prompt)
        return f"{emoji} {data.title}", data.body

    except Exception as e:
        print(f"Critical API Failure (Due Soon): {e}")
        # Absolute Last Resort: Hardcoded local string (Zero Tokens)
        return (f"{emoji} 1 Hour Left!", f"Time to lock in! '{task_title}' is due in 60 minutes.")


async def get_today_digest_copy(tasks: list[dict], hour: int) -> tuple[str, str]:
    count = len(tasks)
    if count == 0:
        return "🎉 All Clear!", "You have no pending tasks for today. Great job!"

    task_list_str = "\n".join([f"[{t.get('category', 'Other')}] {t.get('title', 'Task')}" for t in tasks])
    context = "Morning kickoff." if hour < 12 else "Midday check." if hour < 17 else "Evening wrap-up."
    
    prompt = f"Phase: {context}\nTasks: {task_list_str}\nRules: Punchy title with emoji. Body <40 words in HTML (use <b> for top task), summarize effort."

    try:
        data = await _generate_with_fallback(prompt)
        return data.title, data.body

    except Exception as e:
        print(f"Critical API Failure (Today Digest): {e}")
        return ("📋 Today's Check-in", f"You have <b>{count} tasks</b> remaining today. Let's keep the momentum going!")


async def get_tomorrow_digest_copy(tasks: list[dict]) -> tuple[str, str]:
    count = len(tasks)
    if count == 0:
        return "🌙 Clear Skies", "Nothing on the radar for tomorrow. Rest easy!"

    task_list_str = "\n".join([f"- {t.get('title')} ({t.get('category')})" for t in tasks])
    prompt = f"Tomorrow's Tasks: {task_list_str}\nRules: Calming title with night emoji. Body in HTML. Reassure them tomorrow is planned. <40 words."

    try:
        data = await _generate_with_fallback(prompt)
        return data.title, data.body

    except Exception as e:
        print(f"Critical API Failure (Tomorrow Digest): {e}")
        return ("🌙 Tomorrow's Gameplan", f"You have {count} tasks lined up for tomorrow. Rest up, you're already prepared!")