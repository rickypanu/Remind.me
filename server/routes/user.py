from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel # Add this import
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId

from routes.auth import get_current_user
from database import get_db

router = APIRouter()

# 1. Add a Pydantic model for the incoming request
class FCMTokenUpdate(BaseModel):
    fcm_token: str | None = None # Allow null/empty to turn off notifications

@router.get("/me")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "username": current_user.get("username", "Student"),
        "email": current_user.get("email"),
        "created_at": current_user.get("created_at"),
        # Return true if they have a token saved
        "notifications_enabled": bool(current_user.get("fcm_token")) 
    }

# 2. Add the new route to save/remove the FCM token
@router.post("/fcm-token")
async def update_fcm_token(
    token_data: FCMTokenUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    try:
        user_id_obj = current_user["_id"]
        
        # Update the user's document with the new token (or empty string if turning off)
        await db["users"].update_one(
            {"_id": user_id_obj},
            {"$set": {"fcm_token": token_data.fcm_token}}
        )
        return {"message": "Notification preferences updated successfully"}
    except Exception as e:
        print(f"Error updating FCM token: {e}")
        raise HTTPException(status_code=500, detail="Failed to update notification settings")

@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_user_account(
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    try:
        raw_user_id = current_user["_id"] 
        
        try:
            user_id_obj = ObjectId(raw_user_id) if isinstance(raw_user_id, str) else raw_user_id
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid User ID format")
            
        await db["tasks"].delete_many({"user_id": user_id_obj})

        delete_result = await db["users"].delete_one({"_id": user_id_obj})

        if delete_result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User account could not be found."
            )

        return {"message": "Account and all associated data permanently deleted."}

    except HTTPException:
        raise 
    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the account."
        )