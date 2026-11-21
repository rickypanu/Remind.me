"""Lets the pure-logic tests run even where FastAPI is not installed."""
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
