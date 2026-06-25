from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from bson import ObjectId
from database import get_db
from routes.auth import get_current_user

router = APIRouter()

# --- Pydantic Schemas ---
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    due_date: datetime
    status: str = "pending"

class TaskResponse(TaskCreate):
    id: str
    user_id: str

# --- API Routes ---
@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def add_task(task: TaskCreate, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    task_dict = task.dict()
    task_dict["user_id"] = current_user["_id"]
    
    result = await db["tasks"].insert_one(task_dict)
    
    # Format response
    task_dict["id"] = str(result.inserted_id)
    return task_dict

@router.get("/", response_model=List[TaskResponse])
async def get_tasks(current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    # Fetch only the tasks belonging to the logged-in user
    cursor = db["tasks"].find({"user_id": current_user["_id"]})
    tasks = await cursor.to_list(length=100)
    
    # Format ObjectId for JSON serialization
    formatted_tasks = []
    for task in tasks:
        task["id"] = str(task.pop("_id"))
        formatted_tasks.append(task)
        
    return formatted_tasks

@router.put("/{task_id}")
async def update_task_status(task_id: str, status: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")
        
    result = await db["tasks"].update_one(
        {"_id": ObjectId(task_id), "user_id": current_user["_id"]},
        {"$set": {"status": status}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Task not found or not modified")
        
    return {"message": "Task updated successfully"}

@router.delete("/{task_id}")
async def delete_task(task_id: str, current_user: dict = Depends(get_current_user), db = Depends(get_db)):
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task ID")
        
    result = await db["tasks"].delete_one(
        {"_id": ObjectId(task_id), "user_id": current_user["_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found or you are not authorized to delete it")
        
    return {"message": "Task deleted successfully"}