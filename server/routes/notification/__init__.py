from fastapi import APIRouter
from .telegram_setup import router as telegram_router 
from .telegram_notification import router as notification_sub_router
from .register_webpush import router as register_webpush_router
from .telegram_notification import start_scheduler_tele
from .webpush_notification import start_scheduler_web
from .telegram_broadcast import router as telegram_broadcast_router

# Create a distinct master router
notification_router = APIRouter() 

# Include the imported router into the master router
notification_router.include_router(telegram_router)
notification_router.include_router(notification_sub_router)
notification_router.include_router(register_webpush_router)
notification_router.include_router(telegram_broadcast_router)

__all__ = ["notification_router", "start_scheduler_tele", "start_scheduler_web", "telegram_broadcast_router"]
