"""Repositories: the ONLY code that talks to MongoDB (finding A1).

    * They take and return plain dicts / ObjectIds, and know nothing about HTTP.
    * ``TaskRepository`` is also where reminder text is encrypted and decrypted, so "encrypt before write" is
      enforced by structure instead of by convention.
    * Services (``app/services``) hold the business rules and call repositories; routes (``app/api``) only
      translate HTTP to a service call and back.
"""

from app.repositories.announcements import AnnouncementRepository
from app.repositories.avatars import AvatarRepository
from app.repositories.completions import CompletionRepository
from app.repositories.locks import LockRepository
from app.repositories.password_resets import PasswordResetRepository
from app.repositories.sessions import SessionRepository
from app.repositories.tasks import TaskRepository
from app.repositories.telegram_tokens import LinkTokenRepository
from app.repositories.users import UserRepository

__all__ = [
    "AnnouncementRepository",
    "AvatarRepository",
    "CompletionRepository",
    "LinkTokenRepository",
    "LockRepository",
    "PasswordResetRepository",
    "SessionRepository",
    "TaskRepository",
    "UserRepository",
]
