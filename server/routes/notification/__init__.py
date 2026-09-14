from fastapi import APIRouter
from routes.notification.telegramsetup import router as telegram_router 
from routes.notification.notification import router as notification_sub_router

# Create a distinct master router
notification_router = APIRouter() 

# Include the imported router into the master router
notification_router.include_router(telegram_router)
notification_router.include_router(notification_sub_router)