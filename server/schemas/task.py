from typing import Optional 
from datetime import datetime
from pydantic import BaseModel

# --- Pydantic Schemas ---
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    due_date: datetime
    status: str = "pending"

class TaskStatusUpdate(BaseModel):
    status: str

class TaskResponse(TaskCreate):
    id: str
    user_id: str