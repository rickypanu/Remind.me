from pydantic import BaseModel

class UpdateCreate(BaseModel):
    title: str
    content: str

class UpdateResponse(BaseModel):
    id: str
    title: str
    content: str
    created_at: str