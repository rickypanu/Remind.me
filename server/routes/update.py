from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone
import uuid

# Assuming these are correctly defined in your project
from routes.auth import get_current_user
from database import get_db 

router = APIRouter()

# --- Pydantic Models for Validation ---
class UpdateCreate(BaseModel):
    title: str
    content: str

class UpdateResponse(BaseModel):
    id: str
    title: str
    content: str
    created_at: str

# --- Security Dependency ---
async def verify_admin(current_user: dict = Depends(get_current_user)):
    """
    Reuses your existing get_current_user logic to fetch the user,
    then checks if they have admin rights.
    """
    if not current_user.get("is_admin", False):
        raise HTTPException(status_code=403, detail="Forbidden: Admin privileges required")
    return current_user

# --- Routes ---
@router.post("/user/updates", response_model=UpdateResponse)
async def create_update(
    update_data: UpdateCreate, 
    admin_user: dict = Depends(verify_admin), # Changed from bool to dict to match return type
    db = Depends(get_db)                      # 1. Inject the database dependency
):
    new_update = {
        "id": str(uuid.uuid4()),  # Storing custom string id to match your frontend mapping
        "title": update_data.title,
        "content": update_data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    # 2. Use MongoDB's insert_one instead of Python's list.insert()
    await db["updates"].insert_one(new_update)
    
    return new_update

@router.get("/user/updates", response_model=List[UpdateResponse])
async def get_updates(db = Depends(get_db)):  # 3. Inject the database dependency here too
    # 4. Fetch all updates from MongoDB and sort by newest first
    cursor = db["updates"].find({}).sort("created_at", -1)
    
    # 5. Convert the async cursor to a list (limit to 100 for safety, adjust as needed)
    updates = await cursor.to_list(length=100)
    
    return updates


@router.delete("/user/updates/{update_id}")
async def delete_update(
    update_id: str,
    admin_user: dict = Depends(verify_admin),
    db = Depends(get_db)
):
    # Attempt to delete the document matching the custom string 'id'
    result = await db["updates"].delete_one({"id": update_id})
    
    # If no document was deleted, the ID didn't exist
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Update not found")
        
    return {"message": "Update deleted successfully", "id": update_id}