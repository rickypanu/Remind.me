"""Lets the pure-logic tests run even where FastAPI / google-genai are not installed."""
import sys
import types as _types


def install():
    try:
        import fastapi  # noqa: F401
    except ImportError:
        m = _types.ModuleType("fastapi")

        class HTTPException(Exception):
            def __init__(self, status_code, detail=None, headers=None):
                self.status_code, self.detail = status_code, detail

        m.HTTPException = HTTPException
        m.status = _types.SimpleNamespace(HTTP_422_UNPROCESSABLE_ENTITY=422)
        sys.modules["fastapi"] = m

    try:
        from google import genai  # noqa: F401
    except ImportError:
        google = sys.modules.setdefault("google", _types.ModuleType("google"))
        google.__path__ = getattr(google, "__path__", [])
        genai = _types.ModuleType("google.genai")
        errors = _types.ModuleType("google.genai.errors")
        types = _types.ModuleType("google.genai.types")

        class APIError(Exception):
            def __init__(self, code, message="", status=""):
                super().__init__(message)
                self.code, self.message, self.status = code, message, status

        class _Cfg:
            def __init__(self, **kw):
                self.__dict__.update(kw)

        errors.APIError = APIError
        types.GenerateContentConfig = _Cfg
        types.HttpOptions = _Cfg
        genai.errors, genai.types = errors, types
        genai.Client = lambda **kw: None
        google.genai = genai
        sys.modules.update({"google.genai": genai, "google.genai.errors": errors, "google.genai.types": types})
