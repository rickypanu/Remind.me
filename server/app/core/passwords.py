"""Server-side password policy (finding S8).

The sign-up and reset forms already check these rules in the browser, but the browser is not a security
boundary: anyone can call the API directly. The same rules are therefore enforced here, and the messages are
written to be shown to the user as they are.

Rules (kept identical to the five checks the Register page shows):
  * 8 to 128 characters (the upper bound stops multi-megabyte inputs from being fed to argon2)
  * at least one uppercase letter, one lowercase letter, one digit and one special character
  * not a very common password, not one repeated character
  * must not contain the user's e-mail name or username (when those are known)
"""

import re
import unicodedata

MIN_LENGTH = 8
MAX_LENGTH = 128
MAX_BYTES = 512  # 128 characters can still be 512 bytes of UTF-8; cap bytes too

# Passwords that satisfy the character-class rules but appear at the top of every breach list.
_COMMON = frozenset(
    p.lower()
    for p in (
        "Password1!", "Password123!", "Password@123", "Password1@", "Passw0rd!", "P@ssw0rd", "P@ssword1",
        "P@ssw0rd1", "P@ssw0rd123", "Welcome1!", "Welcome@123", "Welcome123!", "Qwerty123!", "Qwerty@123",
        "Qwerty1!", "Admin@123", "Admin123!", "Admin@1234", "Abcd@1234", "Abc@1234", "Abc@12345", "Abcd1234!",
        "Test@1234", "Test@123", "Test1234!", "Letmein1!", "Iloveyou1!", "Iloveyou@1", "Monkey123!",
        "Dragon123!", "Football1!", "Football@1", "Cricket@123", "India@123", "India@1234", "India123!",
        "Delhi@123", "Student@123", "College@123", "Changeme1!", "Changeme@123", "Remindme1!", "Remindme@123",
        "Hello@123", "Hello123!", "Hello@1234", "Pa$$w0rd", "Pa$$word1", "Summer2024!", "Summer2025!",
        "Winter2024!", "Winter2025!", "Spring2025!", "Autumn2025!", "Google@123", "Google123!", "Master@123",
        "Shadow@123", "Sunshine1!", "Princess1!", "Trustno1!", "Whatever1!", "Zaq12wsx!", "1qaz@WSX",
        "1q2w3e4r!", "Q1w2e3r4!", "Aa123456!", "Aa@123456", "Aa@12345", "Asdf@1234", "Asdf1234!", "Zxcv@1234",
    )
)

_SPECIAL_RE = re.compile(r"[^A-Za-z0-9]")


def _fold(text: str) -> str:
    return unicodedata.normalize("NFKC", text).casefold()


def password_problems(password: str, *, email: str | None = None, username: str | None = None) -> list[str]:
    """Every rule the password breaks, as user-facing sentences (empty list = acceptable)."""
    problems: list[str] = []

    if len(password) < MIN_LENGTH:
        problems.append(f"Password must be at least {MIN_LENGTH} characters long.")
    if len(password) > MAX_LENGTH or len(password.encode("utf-8")) > MAX_BYTES:
        problems.append(f"Password must be at most {MAX_LENGTH} characters long.")
    if not re.search(r"[A-Z]", password):
        problems.append("Password must contain an uppercase letter.")
    if not re.search(r"[a-z]", password):
        problems.append("Password must contain a lowercase letter.")
    if not re.search(r"\d", password):
        problems.append("Password must contain a number.")
    if not _SPECIAL_RE.search(password):
        problems.append("Password must contain a special character.")
    if any(unicodedata.category(ch).startswith("C") for ch in password):
        problems.append("Password must not contain control characters.")

    if len(password) >= MIN_LENGTH and len(set(password)) == 1:
        problems.append("Password must not be one repeated character.")
    if password.lower() in _COMMON:
        problems.append("That password is too common. Choose something harder to guess.")

    folded = _fold(password)
    if email:
        local_part = _fold(email.split("@", 1)[0])
        if len(local_part) >= 4 and local_part in folded:
            problems.append("Password must not contain your email name.")
    if username:
        name = _fold(username)
        if len(name) >= 4 and name in folded:
            problems.append("Password must not contain your username.")

    return problems


def validate_password(password: str, *, email: str | None = None, username: str | None = None) -> str:
    """Return ``password`` unchanged or raise ``ValueError`` with the first problem (pydantic turns it into a 422)."""
    problems = password_problems(password, email=email, username=username)
    if problems:
        raise ValueError(problems[0])
    return password
