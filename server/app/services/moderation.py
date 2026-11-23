"""Content moderation as domain errors (the keyword filter itself lives in ``utils.moderation``).

``utils.moderation.enforce`` raises ``HTTPException``; services must not know about HTTP, so they use these.
"""

from app.core.errors import Unprocessable
from utils.moderation import CATEGORY_MESSAGES, check_text

CONTENT_REJECTED = "content_rejected"


def ensure_allowed(*texts: str | None) -> None:
    """Raise ``Unprocessable`` (422) with a user-facing message if any text is not allowed."""
    result = check_text(*texts)
    if not result.allowed:
        raise Unprocessable(result.message, code=CONTENT_REJECTED)


def reject_ai_flagged() -> None:
    raise Unprocessable(CATEGORY_MESSAGES["ai_flagged"], code=CONTENT_REJECTED)
