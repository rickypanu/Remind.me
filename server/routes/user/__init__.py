from fastapi import APIRouter
from routes.user.user import router as user_sub_router 
from routes.user.update import router as update_router

# Create a distinct master router
user_router = APIRouter() 

# Include the imported router into the master router
user_router.include_router(user_sub_router)
user_router.include_router(update_router) 