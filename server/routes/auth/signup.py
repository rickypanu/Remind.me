from datetime import datetime
from fastapi import APIRouter, HTTPException, status, Depends
from schemas.auth import UserCreate
from utils.security import get_password_hash
from database import get_db

router = APIRouter(prefix="", tags=["Auth"])

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user: UserCreate, db = Depends(get_db)):
    existing_user = await db["users"].find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.dict()
    user_dict["password_hash"] = get_password_hash(user_dict.pop("password"))
    user_dict["created_at"] = datetime.utcnow()
    
    await db["users"].insert_one(user_dict)
    return {"message": "User created successfully"}