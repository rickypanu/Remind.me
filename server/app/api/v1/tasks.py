"""/v1/tasks: reminders and delta sync. Paths have NO trailing slash and nothing redirects (finding A6)."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, Request, status

from app.api.deps import QuickAddSvc, TaskSvc, UserId
from app.core.rate_limit import Limits, limiter
from schemas.auth import MessageResponse
from schemas.task import (
    TaskCreate,
    TaskResponse,
    TaskStatsResponse,
    TaskStatusResponse,
    TaskStatusUpdate,
    TaskSyncPage,
    TaskUpdate,
)
from schemas.tasks_ai import MagicAddRequest

router = APIRouter(tags=["Task"])


@router.get("", response_model=TaskSyncPage)
async def list_tasks(
    user_id: UserId,
    tasks: TaskSvc,
    since: Annotated[datetime | None, Query(description="Only changes at or after this UTC time (ISO 8601)")] = None,
    cursor: Annotated[str | None, Query(max_length=100, description="`next_cursor` of the previous page")] = None,
    limit: Annotated[int | None, Query(ge=1, le=500, description="Page size (default 200, max 500)")] = None,
) -> TaskSyncPage:
    """Delta sync. First call without a cursor = full snapshot; afterwards send back ``next_cursor``.

    ``since`` and ``cursor`` are alternatives. A cursor older than the tombstone retention returns 410
    (``code="full_resync_required"``): download everything again, without a cursor.
    """
    page = await tasks.list_changes(user_id, since=since, cursor=cursor, limit=limit)
    return TaskSyncPage(**page.__dict__)


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, user_id: UserId, tasks: TaskSvc) -> dict:
    """Idempotent per ``client_id``: a retried create returns the reminder that was already stored."""
    return await tasks.create(user_id, payload)


@router.post("/magic-add", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(Limits.magic_add)  # every call spends AI quota, so it is limited per user (S5)
async def magic_add(request: Request, payload: MagicAddRequest, user_id: UserId, quick: QuickAddSvc) -> dict:
    return await quick.add(user_id, payload.text)


@router.get("/stats", response_model=TaskStatsResponse)
async def task_stats(user_id: UserId, tasks: TaskSvc) -> dict:
    """Streak and today's completions. Declared before ``/{task_id}`` so "stats" is never read as an id."""
    return await tasks.stats(user_id)


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(task_id: str, user_id: UserId, tasks: TaskSvc) -> dict:
    return await tasks.get(user_id, task_id)


@router.put("/{task_id}", response_model=TaskResponse)
async def edit_task(task_id: str, payload: TaskUpdate, user_id: UserId, tasks: TaskSvc) -> dict:
    """Edit a reminder's text / time. (Completing a reminder goes through PATCH.)"""
    return await tasks.update(user_id, task_id, payload)


@router.patch("/{task_id}", response_model=TaskStatusResponse)
async def set_task_status(task_id: str, payload: TaskStatusUpdate, user_id: UserId, tasks: TaskSvc) -> dict:
    return await tasks.set_status(user_id, task_id, payload)


@router.delete("/{task_id}", response_model=MessageResponse)
async def delete_task(task_id: str, user_id: UserId, tasks: TaskSvc) -> MessageResponse:
    """Deleting leaves a tombstone so other devices learn about it through delta sync."""
    await tasks.delete(user_id, task_id)
    return MessageResponse(message="Task deleted successfully")
