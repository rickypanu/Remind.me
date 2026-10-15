"""
Gemini client with automatic API-key and model fallback.

Why this exists
---------------
Free-tier Gemini keys hit rate limits (HTTP 429) quickly. Instead of failing the user's request,
every call goes through this pool, which:

  * reads ALL configured keys (see "Configuration"),
  * starts each request from a different key (round-robin) so load is spread evenly,
  * on a rate limit / quota error puts that key (for that model) on a cool-down and moves on to
    the next key IMMEDIATELY (no sleeping),
  * on an invalid / revoked / permission-denied key benches it for a long time,
  * on overload / timeout / 5xx tries the next key, then the next model,
  * tries the keys in order of "healthiest first" and only gives up after every key x model
    combination has been tried, raising GeminiUnavailable.

Cool-down state lives in memory per process (fine for a single uvicorn worker; with several
workers each one simply learns independently).

Configuration (server/.env) - use any of these, they are merged and de-duplicated:
    GEMINI_API_KEYS=key1,key2,key3          comma separated
    GEMINI_API_KEY=key1                     single key
    GEMINI_API_KEY_1=key1  GEMINI_API_KEY_2=key2 ...   numbered keys
    GEMINI_MODELS=gemini-3.8-flash,gemini-3.5-flash-lite,gemini-2.5-flash   optional override, best/fastest first
    GEMINI_TIMEOUT_SECONDS=20               optional per-attempt timeout

Never log full keys: only the last 4 characters are printed.
"""
import asyncio
import itertools
import json
import logging
import os
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Type

from google import genai
from google.genai import errors, types
from pydantic import BaseModel

log = logging.getLogger("gemini_pool")

DEFAULT_MODELS = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest",
]

RATE_LIMIT_COOLDOWN = 65        # seconds: Gemini quotas are per-minute; wait out a window
DAILY_QUOTA_COOLDOWN = 60 * 30  # seconds: when the error says the DAILY quota is gone
BAD_KEY_COOLDOWN = 60 * 60      # seconds: invalid / revoked key
OVERLOAD_COOLDOWN = 8           # seconds: 5xx / timeouts (short, usually transient)
BAD_MODEL_COOLDOWN = 60 * 60    # seconds: model name does not exist for this key


class GeminiUnavailable(RuntimeError):
    """Every key x model combination failed."""


def _clean(key: str) -> str:
    return key.strip().strip("'\"").strip()


def load_api_keys(environ=None) -> List[str]:
    env = os.environ if environ is None else environ
    raw: List[str] = []
    for name in ("GEMINI_API_KEYS", "GEMINI_API_KEY", "GOOGLE_API_KEY"):
        raw.extend((env.get(name) or "").split(","))
    numbered = sorted(
        (k for k in env if re.fullmatch(r"GEMINI_API_KEY_\d+", k)),
        key=lambda k: int(k.rsplit("_", 1)[1]),
    )
    for name in numbered:
        raw.append(env.get(name) or "")
    seen, keys = set(), []
    for k in map(_clean, raw):
        if k and k not in seen:
            seen.add(k)
            keys.append(k)
    return keys


def load_models(environ=None) -> List[str]:
    env = os.environ if environ is None else environ
    raw = env.get("GEMINI_MODELS", "")
    models = [m.strip() for m in raw.split(",") if m.strip()]
    return models or list(DEFAULT_MODELS)


def _mask(key: str) -> str:
    return f"...{key[-4:]}"


def classify_error(exc: BaseException) -> Tuple[str, int]:
    """Map an exception to (kind, cooldown_seconds).

    kinds: rate_limit | bad_key | bad_model | overload | bad_request (not retryable) | unknown
    """
    code = getattr(exc, "code", None)
    status_txt = str(getattr(exc, "status", "") or "").upper()
    message = (getattr(exc, "message", None) or str(exc) or "").lower()

    if code == 429 or "RESOURCE_EXHAUSTED" in status_txt or "quota" in message or "rate limit" in message:
        per_day = "per day" in message or "daily" in message or "perday" in message.replace(" ", "")
        return "rate_limit", DAILY_QUOTA_COOLDOWN if per_day else RATE_LIMIT_COOLDOWN
    if code in (401, 403) or "api key not valid" in message or "api_key_invalid" in message or "permission_denied" in status_txt:
        return "bad_key", BAD_KEY_COOLDOWN
    if code == 400 and ("api key" in message or "expired" in message):
        return "bad_key", BAD_KEY_COOLDOWN
    if code == 404 or "not found" in message and "model" in message:
        return "bad_model", BAD_MODEL_COOLDOWN
    if code in (500, 502, 503, 504) or "UNAVAILABLE" in status_txt or "overloaded" in message or "deadline" in message:
        return "overload", OVERLOAD_COOLDOWN
    if isinstance(exc, (asyncio.TimeoutError, TimeoutError)):
        return "overload", OVERLOAD_COOLDOWN
    if code == 400:
        return "bad_request", 0
    return "unknown", OVERLOAD_COOLDOWN


@dataclass
class GeminiPool:
    keys: List[str]
    models: List[str]
    timeout: float = 20.0
    _clients: Dict[str, "genai.Client"] = field(default_factory=dict, repr=False)
    _key_blocked_until: Dict[str, float] = field(default_factory=dict, repr=False)
    _pair_blocked_until: Dict[Tuple[str, str], float] = field(default_factory=dict, repr=False)
    _model_blocked_until: Dict[str, float] = field(default_factory=dict, repr=False)
    _rr: itertools.count = field(default_factory=itertools.count, repr=False)

    def __post_init__(self):
        if not self.keys:
            raise ValueError(
                "No Gemini API keys found. Set GEMINI_API_KEYS=key1,key2,... (or GEMINI_API_KEY) in server/.env"
            )

    # -- state helpers ------------------------------------------------------
    def _client(self, key: str):
        if key not in self._clients:
            self._clients[key] = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=int(self.timeout * 1000)))
        return self._clients[key]

    def _available(self, key: str, model: str, now: float) -> bool:
        return (
            self._key_blocked_until.get(key, 0) <= now
            and self._pair_blocked_until.get((key, model), 0) <= now
            and self._model_blocked_until.get(model, 0) <= now
        )

    def _ordered_keys(self) -> List[str]:
        """Round-robin start so successive requests use different keys."""
        start = next(self._rr) % len(self.keys)
        return self.keys[start:] + self.keys[:start]

    def status(self) -> List[dict]:
        """Snapshot for debugging / a health endpoint. Keys are masked."""
        now = time.monotonic()
        return [
            {
                "key": _mask(k),
                "blocked_for_s": max(0, round(self._key_blocked_until.get(k, 0) - now)),
                "models_blocked": {m: max(0, round(self._pair_blocked_until.get((k, m), 0) - now))
                                   for m in self.models if self._pair_blocked_until.get((k, m), 0) > now},
            }
            for k in self.keys
        ]

    def _penalise(self, key: str, model: str, kind: str, cooldown: int):
        until = time.monotonic() + cooldown
        if kind == "bad_key":
            self._key_blocked_until[key] = until
        elif kind == "bad_model":
            self._model_blocked_until[model] = until
        elif cooldown:
            self._pair_blocked_until[(key, model)] = until

    # -- main entry ---------------------------------------------------------
    async def generate(
        self,
        prompt: str,
        *,
        schema: Optional[Type[BaseModel]] = None,
        system_instruction: Optional[str] = None,
        temperature: float = 0.0,
        max_output_tokens: Optional[int] = None,
    ) -> str:
        """Return the model's text. With `schema`, the text is JSON matching that Pydantic model."""
        config_kwargs = {"temperature": temperature}
        if schema is not None:
            config_kwargs.update(response_mime_type="application/json", response_schema=schema)
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if max_output_tokens:
            config_kwargs["max_output_tokens"] = max_output_tokens
        config = types.GenerateContentConfig(**config_kwargs)

        last_exc: Optional[BaseException] = None
        attempted = set()
        keys = self._ordered_keys()

        # Pass 1 skips anything that is cooling down. Pass 2 (last resort) tries only the combinations
        # pass 1 skipped, because a cool-down is just our best guess and the provider may have recovered.
        for respect_cooldown in (True, False):
            for model in self.models:
                for key in keys:
                    pair = (key, model)
                    now = time.monotonic()
                    if pair in attempted:
                        continue
                    if respect_cooldown and not self._available(key, model, now):
                        continue
                    if not respect_cooldown and self._key_blocked_until.get(key, 0) > now + 600:
                        continue  # a key marked invalid is not worth a second try
                    attempted.add(pair)
                    try:
                        response = await asyncio.wait_for(
                            self._client(key).aio.models.generate_content(model=model, contents=prompt, config=config),
                            timeout=self.timeout + 5,
                        )
                        text = getattr(response, "text", None)
                        if text:
                            return text
                        last_exc = RuntimeError("Empty response (possibly blocked by safety filters)")
                        log.warning("Gemini empty response key=%s model=%s", _mask(key), model)
                    except Exception as exc:  # noqa: BLE001 - every failure is classified
                        last_exc = exc
                        kind, cooldown = classify_error(exc)
                        log.warning("Gemini %s on key=%s model=%s (%s)", kind, _mask(key), model, getattr(exc, "code", type(exc).__name__))
                        if kind == "bad_request":
                            raise  # the prompt itself is invalid; other keys will not help
                        self._penalise(key, model, kind, cooldown)

        raise GeminiUnavailable(
            f"All {len(self.keys)} Gemini key(s) x {len(self.models)} model(s) failed after {len(attempted)} attempt(s). Last error: {last_exc}"
        )

    async def generate_json(self, prompt: str, schema: Type[BaseModel], **kwargs) -> dict:
        text = await self.generate(prompt, schema=schema, **kwargs)
        return json.loads(text)


_pool: Optional[GeminiPool] = None


def get_pool() -> GeminiPool:
    """Lazily create the shared pool (so importing this module never crashes the app)."""
    global _pool
    if _pool is None:
        _pool = GeminiPool(keys=load_api_keys(), models=load_models(), timeout=float(os.getenv("GEMINI_TIMEOUT_SECONDS", "20")))
        log.info("Gemini pool ready: %d key(s), models=%s", len(_pool.keys), _pool.models)
    return _pool
