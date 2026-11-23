"""Natural-language "magic add": reads one sentence with the rule parser (utils/quick_parse.py), checks it
with the moderation filter, and builds a ``TaskCreate``. No AI, no network, no quota. HTTP-free."""

import logging
from datetime import datetime, timezone

from pydantic import ValidationError

from app.core.errors import AppError, InternalError, Unprocessable
from app.services.moderation import ensure_allowed
from app.services.tasks import TaskService
from schemas.task import TaskCreate
from utils.quick_parse import parse_quick
from utils.timezone import IST, ist_now_floor_minute

log = logging.getLogger("quick_add")

MAX_MAGIC_TEXT = 500
_CATEGORIES = {"Assignment", "Project", "Exam / Quiz", "Placement / Internship", "Extracurricular", "Personal", "Other"}


def _to_task_create(parsed: dict) -> TaskCreate:
    """Turn the parser's result into a ``TaskCreate`` (due date: epoch ms -> aware IST datetime)."""
    p = parsed["payload"]
    stype = p.get("schedule_type") or "once"
    due: datetime | None = None
    if stype == "once":
        due = datetime.fromtimestamp(p["due_date"] / 1000, tz=timezone.utc).astimezone(IST)
    category = p.get("category") if p.get("category") in _CATEGORIES else "Other"
    return TaskCreate(
        title=p.get("title") or "",
        description=p.get("description"),
        category=category,
        due_date=due,
        schedule_type=stype,
        time_of_day=p.get("time_of_day") if stype != "once" else None,
        weekdays=p.get("weekdays") or [] if stype == "weekly" else [],
    )


def understand_text(text: str, now: datetime | None = None) -> TaskCreate:
    """The rule parser + validation. ``now`` (IST) is only for tests."""
    parsed = parse_quick(text, int((now or ist_now_floor_minute()).timestamp() * 1000))
    if parsed is None:
        raise ValueError("empty sentence")
    return _to_task_create(parsed)


class QuickAddService:
    def __init__(self, tasks: TaskService) -> None:
        self.tasks = tasks

    async def _understand(self, text: str) -> TaskCreate:
        """Moderation + rule parser + validation. Shared by ``add`` (creates) and ``parse`` (only reads the sentence)."""
        ensure_allowed(text)
        try:
            task = understand_text(text)
            ensure_allowed(task.title, task.description, task.category)
            return task
        except AppError:
            raise  # moderation / validation messages go straight to the user
        except (ValidationError, ValueError, KeyError) as exc:
            log.info("Magic add could not parse: %s", exc)
            raise Unprocessable(
                "Couldn't understand that. Try something like \"Gym every Monday at 7am\" or use the form."
            ) from None
        except Exception:  # noqa: BLE001 - the user gets a calm message, the log gets the traceback
            log.exception("Magic add error")
            raise InternalError("Something went wrong while adding your reminder. Please try again.") from None

    async def add(self, user_id, text: str) -> dict:
        task = await self._understand(text)
        return await self.tasks.create(user_id, task)

    async def parse(self, text: str) -> dict:
        """Read the sentence and return the reminder fields WITHOUT saving anything."""
        task = await self._understand(text)
        return task.model_dump(mode="json", include={"title", "description", "category", "due_date", "schedule_type", "time_of_day", "weekdays"})
