"""/v1/updates: announcements for the Updates page. Reading is public; writing needs an admin account."""

from fastapi import APIRouter

from app.api.deps import AdminUser, AnnouncementSvc
from schemas.updates import UpdateCreate, UpdateDeleted, UpdateResponse

router = APIRouter(tags=["Updates"])


@router.get("", response_model=list[UpdateResponse])
async def list_updates(updates: AnnouncementSvc) -> list[dict]:
    return await updates.latest(100)


@router.post("", response_model=UpdateResponse)
async def create_update(data: UpdateCreate, _admin: AdminUser, updates: AnnouncementSvc) -> dict:
    return await updates.create(data.title, data.content)


@router.delete("/{update_id}", response_model=UpdateDeleted)
async def delete_update(update_id: str, _admin: AdminUser, updates: AnnouncementSvc) -> UpdateDeleted:
    await updates.delete(update_id)
    return UpdateDeleted(message="Update deleted successfully", id=update_id)
