from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import datetime, timezone
import uuid

# Assuming these are correctly defined in your project
from utils.security import get_current_user
from database import get_db 
from schemas.updates import UpdateCreate, UpdateResponse

router = APIRouter(tags=["User"])

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
@router.post("/updates", response_model=UpdateResponse)
async def create_update(
    update_data: UpdateCreate, 
    admin_user: dict = Depends(verify_admin), 
    db = Depends(get_db)
):
    new_update = {
        "id": str(uuid.uuid4()),  # Storing custom string id to match your frontend mapping
        "title": update_data.title,
        "content": update_data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db["updates"].insert_one(new_update)
    
    return new_update

@router.get("/updates", response_model=List[UpdateResponse])
async def get_updates(db = Depends(get_db)):
    # Fetch all updates from MongoDB and sort by newest first
    cursor = db["updates"].find({}).sort("created_at", -1)
    
    # Convert the async cursor to a list
    updates = await cursor.to_list(length=100)
    
    return updates

@router.delete("/updates/{update_id}")
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