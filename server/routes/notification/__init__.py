from fastapi import APIRouter
from .telegramsetup import router as telegram_router 
from .notification import router as notification_sub_router

from .notification import start_scheduler

# Create a distinct master router
notification_router = APIRouter() 

# Include the imported router into the master router
notification_router.include_router(telegram_router)
notification_router.include_router(notification_sub_router)

__all__ = ["notification_router", "start_scheduler"]