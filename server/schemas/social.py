"""Friends, invites, shared reminders and the accountability buddy."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Three friends who join with your code unlock the bonus theme.
REWARD_INVITES = 3


class FriendOut(BaseModel):
    id: str
    username: str
    avatar_url: str | None = None
    streak: int = 0
    is_buddy: bool = False


class SocialSummary(BaseModel):
    invite_code: str
    invited_count: int
    reward_target: int = REWARD_INVITES
    reward_unlocked: bool
    friends: list[FriendOut]
    buddy_id: str | None = None


class JoinRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=4, max_length=16)

    @field_validator("code")
    @classmethod
    def _normalise(cls, v: str) -> str:
        return v.strip().upper().replace(" ", "").replace("-", "")


class JoinResponse(BaseModel):
    message: str
    friend: FriendOut


class SendReminderRequest(BaseModel):
    """A one-time reminder for a friend. It appears in their list, marked as coming from you."""

    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=200)
    due_date: datetime
    note: str | None = Field(default=None, max_length=500)

    @field_validator("title")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v


class BuddyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    friend_id: str | None = None
