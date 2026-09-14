from fastapi import APIRouter
from .task import router as task_sub_router 
from .quicktask import router as quick_task_sub_router
# Create a distinct master router
task_router = APIRouter() 

# Include the sub-router correctly on a separate line
task_router.include_router(task_sub_router)
task_router.include_router(quick_task_sub_router)