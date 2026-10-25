"""Test bootstrap for the auth / security tests.

Import this module FIRST in a test file. It

  * puts server/ on sys.path and fills in a valid test environment (SECRET_KEY etc.),
  * replaces a third-party package with a small stand-in ONLY when that package is not installed
    (bson, httpx, fastapi, argon2, bcrypt, slowapi, pymongo.errors.DuplicateKeyError).

On a normal developer machine, where ``pip install -r requirements-dev.txt`` has been run, nothing is replaced and
the tests run against the real libraries. In a minimal sandbox the stand-ins keep the logic under test (token
claims, session rotation, reset flow, route orchestration) runnable; password hashing is then a fake, so run the
suite on a full install before trusting the hashing behaviour.
"""

import hashlib
import importlib
import os
import sys
import types
from datetime import UTC, datetime

SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

os.environ.update(
    {
        "ENVIRONMENT": "test",
        "SECRET_KEY": "Qm7vX2pLr9TzK4wYb8NcJ3hFd6SgU1aE5oIxV0eRt",
        "REMINDER_ENCRYPTION_KEY": "Hn3Zc8Ws1Ke6Dy9Bq4Pj7Lt2Vf5Gm0Ua8Rx3Ni6Oo1Xb",
        "FRONTEND_URL": "https://app.example.test",
        "CORS_ORIGINS": "https://app.example.test",
        "RATE_LIMIT_ENABLED": "false",
    }
)
os.environ.pop("BREVO_API_KEY", None)


def _missing(name: str) -> bool:
    try:
        importlib.import_module(name)
        return False
    except ImportError:
        return True


def _module(name: str, **attrs) -> types.ModuleType:
    mod = types.ModuleType(name)
    mod.__dict__.update(attrs)
    sys.modules[name] = mod
    parent, _, child = name.rpartition(".")
    if parent and parent in sys.modules:
        setattr(sys.modules[parent], child, mod)
    return mod


# ------------------------------------------------------------------------------------------------ bson
if _missing("bson"):

    class InvalidId(Exception):
        pass

    class ObjectId:
        def __init__(self, value=None):
            if value is None:
                value = hashlib.sha1(os.urandom(8)).hexdigest()[:24]
            if isinstance(value, ObjectId):
                value = value._v
            if not isinstance(value, str) or len(value) != 24 or any(c not in "0123456789abcdef" for c in value):
                raise InvalidId(f"{value!r} is not a valid ObjectId")
            self._v = value

        @classmethod
        def is_valid(cls, value):
            try:
                cls(value)
                return True
            except InvalidId:
                return False

        def __str__(self):
            return self._v

        def __repr__(self):
            return f"ObjectId('{self._v}')"

        def __eq__(self, other):
            return isinstance(other, ObjectId) and other._v == self._v

        def __hash__(self):
            return hash(self._v)

        # Real ObjectIds order by creation; the delta-sync cursor compares ``_id`` values, so the stand-in needs it.
        def __lt__(self, other):
            return self._v < other._v

        def __le__(self, other):
            return self._v <= other._v

        def __gt__(self, other):
            return self._v > other._v

        def __ge__(self, other):
            return self._v >= other._v

    bson = _module("bson", ObjectId=ObjectId, Binary=bytes)
    _module("bson.errors", InvalidId=InvalidId)
    bson.errors = sys.modules["bson.errors"]

# ------------------------------------------------------------------------------------------------ pymongo
import pymongo.errors as _pm_errors  # noqa: E402  (the repo's real package, or the sandbox stub)

if not hasattr(_pm_errors, "DuplicateKeyError"):

    class DuplicateKeyError(_pm_errors.PyMongoError):
        pass

    _pm_errors.DuplicateKeyError = DuplicateKeyError

# ------------------------------------------------------------------------------------------------ httpx
if _missing("httpx"):

    class _Timeout:
        def __init__(self, *a, **k):
            pass

    class _Response:
        status_code = 200

        def raise_for_status(self):
            return None

    class AsyncClient:
        sent: list[dict] = []

        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def post(self, url, headers=None, json=None):
            AsyncClient.sent.append({"url": url, "headers": headers, "json": json})
            return _Response()

    class HTTPError(Exception):
        pass

    class _Limits:
        def __init__(self, *a, **k):
            pass

    _module("httpx", AsyncClient=AsyncClient, Timeout=_Timeout, HTTPError=HTTPError, Limits=_Limits)

# ------------------------------------------------------------------------------------------------ argon2 / bcrypt
if _missing("argon2"):

    class VerificationError(Exception):
        pass

    class InvalidHashError(Exception):
        pass

    class PasswordHasher:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def hash(self, password):
            return "$argon2id$fake$" + hashlib.sha256(password.encode()).hexdigest()

        def verify(self, hashed, password):
            if hashed != self.hash(password):
                raise VerificationError()
            return True

        def check_needs_rehash(self, hashed):
            return False

    _module("argon2", PasswordHasher=PasswordHasher)
    _module("argon2.exceptions", VerificationError=VerificationError, InvalidHashError=InvalidHashError)
    sys.modules["argon2"].exceptions = sys.modules["argon2.exceptions"]

if _missing("bcrypt"):
    _module("bcrypt", checkpw=lambda pw, hashed: False)

# ------------------------------------------------------------------------------------------------ fastapi
if _missing("fastapi"):

    class HTTPException(Exception):
        def __init__(self, status_code, detail=None, headers=None):
            super().__init__(detail)
            self.status_code, self.detail, self.headers = status_code, detail, headers

    class _Router:
        def __init__(self, *a, **k):
            pass

        def _deco(self, *a, **k):
            return lambda fn: fn

        get = post = patch = delete = put = api_route = _deco

        def include_router(self, *a, **k):
            return None

    class Request:
        def __init__(self, headers=None, client_host="203.0.113.9"):
            self.headers = {k.lower(): v for k, v in (headers or {}).items()}
            self.client = types.SimpleNamespace(host=client_host) if client_host else None

    class BackgroundTasks:
        def __init__(self):
            self.tasks = []

        def add_task(self, fn, *args, **kwargs):
            self.tasks.append((fn, args, kwargs))

        async def run(self):
            for fn, args, kwargs in self.tasks:
                await fn(*args, **kwargs)

    class _Resp:
        def __init__(self, content=None, status_code=200, headers=None, media_type=None):
            self.body, self.status_code, self.headers, self.media_type = content, status_code, headers or {}, media_type

    status = types.SimpleNamespace(
        HTTP_200_OK=200, HTTP_201_CREATED=201, HTTP_400_BAD_REQUEST=400, HTTP_401_UNAUTHORIZED=401,
        HTTP_404_NOT_FOUND=404, HTTP_409_CONFLICT=409, HTTP_422_UNPROCESSABLE_ENTITY=422,
        HTTP_500_INTERNAL_SERVER_ERROR=500,
    )
    _module(
        "fastapi",
        APIRouter=_Router, Depends=lambda dep=None: dep, HTTPException=HTTPException, Request=Request,
        BackgroundTasks=BackgroundTasks, UploadFile=object, File=lambda *a, **k: None,
        Path=lambda *a, **k: None, Query=lambda *a, **k: k.get("default"), Response=_Resp, FastAPI=object,
        status=status,
        Body=lambda *a, **k: k.get("default"), Header=lambda *a, **k: k.get("default"),
    )
    _module("fastapi.responses", JSONResponse=_Resp)
    _module(
        "fastapi.security",
        OAuth2PasswordBearer=lambda **k: None,
        OAuth2PasswordRequestForm=type(
            "OAuth2PasswordRequestForm", (), {"__init__": lambda self, username="", password="": setattr(self, "username", username) or setattr(self, "password", password)}
        ),
    )

# ------------------------------------------------------------------------------------------------ slowapi
if _missing("slowapi"):

    class Limiter:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

        def limit(self, *a, **k):
            return lambda fn: fn

        def exempt(self, fn):
            return fn

    class RateLimitExceeded(Exception):
        detail = ""

    _module("slowapi", Limiter=Limiter)
    _module("slowapi.errors", RateLimitExceeded=RateLimitExceeded)

# ------------------------------------------------------------------------------------------------ apscheduler
if _missing("apscheduler"):

    class AsyncIOScheduler:
        instances: list = []

        def __init__(self, **kwargs):
            self.jobs, self.started, self.kwargs = [], False, kwargs
            AsyncIOScheduler.instances.append(self)

        def add_job(self, func, trigger, **kwargs):
            self.jobs.append({"func": func, "trigger": trigger, **kwargs})

        def start(self):
            self.started = True

        def shutdown(self, wait=True):
            self.started = False

    class _Trigger:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    _module("apscheduler")
    _module("apscheduler.schedulers")
    _module("apscheduler.schedulers.asyncio", AsyncIOScheduler=AsyncIOScheduler)
    _module("apscheduler.triggers")
    _module("apscheduler.triggers.cron", CronTrigger=type("CronTrigger", (_Trigger,), {}))
    _module("apscheduler.triggers.interval", IntervalTrigger=type("IntervalTrigger", (_Trigger,), {}))

# ------------------------------------------------------------------------------------------------ google-genai
if _missing("google.genai"):

    class _Record:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.__dict__.update(kwargs)

    class _Content(_Record):
        pass

    class _Part(_Record):
        pass

    class _Config(_Record):
        pass

    class _HttpOptions(_Record):
        pass

    class _Client:
        calls: list = []
        reply = "{}"

        def __init__(self, api_key=None, http_options=None):
            self.api_key = api_key
            outer = self

            class _Models:
                async def generate_content(self, model, contents, config):
                    _Client.calls.append({"key": outer.api_key, "model": model, "contents": contents, "config": config})
                    return types.SimpleNamespace(text=_Client.reply)

            self.aio = types.SimpleNamespace(models=_Models())

    _google = sys.modules.get("google") or _module("google")
    _types = _module("google.genai.types", Content=_Content, Part=_Part, GenerateContentConfig=_Config, HttpOptions=_HttpOptions)
    class APIError(Exception):
        """Shaped like google.genai.errors.APIError: (code, response_json) -> .code / .status / .message."""

        def __init__(self, code, response_json=None, response=None):
            error = response_json.get("error", {}) if isinstance(response_json, dict) else {}
            self.code, self.status, self.message = code, error.get("status", ""), error.get("message", "")
            super().__init__(f"{code} {self.status}. {self.message}")

    class ClientError(APIError):
        pass

    class ServerError(APIError):
        pass

    _errors = _module("google.genai.errors", APIError=APIError, ClientError=ClientError, ServerError=ServerError)
    _genai = _module("google.genai", Client=_Client, types=_types, errors=_errors)
    _google.genai = _genai

def utcnow() -> datetime:
    return datetime.now(UTC)
