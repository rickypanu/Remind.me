from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
import re

# Import your existing dependencies
from routes.auth import get_current_user
from database import get_db

# We use the same prefix so the frontend URL (/squads/{squad_id}/analytics) works perfectly
router = APIRouter(prefix="/squads", tags=["Squad Analytics"])

@router.get("/{squad_id}/analytics", status_code=status.HTTP_200_OK)
async def get_squad_analytics(
    squad_id: str,
    month: str,  # Expected format from frontend: "YYYY-MM" (e.g., "2026-07")
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    try:
        sq_id_obj = ObjectId(squad_id)
        
        # 1. Fetch the Squad and members
        squad = await db["squads"].find_one({"_id": sq_id_obj})
        if not squad:
            raise HTTPException(status_code=404, detail="Squad not found")

        # 2. Fetch actual usernames for all members
        members_dict = {}
        for member in squad["members"]:
            user_id_str = str(member["user_id"])
            user = await db["users"].find_one({"_id": ObjectId(user_id_str)})
            username = user.get("username", "Unknown") if user else "Unknown"
            
            members_dict[user_id_str] = {
                "id": user_id_str,
                "name": username,
                "role": member["role"]
            }

        # 3. Parse the YYYY-MM string to match JS toDateString() format
        # Example: "2026-07" -> month_abbr="Jul", year_str="2026"
        target_date = datetime.strptime(month, "%Y-%m")
        month_abbr = target_date.strftime("%b")
        year_str = target_date.strftime("%Y")

        # 4. Fetch ledgers for this month using MongoDB regex
        # Matches strings like "Wed Jul 01 2026"
        regex_pattern = f"{month_abbr} \\d{{2}} {year_str}"
        cursor = db["squad_ledgers"].find({
            "squad_id": sq_id_obj,
            "date_str": {"$regex": regex_pattern}
        })
        ledgers = await cursor.to_list(length=35) # Max days in a month is 31

        # 5. Initialize stats structure
        stats = {}
        for uid, member_info in members_dict.items():
            stats[uid] = {
                "member": member_info,
                "logs": {},
                "counts": {}
            }

        # 6. Populate the stats
        for ledger in ledgers:
            date_str = ledger.get("date_str", "")
            
            try:
                # Extract day (e.g., "Wed Jul 01 2026" -> "01" -> 1)
                parts = date_str.split(" ")
                if len(parts) >= 3:
                    day_int = int(parts[2])
                else:
                    continue
            except Exception:
                continue 

            entries = ledger.get("entries", {})
            for uid, entry in entries.items():
                if uid in stats:
                    label = entry.get("label")
                    emoji = entry.get("emoji")
                    
                    # Save the daily log
                    stats[uid]["logs"][str(day_int)] = {
                        "emoji": emoji,
                        "label": label
                    }
                    
                    # Increment the leaderboard count
                    stats[uid]["counts"][label] = stats[uid]["counts"].get(label, 0) + 1

        return {"member_stats": list(stats.values())}

    except InvalidId:
        raise HTTPException(status_code=400, detail="Invalid Squad ID")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    except Exception as e:
        print(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")