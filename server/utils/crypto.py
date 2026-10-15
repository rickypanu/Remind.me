"""
Field-level encryption for private user content (reminder titles, notes, categories).

Design
------
* AES-256-GCM (authenticated encryption): tampering is detected on decrypt.
* A separate key is derived for every user with HKDF-SHA256 from a server-side
  master secret, so one user's key never decrypts another user's data.
* The user id and field name are bound into the ciphertext as "associated data",
  so a stored value cannot be copied to another user or another field.
* Only ciphertext is written to MongoDB. Plaintext exists only in memory while
  (a) the authenticated owner is reading their own reminders through the API, or
  (b) the scheduler is composing that owner's notification.

Configuration (server/.env)
---------------------------
REMINDER_ENCRYPTION_KEY            required. Generate one with:
                                     python -c "import secrets; print(secrets.token_urlsafe(48))"
REMINDER_ENCRYPTION_KEY_PREVIOUS   optional, comma separated. Old keys that may still
                                   decrypt existing data while you rotate keys.

Keep the master key out of the database and out of git. If it is lost, encrypted
reminders cannot be recovered.
"""
import base64
import os
from functools import lru_cache
from typing import Iterable, List

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

PREFIX = "enc:v1:"
_HKDF_SALT = b"remindme.reminder-encryption.v1"
UNREADABLE = "[This reminder could not be decrypted]"


class EncryptionConfigError(RuntimeError):
    pass


def _split_keys(raw: str) -> List[str]:
    return [k.strip(" '\"") for k in (raw or "").split(",") if k.strip(" '\"")]


def _master_keys() -> List[bytes]:
    current = os.getenv("REMINDER_ENCRYPTION_KEY", "").strip(" '\"")
    if len(current) < 32:
        raise EncryptionConfigError(
            "REMINDER_ENCRYPTION_KEY is missing or too short (min 32 chars). Generate one with: "
            'python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    keys = [current] + _split_keys(os.getenv("REMINDER_ENCRYPTION_KEY_PREVIOUS", ""))
    return [k.encode("utf-8") for k in keys]


def assert_encryption_configured() -> None:
    """Call at startup so a missing key fails loudly instead of at the first request."""
    _master_keys()


@lru_cache(maxsize=4096)
def _user_cipher(master: bytes, user_id: str) -> AESGCM:
    key = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_HKDF_SALT,
        info=b"user:" + user_id.encode("utf-8"),
    ).derive(master)
    return AESGCM(key)


def _aad(user_id: str, field: str) -> bytes:
    return f"{user_id}|{field}".encode("utf-8")


def is_encrypted(value) -> bool:
    return isinstance(value, str) and value.startswith(PREFIX)


def encrypt_text(user_id, field: str, plaintext) -> str | None:
    """Encrypt one value. None stays None; already-encrypted values are returned unchanged."""
    if plaintext is None:
        return None
    if is_encrypted(plaintext):
        return plaintext
    uid = str(user_id)
    nonce = os.urandom(12)
    ct = _user_cipher(_master_keys()[0], uid).encrypt(nonce, str(plaintext).encode("utf-8"), _aad(uid, field))
    return PREFIX + base64.urlsafe_b64encode(nonce + ct).decode("ascii")


def decrypt_text(user_id, field: str, value) -> str | None:
    """Decrypt one value. Legacy plaintext (no prefix) is passed through unchanged so
    reminders created before encryption was enabled keep working until migrated."""
    if value is None or not is_encrypted(value):
        return value
    uid = str(user_id)
    try:
        raw = base64.urlsafe_b64decode(value[len(PREFIX):].encode("ascii"))
    except Exception:
        return UNREADABLE
    nonce, ct = raw[:12], raw[12:]
    for master in _master_keys():
        try:
            return _user_cipher(master, uid).decrypt(nonce, ct, _aad(uid, field)).decode("utf-8")
        except InvalidTag:
            continue
    return UNREADABLE


def encrypt_fields(user_id, doc: dict, fields: Iterable[str]) -> dict:
    out = dict(doc)
    for f in fields:
        if f in out:
            out[f] = encrypt_text(user_id, f, out[f])
    return out


def decrypt_fields(user_id, doc: dict, fields: Iterable[str]) -> dict:
    out = dict(doc)
    for f in fields:
        if f in out:
            out[f] = decrypt_text(user_id, f, out[f])
    return out
