"""Small FastAPI dependencies shared by routes."""

from fastapi import HTTPException, Request

from app.notifications.dispatch import Notifier


def get_notifier(request: Request) -> Notifier:
    """The Notifier built during startup (lifespan). 503 if the app was started without it."""
    notifier = getattr(request.app.state, "notifier", None)
    if notifier is None:
        raise HTTPException(status_code=503, detail="Notifications are not available right now.")
    return notifier
