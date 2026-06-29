from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
import random
import string

from routes.auth import get_current_user
from database import get_db

router = APIRouter(prefix="/squads", tags=["Squads"])

# --- Schemas ---
class SquadCreate(BaseModel):
    name: str
    goal: str

class SquadJoin(BaseModel):
    invite_code: str

class StatusUpdate(BaseModel):
    date_str: str  
    label: str
    emoji: str

class ChatMessage(BaseModel):
    text: str

def generate_invite_code(length=8):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))


# --- Core Routes ---

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_squad(
    squad_data: SquadCreate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    try:
        user_id = current_user["_id"]
        invite_code = f"sq_{generate_invite_code()}"

        new_squad = {
            "name": squad_data.name,
            "goal": squad_data.goal,
            "invite_code": invite_code,
            "created_at": datetime.utcnow(),
            "members": [
                {"user_id": user_id, "role": "Author", "joined_at": datetime.utcnow()}
            ],
            "status_options": [
                {"id": "1", "label": "Crushed it", "emoji": "🚀"},
                {"id": "2", "label": "Slacked off", "emoji": "🤡"},
                {"id": "3", "label": "Shallow/Cap", "emoji": "🧢"},
                {"id": "4", "label": "No Progress", "emoji": "❌"}
            ]
        }

        result = await db["squads"].insert_one(new_squad)
        
        await db["squad_feeds"].insert_one({
            "squad_id": result.inserted_id,
            "type": "system",
            "text": f"🎯 Squad '{squad_data.name}' was created.",
            "timestamp": datetime.utcnow()
        })

        return {"message": "Squad created successfully", "squad_id": str(result.inserted_id), "invite_code": invite_code}

    except Exception as e:
        print(f"Error creating squad: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.get("/my-squads", status_code=status.HTTP_200_OK)
async def get_my_squads(
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    user_id = current_user["_id"]
    cursor = db["squads"].find({"members.user_id": user_id})
    squads = await cursor.to_list(length=50)

    formatted_squads = []
    for squad in squads:
        user_role = next((m["role"] for m in squad["members"] if m["user_id"] == user_id), "Member")
        formatted_squads.append({
            "id": str(squad["_id"]),
            "name": squad["name"],
            "members": len(squad["members"]),
            "role": user_role
        })

    return formatted_squads


@router.post("/join", status_code=status.HTTP_200_OK)
async def join_squad(
    join_data: SquadJoin,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    user_id = current_user["_id"]
    username = current_user.get("username", "A new member")

    squad = await db["squads"].find_one({"invite_code": join_data.invite_code})
    
    if not squad:
        raise HTTPException(status_code=404, detail="Invalid invite code.")

    if any(m["user_id"] == user_id for m in squad["members"]):
        raise HTTPException(status_code=400, detail="You are already in this squad.")

    new_member = {"user_id": user_id, "role": "Member", "joined_at": datetime.utcnow()}
    await db["squads"].update_one(
        {"_id": squad["_id"]},
        {"$push": {"members": new_member}}
    )

    await db["squad_feeds"].insert_one({
        "squad_id": squad["_id"],
        "type": "system",
        "text": f"👋 {username} just joined the squad!",
        "timestamp": datetime.utcnow()
    })

    return {"message": "Joined squad successfully", "squad_id": str(squad["_id"])}


# --- Dynamic Squad ID Routes ---

@router.get("/{squad_id}", status_code=status.HTTP_200_OK)
async def get_squad_details(
    squad_id: str, 
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    try:
        sq_id_obj = ObjectId(squad_id)
        squad = await db["squads"].find_one({"_id": sq_id_obj})
        
        if not squad:
            raise HTTPException(status_code=404, detail="Squad not found")
            
        members_data = []
        for member in squad["members"]:
            user = await db["users"].find_one({"_id": ObjectId(member["user_id"])})
            username = user.get("username", "Unknown") if user else "Unknown"
            
            members_data.append({
                "id": str(member["user_id"]),
                "name": username,
                "role": member["role"],
                "isOnline": False 
            })
        
        squad["id"] = str(squad["_id"])
        del squad["_id"]
        squad["members"] = members_data
        
        return squad

    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid Squad ID")


@router.get("/{squad_id}/chat", status_code=status.HTTP_200_OK)
async def get_squad_chat(
    squad_id: str, 
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    try:
        sq_id_obj = ObjectId(squad_id)
        cursor = db["squad_feeds"].find({"squad_id": sq_id_obj}).sort("timestamp", 1)
        feeds = await cursor.to_list(length=150) 
        
        formatted_feeds = []
        for f in feeds:
            formatted_feeds.append({
                "id": str(f["_id"]),
                "type": f["type"],
                "userId": f.get("user_id"),
                "userName": f.get("user_name"),
                "text": f["text"],
                "timestamp": f["timestamp"].isoformat() if isinstance(f["timestamp"], datetime) else f["timestamp"]
            })
        
        return formatted_feeds

    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid Squad ID")


@router.post("/{squad_id}/chat", status_code=status.HTTP_201_CREATED)
async def send_chat_message(
    squad_id: str,
    chat_data: ChatMessage,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    try:
        sq_id_obj = ObjectId(squad_id)
        new_msg = {
            "squad_id": sq_id_obj,
            "type": "chat",
            "user_id": str(current_user["_id"]),
            "user_name": current_user.get("username", "Student"),
            "text": chat_data.text,
            "timestamp": datetime.utcnow()
        }

        await db["squad_feeds"].insert_one(new_msg)
        return {"message": "Message sent"}

    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid Squad ID")


@router.get("/{squad_id}/status", status_code=status.HTTP_200_OK)
async def get_daily_status(
    squad_id: str, 
    date_str: str, 
    current_user: dict = Depends(get_current_user), 
    db = Depends(get_db)
):
    try:
        sq_id_obj = ObjectId(squad_id)
        ledger = await db["squad_ledgers"].find_one({
            "squad_id": sq_id_obj, 
            "date_str": date_str
        })
        
        if not ledger:
            return {"entries": {}}
            
        return {"entries": ledger.get("entries", {})}

    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid Squad ID")
    

@router.post("/{squad_id}/status", status_code=status.HTTP_200_OK)
async def update_daily_status(
    squad_id: str,
    status_data: StatusUpdate,
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    try:
        sq_id_obj = ObjectId(squad_id)
        user_id = current_user["_id"]
        username = current_user.get("username", "Student")

        ledger_query = {"squad_id": sq_id_obj, "date_str": status_data.date_str}
        update_data = {
            f"entries.{str(user_id)}": {
                "label": status_data.label,
                "emoji": status_data.emoji
            }
        }

        await db["squad_ledgers"].update_one(
            ledger_query,
            {"$set": update_data},
            upsert=True
        )

        await db["squad_feeds"].insert_one({
            "squad_id": sq_id_obj,
            "type": "system",
            "text": f"📢 {username} logged status as '{status_data.emoji} {status_data.label}' for {status_data.date_str}",
            "timestamp": datetime.utcnow()
        })

        return {"message": "Status updated"}

    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid Squad ID")