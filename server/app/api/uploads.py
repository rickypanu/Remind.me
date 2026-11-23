"""Serves stored avatars (findings S10, S11). Not versioned: stored ``avatar_url`` values point here.

Everything served is a WebP the server itself produced (see app/services/avatars.py). Rows written by the old upload
code may hold any client-supplied type, including SVG or HTML, so the stored content type is checked against an
allow-list and anything else is answered with 404 instead of being served from the API's origin.
"""

import re
from typing import Annotated

from fastapi import APIRouter, Path, Response

from app.api.deps import Db
from app.core.errors import NotFound
from app.repositories import AvatarRepository

router = APIRouter(tags=["Uploads"])

_NAME_RE = r"^[0-9a-f]{24}(\.webp)?$"
_SERVABLE_TYPES = frozenset({"image/webp", "image/jpeg", "image/png", "image/gif"})
_ID_RE = re.compile(r"^[0-9a-f]{24}")


@router.get("/uploads/avatars/{name}", include_in_schema=False)
async def get_avatar(name: Annotated[str, Path(pattern=_NAME_RE)], db: Db) -> Response:
    match = _ID_RE.match(name)
    doc = await AvatarRepository(db).get(match.group(0)) if match else None
    if not doc or doc.get("content_type") not in _SERVABLE_TYPES:
        raise NotFound("Avatar not found")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc["content_type"],
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": 'inline; filename="avatar"',
            # If a browser is ever navigated straight to this URL, nothing in the response may run or load anything.
            "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
            # The SPA lives on another origin and shows this image in an <img>, so it must be embeddable.
            "Cross-Origin-Resource-Policy": "cross-origin",
        },
    )
