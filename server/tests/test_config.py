"""Settings validation (audit findings A5, S3, S16).

Run from the server folder:  pytest tests/test_config.py   (or python -m unittest tests.test_config)
Needs no database, network or .env file: the environment is replaced for every test.
"""

import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pydantic import ValidationError  # noqa: E402

from app.core.config import Settings, get_settings  # noqa: E402

SECRET = "Qm7vX2pLr9TzK4wYb8NcJ3hFd6SgU1aE5oIxV0eRt"
ENC_KEY = "Hn3Zc8Ws1Ke6Dy9Bq4Pj7Lt2Vf5Gm0Ua8Rx3Ni6Oo1Xb"
OLD_KEY = "Bv5Tn2Mk8Ep3Ws7Yc1Lh9Dq4Fj6Gz0Ra2Xi8Uo5Ne3Pa"
WEBHOOK = "Zr4Kd9Wm2Ts7Yb1Nc6Hp3Lq8Vf5Gj0Ux_Ei-Oa2Re"
ADMIN = "Jt8Pq3Vz6Ld1Hn9Cs4Wb7Ky2Mf5Rg0Ux3Ea8Io6Nt1"

DEV = {"SECRET_KEY": SECRET, "REMINDER_ENCRYPTION_KEY": ENC_KEY}

PROD = {
    **DEV,
    "ENVIRONMENT": "production",
    "MONGODB_URL": "mongodb+srv://app:pw@cluster0.abcde.mongodb.net/?retryWrites=true",
    "CORS_ORIGINS": "https://remindme.app,https://www.remindme.app/",
    "FRONTEND_URL": "https://remindme.app",
    "REDIS_URL": "rediss://default:pw@redis.remindme.app:6380/0",
    "BREVO_API_KEY": "xkeysib-0123456789abcdef",
    "EMAIL_SENDER_ADDRESS": "noreply@remindme.app",
}


def load(env: dict[str, str]) -> Settings:
    """Build Settings from exactly ``env`` (no real environment, no .env file)."""
    with patch.dict(os.environ, env, clear=True):
        return Settings(_env_file=None)  # type: ignore[call-arg]


def error_text(env: dict[str, str]) -> str:
    with patch.dict(os.environ, env, clear=True):
        try:
            Settings(_env_file=None)  # type: ignore[call-arg]
        except ValidationError as exc:
            return str(exc)
    raise AssertionError("expected a ValidationError")


class RequiredSecretsTests(unittest.TestCase):
    def test_minimal_development_config_loads_with_local_defaults(self):
        s = load(DEV)
        self.assertEqual(s.environment, "development")
        self.assertEqual(s.mongodb_url.get_secret_value(), "mongodb://localhost:27017")
        self.assertEqual(s.database_name, "remindme")
        self.assertEqual(s.cors_origins, ["http://localhost:5173", "http://127.0.0.1:5173"])
        self.assertEqual(s.algorithm, "HS256")
        self.assertEqual(s.rate_limit_storage_uri, "memory://")
        self.assertFalse(s.telegram_enabled or s.push_enabled or s.email_enabled or s.ai_enabled)

    def test_missing_secret_key_is_rejected_there_is_no_default(self):
        env = {k: v for k, v in DEV.items() if k != "SECRET_KEY"}
        self.assertIn("secret_key", error_text(env).lower())

    def test_missing_encryption_key_is_rejected(self):
        env = {k: v for k, v in DEV.items() if k != "REMINDER_ENCRYPTION_KEY"}
        self.assertIn("reminder_encryption_key", error_text(env).lower())

    def test_secret_shorter_than_32_characters_is_rejected(self):
        self.assertIn("SECRET_KEY must be at least 32 characters", error_text({**DEV, "SECRET_KEY": SECRET[:31]}))
        load({**DEV, "SECRET_KEY": SECRET[:32]})  # exactly 32 is accepted

    def test_the_old_default_secret_is_rejected_even_when_padded_to_length(self):
        text = error_text({**DEV, "SECRET_KEY": "your_secret_key" + "A1b2C3d4E5f6G7h8I9j0"})
        self.assertIn("placeholder", text)

    def test_low_variety_secret_is_rejected(self):
        self.assertIn("too little variety", error_text({**DEV, "SECRET_KEY": "a1" * 20}))

    def test_jwt_and_encryption_keys_must_differ(self):
        self.assertIn("must be different", error_text({**DEV, "REMINDER_ENCRYPTION_KEY": SECRET}))

    def test_all_problems_are_reported_together(self):
        text = error_text({"SECRET_KEY": "short", "REMINDER_ENCRYPTION_KEY": "short"})
        self.assertIn("SECRET_KEY must be at least", text)
        self.assertIn("REMINDER_ENCRYPTION_KEY must be at least", text)

    def test_quotes_and_whitespace_are_stripped(self):
        s = load({"SECRET_KEY": f'  "{SECRET}" ', "REMINDER_ENCRYPTION_KEY": f"'{ENC_KEY}'"})
        self.assertEqual(s.secret_key.get_secret_value(), SECRET)
        self.assertEqual(s.reminder_encryption_key.get_secret_value(), ENC_KEY)

    def test_empty_optional_values_mean_not_set(self):
        s = load({**DEV, "REDIS_URL": "", "TELEGRAM_BOT_TOKEN": "", "ACCESS_TOKEN_EXPIRE_MINUTES": ""})
        self.assertIsNone(s.redis_url)
        self.assertIsNone(s.telegram_bot_token)
        self.assertEqual(s.access_token_expire_minutes, 15)

    def test_secrets_never_appear_in_repr(self):
        s = load(DEV)
        self.assertNotIn(SECRET, repr(s))
        self.assertNotIn(ENC_KEY, repr(s))
        self.assertNotIn(SECRET, str(s.safe_summary()))

    def test_previous_encryption_keys_are_parsed_and_checked(self):
        s = load({**DEV, "REMINDER_ENCRYPTION_KEY_PREVIOUS": f"{OLD_KEY}, '{SECRET[::-1]}'"})
        self.assertEqual(len(s.reminder_encryption_key_previous), 2)
        self.assertIn("PREVIOUS[1] must be at least", error_text({**DEV, "REMINDER_ENCRYPTION_KEY_PREVIOUS": "short"}))
        self.assertIn("equals the current key", error_text({**DEV, "REMINDER_ENCRYPTION_KEY_PREVIOUS": ENC_KEY}))

    def test_token_lifetime_bounds(self):
        self.assertEqual(load({**DEV, "ACCESS_TOKEN_EXPIRE_MINUTES": "15"}).access_token_expire_minutes, 15)
        error_text({**DEV, "ACCESS_TOKEN_EXPIRE_MINUTES": "1"})
        error_text({**DEV, "ACCESS_TOKEN_EXPIRE_MINUTES": "100000"})
        error_text({**DEV, "ACCESS_TOKEN_EXPIRE_MINUTES": "61"})  # access tokens must stay short-lived

    def test_session_and_reset_lifetimes_and_proxy_settings(self):
        s = load(DEV)
        self.assertEqual((s.access_token_expire_minutes, s.refresh_token_expire_days, s.password_reset_expire_minutes), (15, 30, 60))
        self.assertEqual(s.trusted_proxy_hops, 0)  # X-Forwarded-For is ignored unless the operator opts in
        self.assertEqual(s.rate_limit_reset_password, "10/hour")
        self.assertEqual(load({**DEV, "REFRESH_TOKEN_EXPIRE_DAYS": "7", "TRUSTED_PROXY_HOPS": "1"}).trusted_proxy_hops, 1)
        for bad in ({"REFRESH_TOKEN_EXPIRE_DAYS": "0"}, {"REFRESH_TOKEN_EXPIRE_DAYS": "400"},
                    {"PASSWORD_RESET_EXPIRE_MINUTES": "1"}, {"PASSWORD_RESET_EXPIRE_MINUTES": "5000"},
                    {"TRUSTED_PROXY_HOPS": "-1"}, {"TRUSTED_PROXY_HOPS": "50"}, {"RATE_LIMIT_REFRESH": "lots"}):
            with self.subTest(bad=bad):
                error_text({**DEV, **bad})

    def test_algorithm_is_case_insensitive_and_restricted(self):
        self.assertEqual(load({**DEV, "ALGORITHM": "hs512"}).algorithm, "HS512")
        error_text({**DEV, "ALGORITHM": "none"})


class CorsTests(unittest.TestCase):
    def test_comma_separated_origins_are_normalised(self):
        s = load({**DEV, "CORS_ORIGINS": "https://A.example.org/ , http://localhost:3000,https://a.example.org"})
        self.assertEqual(s.cors_origins, ["https://a.example.org", "http://localhost:3000"])

    def test_json_array_is_accepted(self):
        s = load({**DEV, "CORS_ORIGINS": '["https://one.dev", "https://two.dev"]'})
        self.assertEqual(s.cors_origins, ["https://one.dev", "https://two.dev"])

    def test_wildcard_is_rejected(self):
        self.assertIn("wildcard", error_text({**DEV, "CORS_ORIGINS": "*"}))

    def test_origin_with_path_or_bad_scheme_is_rejected(self):
        error_text({**DEV, "CORS_ORIGINS": "https://site.dev/app"})
        error_text({**DEV, "CORS_ORIGINS": "ftp://site.dev"})
        error_text({**DEV, "CORS_ORIGINS": "site.dev"})

    def test_localhost_regex_only_outside_production(self):
        self.assertIsNotNone(load(DEV).cors_origin_regex)
        self.assertIsNone(load(PROD).cors_origin_regex)


class ProductionTests(unittest.TestCase):
    def test_valid_production_config_loads(self):
        s = load(PROD)
        self.assertTrue(s.is_production)
        self.assertFalse(s.docs_enabled)
        self.assertEqual(s.cors_origins, ["https://remindme.app", "https://www.remindme.app"])
        self.assertEqual(s.rate_limit_storage_uri, PROD["REDIS_URL"])
        self.assertTrue(s.email_enabled)

    def test_production_rejects_http_and_localhost_origins(self):
        text = error_text({**PROD, "CORS_ORIGINS": "http://remindme.app,https://localhost:5173"})
        self.assertIn("'http://remindme.app'", text)
        self.assertIn("'https://localhost:5173'", text)

    def test_production_rejects_local_frontend_url(self):
        self.assertIn("FRONTEND_URL", error_text({**PROD, "FRONTEND_URL": "http://localhost:5173"}))

    def test_production_rejects_local_mongodb_including_credentials_form(self):
        for url in ("mongodb://localhost:27017", "mongodb://u:p@127.0.0.1/db", "mongodb://u:p@db1.example.org,localhost:27017/x"):
            self.assertIn("MONGODB_URL points at localhost", error_text({**PROD, "MONGODB_URL": url}), url)

    def test_production_requires_redis_unless_explicitly_waived(self):
        env = {k: v for k, v in PROD.items() if k != "REDIS_URL"}
        self.assertIn("REDIS_URL is required", error_text(env))
        self.assertEqual(load({**env, "ALLOW_IN_MEMORY_RATE_LIMIT": "true"}).rate_limit_storage_uri, "memory://")
        load({**env, "RATE_LIMIT_ENABLED": "false"})

    def test_production_requires_email(self):
        env = {k: v for k, v in PROD.items() if k not in ("BREVO_API_KEY", "EMAIL_SENDER_ADDRESS")}
        self.assertIn("BREVO_API_KEY is required in production", error_text(env))

    def test_free_hosting_can_start_production_without_email(self):
        env = {k: v for k, v in PROD.items() if k not in ("BREVO_API_KEY", "EMAIL_SENDER_ADDRESS")}
        s = load({**env, "ALLOW_PRODUCTION_WITHOUT_EMAIL": "true"})
        self.assertFalse(s.email_enabled)

    def test_argon2_cost_defaults_to_library_values_and_is_bounded(self):
        s = load(DEV)
        self.assertIsNone(s.argon2_time_cost)
        s = load({**DEV, "ARGON2_TIME_COST": "2", "ARGON2_MEMORY_KIB": "19456", "ARGON2_PARALLELISM": "1"})
        self.assertEqual((s.argon2_time_cost, s.argon2_memory_kib, s.argon2_parallelism), (2, 19456, 1))
        self.assertIn("argon2_memory_kib", error_text({**DEV, "ARGON2_MEMORY_KIB": "64"}).lower())

    def test_development_does_not_require_any_of_that(self):
        s = load({**DEV, "ENVIRONMENT": "DEVELOPMENT"})
        self.assertTrue(s.docs_enabled)


class IntegrationGroupTests(unittest.TestCase):
    def test_telegram_token_requires_username_and_webhook_secret(self):
        text = error_text({**DEV, "TELEGRAM_BOT_TOKEN": "123456:ABC-token"})
        self.assertIn("TELEGRAM_BOT_USERNAME is required", text)
        self.assertIn("TELEGRAM_WEBHOOK_SECRET is required", text)

    def test_complete_telegram_config_loads_and_strips_at_sign(self):
        s = load(
            {
                **DEV,
                "TELEGRAM_BOT_TOKEN": "123456:ABC-token",
                "TELEGRAM_BOT_USERNAME": "@RemindMeBot",
                "TELEGRAM_WEBHOOK_SECRET": WEBHOOK,
                "ADMIN_TELEGRAM_ID": "-1001234567890",
                "ADMIN_SECRET": ADMIN,
            }
        )
        self.assertTrue(s.telegram_enabled)
        self.assertEqual(s.telegram_bot_username, "RemindMeBot")

    def test_webhook_secret_charset_and_length(self):
        base = {**DEV, "TELEGRAM_BOT_TOKEN": "123456:ABC-token", "TELEGRAM_BOT_USERNAME": "RemindMeBot"}
        error_text({**base, "TELEGRAM_WEBHOOK_SECRET": "too-short"})
        error_text({**base, "TELEGRAM_WEBHOOK_SECRET": WEBHOOK[:-1] + "!"})

    def test_webhook_secret_without_bot_token_is_rejected(self):
        self.assertIn("TELEGRAM_BOT_TOKEN is missing", error_text({**DEV, "TELEGRAM_WEBHOOK_SECRET": WEBHOOK}))

    def test_brevo_key_requires_sender_address(self):
        self.assertIn("EMAIL_SENDER_ADDRESS is required", error_text({**DEV, "BREVO_API_KEY": "xkeysib-abc"}))

    def test_vapid_is_all_or_none_and_normalises_mailto(self):
        self.assertIn("must be set together", error_text({**DEV, "VAPID_PRIVATE_KEY": "private-key-value"}))
        s = load(
            {
                **DEV,
                "VAPID_PRIVATE_KEY": "private-key-value",
                "VAPID_PUBLIC_KEY": "public-key-value",
                "VAPID_EMAIL": "mailto:ops@remindme.app",
            }
        )
        self.assertTrue(s.push_enabled)
        self.assertEqual(s.vapid_claims, {"sub": "mailto:ops@remindme.app"})

    def test_gemini_keys_are_merged_and_deduplicated(self):
        s = load({**DEV, "GEMINI_API_KEYS": "key-a, key-b,key-a", "GEMINI_API_KEY": "key-c", "GEMINI_MODELS": "m1,m2"})
        self.assertEqual(s.gemini_keys, ["key-a", "key-b", "key-c"])
        self.assertEqual(s.gemini_models, ["m1", "m2"])
        self.assertTrue(s.ai_enabled)

    def test_rate_limit_format_is_validated(self):
        self.assertEqual(load({**DEV, "RATE_LIMIT_LOGIN": " 10/Minute "}).rate_limit_login, "10/minute")
        error_text({**DEV, "RATE_LIMIT_LOGIN": "five per minute"})
        error_text({**DEV, "RATE_LIMIT_LOGIN": "0/minute"})

    def test_redis_and_mongodb_schemes_are_validated(self):
        error_text({**DEV, "REDIS_URL": "http://localhost:6379"})
        error_text({**DEV, "MONGODB_URL": "postgres://localhost/db"})
        error_text({**DEV, "DATABASE_NAME": "bad name/with:chars"})


class GetSettingsTests(unittest.TestCase):
    def test_get_settings_is_cached_and_clearable(self):
        with patch.dict(os.environ, DEV, clear=True):
            get_settings.cache_clear()
            first = get_settings()
            self.assertIs(first, get_settings())
            get_settings.cache_clear()
            self.assertIsNot(first, get_settings())
        get_settings.cache_clear()

    def test_settings_are_immutable(self):
        s = load(DEV)
        with self.assertRaises((ValidationError, TypeError, AttributeError)):
            s.environment = "production"  # type: ignore[misc]


if __name__ == "__main__":
    unittest.main()
