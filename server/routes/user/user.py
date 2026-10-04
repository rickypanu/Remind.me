from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from bson import ObjectId, Binary
from bson.errors import InvalidId

from schemas.user import UserUpdate 

# Assuming these are imported from your project structure
from utils.security import get_current_user
from database import get_db

router = APIRouter(tags=["User"])

MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB

# --- 1. Route to Get User Profile ---
@router.get("/me")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    return {
        "id": str(current_user["_id"]),
        "username": current_user.get("username", "Student"),
        "email": current_user.get("email"),
        "created_at": current_user.get("created_at"),
        "avatar_url": current_user.get("avatar_url"), 
        "is_admin": current_user.get("is_admin", False)
    }

# --- 2. Route to Update Name / Details ---
@router.patch("/me", status_code=status.HTTP_200_OK)
async def update_user_details(
    update_data: UserUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    # Only extract fields that were actually provided in the request
    update_dict = update_data.model_dump(exclude_unset=True)
    
    if not update_dict:
        raise HTTPException(status_code=400, detail="No valid fields provided for update.")

    try:
        user_id_obj = ObjectId(current_user["_id"])
        
        await db["users"].update_one(
            {"_id": user_id_obj},
            {"$set": update_dict}
        )
        
        return {"message": "Profile updated successfully", "updated_fields": update_dict}
        
    except Exception as e:
        print(f"Error updating user details: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while updating the profile."
        )



@router.post("/avatar")
async def upload_avatar(
    avatar: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    if not avatar.content_type or not avatar.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    data = await avatar.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Image must be under 2 MB.")

    user_id_str = str(current_user["_id"])

    # Store the image bytes in MongoDB instead of the server's disk
    await db["avatars"].update_one(
        {"_id": user_id_str},
        {"$set": {"data": Binary(data), "content_type": avatar.content_type}},
        upsert=True,
    )

    # ?v=... busts the browser cache when the user uploads a new picture
    avatar_url = f"/uploads/avatars/{user_id_str}?v={int(datetime.now(timezone.utc).timestamp())}"
    await db["users"].update_one(
        {"_id": ObjectId(user_id_str)},
        {"$set": {"avatar_url": avatar_url}},
    )
    return {"avatar_url": avatar_url, "message": "Avatar uploaded successfully."}

# --- 4. Route to Delete Account ---
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
            
         # Delete user's tasks (tasks store user_id as a string)
        await db["tasks"].delete_many({"user_id": str(user_id_obj)})

        # Delete the user's uploaded avatar
        await db["avatars"].delete_one({"_id": str(user_id_obj)})

        # Delete the user
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