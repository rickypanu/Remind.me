from pydantic import BaseModel, Field


class UpdateCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=5000)


class UpdateResponse(BaseModel):
    id: str
    title: str
    content: str
    created_at: str


class UpdateDeleted(BaseModel):
    message: str
    id: str
