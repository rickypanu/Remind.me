import os
import random
from google import genai
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

# Initialize the Gemini Client (ensure GEMINI_API_KEY is in your environment)
client = genai.Client()

# Category Emojis for Visual Clarity
CATEGORY_EMOJIS = {
    "Assignment": "📝",
    "Project": "💻",
    "Exam / Quiz": "🎓",
    "Placement / Internship": "💼",
    "Extracurricular": "🏆",
    "Personal": "🌱",
    "Other": "📌"
}

def _get_emoji(category: str) -> str:
    return CATEGORY_EMOJIS.get(category, "⏰")

# Force Gemini to return exactly this JSON structure
class NotificationCopy(BaseModel):
    title: str
    body: str

# ---------------------------------------------------------
# 1. DUE SOON MESSAGES (T-60 Minutes)
# ---------------------------------------------------------
async def get_due_soon_copy(task_title: str, category: str = "Other") -> tuple[str, str]:
    emoji = _get_emoji(category)
    
    prompt = f"""
    You are a productivity assistant for an engineering student.
    Generate a highly urgent, scannable push notification for a task due in 60 minutes.
    
    Task: "{task_title}"
    Category: "{category}"
    
    Constraints:
    - Title: Exactly 3-5 words. Urgent but calm.
    - Body: 1-2 short sentences. Give a specific, actionable directive to get it done.
    - Output strictly in the requested JSON format.
    """

    try:
        # Use the asynchronous client (client.aio)
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": NotificationCopy,
                "temperature": 0.7,
            },
        )
        data = NotificationCopy.model_validate_json(response.text)
        return f"{emoji} {data.title}", data.body

    except Exception as e:
        print(f"Gemini API fallback triggered for Due Soon: {e}")
        # Static Fallback
        return (f"{emoji} 1 Hour Left", f"'{task_title}' is due in 60 minutes. Time to lock in!")

# ---------------------------------------------------------
# 2. TODAY'S DIGEST MESSAGES
# ---------------------------------------------------------
async def get_today_digest_copy(tasks: list[dict], hour: int) -> tuple[str, str]:
    count = len(tasks)
    
    formatted_tasks = []
    for t in tasks:
        title = t.get("title", "Untitled Task")
        cat = t.get("category", "Other")
        formatted_tasks.append(f"[{cat}] {title}")
    
    task_list_str = "\n".join(formatted_tasks)

    # Adjust tone based on the time of day
    if hour < 12:
        context = "Morning kickoff. Tone should be energizing and strategic. Highlight the most high-stakes task (like an exam or placement prep) as the main priority."
    elif hour < 17:
        context = "Midday momentum check. Tone should be encouraging and forgiving. Focus on keeping momentum going without guilt."
    else:
        context = "Evening wrap-up. Tone should be focused on final stretches. Urge them to clear the remaining items before calling it a day."

    prompt = f"""
    You are a productivity assistant for an engineering student. 
    Generate a time-contextual task digest notification.
    
    Current phase: {context}
    Total tasks remaining: {count}
    Task List:
    {task_list_str}

    Constraints:
    - Title: Punchy, includes a relevant emoji.
    - Body: Format as HTML for Telegram. Use <b>bold</b> for the most important task. Keep the summary under 50 words. Do not just list the tasks, summarize the effort required.
    - Output strictly in the requested JSON format.
    """

    try:
        response = await client.aio.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": NotificationCopy,
                "temperature": 0.8,
            },
        )
        data = NotificationCopy.model_validate_json(response.text)
        return data.title, data.body

    except Exception as e:
        print(f"Gemini API fallback triggered for Today Digest: {e}")
        # Static Fallback
        return ("📋 Today's Check-in", f"You have {count} pending tasks left to crush today.")

# ---------------------------------------------------------
# 3. TOMORROW'S DIGEST MESSAGES
# ---------------------------------------------------------
async def get_tomorrow_digest_copy(tasks: list[dict]) -> tuple[str, str]:
    count = len(tasks)
    
    formatted_tasks = []
    for t in tasks:
        formatted_tasks.append(f"- {t.get('title')} ({t.get('category')})")
    task_list_str = "\n".join(formatted_tasks)

    prompt = f"""
    You are a productivity assistant. Generate a night-before preparation digest.
    
    Tomorrow's tasks: {count}
    Task List:
    {task_list_str}

    Constraints:
    - Title: Calming and structured, includes a night/planning emoji.
    - Body: Format as HTML for Telegram. Reassure the user that tomorrow is already planned out. 
    - Output strictly in the requested JSON format.
    """

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config={
                "response_mime_type": "application/json",
                "response_schema": NotificationCopy,
                "temperature": 0.7,
            },
        )
        data = NotificationCopy.model_validate_json(response.text)
        return data.title, data.body

    except Exception as e:
        print(f"Gemini API fallback triggered for Tomorrow Digest: {e}")
        # Static Fallback
        return ("🌙 Tomorrow's Head Start", f"You have {count} tasks lined up for tomorrow. Rest up!")