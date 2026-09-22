import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile
from bson import ObjectId
from bson.errors import InvalidId

# Import your schema
from schemas.user import UserUpdate 

# Assuming these are imported from your project structure
from utils.security import get_current_user
from database import get_db

router = APIRouter()

ROOT_DIR = os.getcwd() 
AVATARS_DIR = os.path.join(ROOT_DIR, "uploads", "avatars")

os.makedirs(AVATARS_DIR, exist_ok=True)

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
    if not avatar.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    try:
        user_id_obj = ObjectId(current_user["_id"])
        file_extension = avatar.filename.split(".")[-1]
        file_name = f"{user_id_obj}.{file_extension}"
        
        # Create absolute path
        file_path = os.path.join(AVATARS_DIR, file_name)

        # 🛑 DEBUG PRINT: Check your terminal console for these exact lines when you upload!
        print(f"\n--- DEBUG INFO ---")
        print(f"SAVING TO: {file_path}")
        print(f"FILE EXISTS AFTER SAVE? {os.path.exists(file_path)}")
        print(f"------------------\n")

        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(avatar.file, buffer)

        avatar_url = f"/uploads/avatars/{file_name}"

        # Save this URL to the database
        await db["users"].update_one(
            {"_id": user_id_obj},
            {"$set": {"avatar_url": avatar_url}}
        )

        return {"avatar_url": avatar_url, "message": "Avatar uploaded successfully."}

    except Exception as e:
        print(f"Error uploading avatar: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload profile picture."
        )

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
            
        # Delete user's tasks first
        await db["tasks"].delete_many({"user_id": user_id_obj})

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