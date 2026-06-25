from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from bson import ObjectId # Add this import
from bson.errors import InvalidId # Add this import to handle bad strings

# Assuming these are imported correctly in your actual file
from routes.auth import get_current_user
from database import get_db

router = APIRouter()

@router.get("/me")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]), # Ensure this is cast to string for the frontend
        "username": current_user.get("username", "Student"),
        "email": current_user.get("email"),
        "created_at": current_user.get("created_at")
    }

@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_user_account(
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    try:
        raw_user_id = current_user["_id"] 
        
        # Convert string to ObjectId for MongoDB
        try:
            user_id_obj = ObjectId(raw_user_id) if isinstance(raw_user_id, str) else raw_user_id
        except InvalidId:
            raise HTTPException(status_code=400, detail="Invalid User ID format")

        # 1. Delete all tasks associated with this user.
        # Note: If your tasks collection saves user_id as a string instead of an ObjectId,
        # change `user_id_obj` back to `raw_user_id` in the line below.
        await db["tasks"].delete_many({"user_id": user_id_obj})

        # 2. Delete the user document itself
        delete_result = await db["users"].delete_one({"_id": user_id_obj})

        if delete_result.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User account could not be found."
            )

        return {"message": "Account and all associated data permanently deleted."}

    except HTTPException:
        # This catches the 404 (or 400) we explicitly raised above and lets it pass through
        # without triggering the generic 500 error below.
        raise 

    except Exception as e:
        print(f"Error deleting user: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while deleting the account."
        )