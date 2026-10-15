from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from utils.recurrence import (
    normalize_weekdays,
    parse_end_date,
    parse_time_of_day,
)

ScheduleType = Literal["once", "daily", "weekly"]


class TaskCreate(BaseModel):
    """
    Create a reminder.

    schedule_type:
      once    -> due_date is required (a specific date and time)
      daily   -> time_of_day ("HH:MM", IST) is required; due_date is calculated by the server
      weekly  -> time_of_day and weekdays (0 = Monday ... 6 = Sunday) are required
    ends_on ("YYYY-MM-DD", IST) optionally stops a daily / weekly series.
    """
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    category: str = Field(min_length=1, max_length=60)
    due_date: Optional[datetime] = None
    status: str = "pending"

    schedule_type: ScheduleType = "once"
    time_of_day: Optional[str] = None
    weekdays: List[int] = Field(default_factory=list)
    ends_on: Optional[str] = None

    @field_validator("title", "category")
    @classmethod
    def _strip_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be empty")
        return v

    @field_validator("description")
    @classmethod
    def _strip_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @model_validator(mode="after")
    def _validate_schedule(self):
        if self.schedule_type == "once":
            if self.due_date is None:
                raise ValueError("due_date is required for a one-time reminder")
            self.time_of_day, self.weekdays, self.ends_on = None, [], None
            return self

        if not self.time_of_day:
            raise ValueError("time_of_day (HH:MM) is required for daily and weekly reminders")
        t = parse_time_of_day(self.time_of_day)
        self.time_of_day = f"{t.hour:02d}:{t.minute:02d}"

        if self.schedule_type == "weekly":
            self.weekdays = normalize_weekdays(self.weekdays)
            if not self.weekdays:
                raise ValueError("Pick at least one weekday for a weekly reminder")
        else:
            self.weekdays = []

        if self.ends_on:
            parse_end_date(self.ends_on)
        else:
            self.ends_on = None
        return self


class TaskStatusUpdate(BaseModel):
    status: Literal["pending", "completed"]


class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    category: str
    due_date: Optional[datetime] = None
    status: str = "pending"

    schedule_type: ScheduleType = "once"
    time_of_day: Optional[str] = None
    weekdays: List[int] = Field(default_factory=list)
    ends_on: Optional[str] = None
    schedule_label: str = "One time"
    completed_count: int = 0
    last_completed_at: Optional[datetime] = None
