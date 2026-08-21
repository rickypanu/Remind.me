from pywebpush import webpush, WebPushException
import json
import os
from dotenv import load_dotenv

load_dotenv()

VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_CLAIMS = {"sub": os.getenv("VAPID_EMAIL")}

def send_web_push(subscription_info: dict, title: str, message: str):
    """Sends browser Web Push notification to a specific browser subscription."""
    if not subscription_info or not VAPID_PRIVATE_KEY:
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