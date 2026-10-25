"""Request schema for natural-language reminder creation."""

from pydantic import BaseModel, Field

from app.services.quick_add import MAX_MAGIC_TEXT


class MagicAddRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_MAGIC_TEXT)
