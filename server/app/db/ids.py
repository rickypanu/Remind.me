"""The ONE place identifiers change type (finding A3).

Canonical types in MongoDB:  ``users._id``  and  ``tasks.user_id``  are ``ObjectId``.
The API speaks strings, so conversion happens at the edge (an incoming request, an outgoing response) and nowhere
else. The old code compared strings with ObjectIds in different places, which is how a string-keyed "shadow user"
document came into existence (the Telegram webhook upserted ``{"_id": "<string>"}``).
"""

from typing import Any

from bson import ObjectId
from bson.errors import InvalidId


def to_object_id(value: Any) -> ObjectId | None:
    """``ObjectId`` for an ObjectId or a 24-hex string, otherwise ``None`` (never raises)."""
    if isinstance(value, ObjectId):
        return value
    if isinstance(value, str) and len(value) == 24:
        try:
            return ObjectId(value)
        except (InvalidId, TypeError):
            return None
    return None
