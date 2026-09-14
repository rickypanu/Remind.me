from pydantic import BaseModel

class TelegramPayload(BaseModel):
    userId: str