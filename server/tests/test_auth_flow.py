"""Access tokens, refresh-token sessions, and the auth routes end to end against an in-memory database
(S3, S6, S7, S9)."""

import hashlib
import unittest
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

import jwt  # noqa: E402
from bson import ObjectId  # noqa: E402
from fastapi import BackgroundTasks  # noqa: E402
from fastapi.security import OAuth2PasswordRequestForm  # noqa: E402
from starlette.requests import Request  # noqa: E402

from app.api import deps  # noqa: E402
from app.api.v1 import auth as auth_routes  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.errors import AppError  # noqa: E402
from app.services import password_reset, sessions  # noqa: E402
from app.services.auth import AuthService  # noqa: E402
from schemas.auth import (  # noqa: E402
    ForgotPasswordRequest,
    LogoutRequest,
    RefreshRequest,
    ResetPasswordRequest,
    UserCreate,
)
from tests.fake_db import FakeDb  # noqa: E402
from utils import security  # noqa: E402

PASSWORD = "Tr0ub4dor&Horse"
NEW_PASSWORD = "Gl4ssHouse!Lamp7"
SETTINGS = get_settings()


def make_request(headers=None, host="203.0.113.9") -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "method": "POST", "path": "/", "headers": raw, "client": (host, 1234), "query_string": b""})


async def make_user(db, email="ricky@example.com", password=PASSWORD, **extra):
    user = {"_id": ObjectId(), "username": "ricky", "email": email, "password_hash": security.get_password_hash(password),
            "created_at": datetime.now(UTC), "token_version": 0, **extra}
    await db["users"].insert_one(user)
    return user


def decode(token):
    return security.decode_access_token(token)


class AccessTokenTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.user = await make_user(self.db)
        self.issued = await sessions.start_session(self.db, self.user)

    def token(self, **over):
        args = {"user_id": str(self.user["_id"]), "token_version": 0, "session_id": self.issued.family_id}
        args.update(over)
        return security.create_access_token(**args)

    def raw(self, **claims):
        now = datetime.now(UTC)
        base = {"sub": str(self.user["_id"]), "tv": 0, "sid": self.issued.family_id, "typ": "access", "iat": now, "exp": now + timedelta(minutes=5)}
        base.update(claims)
        return jwt.encode({k: v for k, v in base.items() if v is not None}, SETTINGS.secret_key.get_secret_value(), algorithm="HS256")

    def test_claims_and_lifetime(self):
        payload = decode(self.token())
        self.assertEqual(payload["sub"], str(self.user["_id"]))
        self.assertNotIn("@", payload["sub"])  # the user id, never the e-mail address
        self.assertEqual((payload["tv"], payload["sid"], payload["typ"]), (0, self.issued.family_id, "access"))
        self.assertEqual(payload["exp"] - payload["iat"], SETTINGS.access_token_expire_minutes * 60)
        self.assertLessEqual(SETTINGS.access_token_expire_minutes, 60)

    def test_unusable_tokens_are_rejected(self):
        secret = SETTINGS.secret_key.get_secret_value()
        past = datetime.now(UTC) - timedelta(minutes=1)
        cases = {
            "legacy token (sub = e-mail, no tv/sid/typ)": jwt.encode({"sub": "ricky@example.com", "exp": datetime.now(UTC) + timedelta(hours=1)}, secret, algorithm="HS256"),
            "expired": self.raw(exp=past, iat=past - timedelta(minutes=5)),
            "wrong secret": jwt.encode({"sub": "x", "tv": 0, "sid": "s", "typ": "access", "exp": datetime.now(UTC) + timedelta(minutes=5)}, "z" * 40, algorithm="HS256"),
            "wrong type": self.raw(typ="refresh"),
            "tv as string": self.raw(tv="0"),
            "tv as bool": self.raw(tv=True),
            "sub as number": self.raw(sub=123),
            "missing sid": self.raw(sid=None),
            "alg none": jwt.encode({"sub": "x", "tv": 0, "sid": "s", "typ": "access", "exp": 9999999999}, None, algorithm="none"),
            "garbage": "not.a.jwt",
        }
        for label, token in cases.items():
            with self.subTest(label):
                self.assertIsNone(decode(token))

    async def test_get_current_user_accepts_a_valid_token(self):
        user = await deps.get_current_user(token=self.token(), db=self.db)
        self.assertEqual(user["_id"], str(self.user["_id"]))
        self.assertEqual(user["session_id"], self.issued.family_id)

    async def assertRejected(self, token, db=None):
        with self.assertRaises(AppError) as ctx:
            await deps.get_current_user(token=token, db=db or self.db)
        self.assertEqual(ctx.exception.status_code, 401)

    async def test_token_version_bump_invalidates_older_tokens(self):
        token = self.token()
        await self.db["users"].update_one({"_id": self.user["_id"]}, {"$inc": {"token_version": 1}})
        await self.assertRejected(token)

    async def test_logout_kills_the_access_token_immediately(self):
        token = self.token()
        await sessions.end_session(self.db, self.issued.refresh_token)
        await self.assertRejected(token)

    async def test_deleted_user_and_malformed_subject(self):
        await self.assertRejected(self.token(user_id=str(ObjectId())))
        await self.assertRejected(self.raw(sub="not-an-object-id"))

    async def test_expired_session_family_does_not_authenticate(self):
        for doc in self.db["sessions"].docs:
            doc["expires_at"] = datetime.now(UTC) - timedelta(seconds=1)
        await self.assertRejected(self.token())

    async def test_a_session_of_another_user_does_not_help(self):
        other = await make_user(self.db, email="other@example.com")
        await self.assertRejected(self.token(user_id=str(other["_id"])))  # sid belongs to the first user


class SessionServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()
        self.user = await make_user(self.db)

    async def test_only_the_hash_of_a_refresh_token_is_stored(self):
        issued = await sessions.start_session(self.db, self.user, "Mozilla/5.0\x00 (X11)")
        [doc] = self.db["sessions"].docs
        self.assertNotEqual(doc["token_hash"], issued.refresh_token)
        self.assertEqual(doc["token_hash"], hashlib.sha256(issued.refresh_token.encode()).hexdigest())
        self.assertNotIn(issued.refresh_token, str(doc))
        self.assertGreaterEqual(len(issued.refresh_token), 43)
        self.assertEqual(doc["user_agent"], "Mozilla/5.0 (X11)")
        days = (doc["expires_at"] - doc["created_at"]).days
        self.assertEqual(days, SETTINGS.refresh_token_expire_days)

    async def test_rotation_issues_a_new_token_in_the_same_family(self):
        first = await sessions.start_session(self.db, self.user)
        second = await sessions.rotate_session(self.db, first.refresh_token)
        self.assertIsNotNone(second)
        self.assertNotEqual(second.refresh_token, first.refresh_token)
        self.assertEqual(second.family_id, first.family_id)
        third = await sessions.rotate_session(self.db, second.refresh_token)
        self.assertIsNotNone(third)

    async def test_reusing_a_spent_token_revokes_the_whole_family(self):
        first = await sessions.start_session(self.db, self.user)
        second = await sessions.rotate_session(self.db, first.refresh_token)
        for doc in self.db["sessions"].docs:
            if doc["used_at"]:
                doc["used_at"] -= timedelta(minutes=5)  # past the grace window
        self.assertIsNone(await sessions.rotate_session(self.db, first.refresh_token))  # the thief
        self.assertEqual(await self.db["sessions"].count_documents({}), 0)
        self.assertIsNone(await sessions.rotate_session(self.db, second.refresh_token))  # and the victim must log in again

    async def test_a_double_refresh_inside_the_grace_window_does_not_log_everyone_out(self):
        first = await sessions.start_session(self.db, self.user)
        second = await sessions.rotate_session(self.db, first.refresh_token)
        self.assertIsNone(await sessions.rotate_session(self.db, first.refresh_token))  # the losing tab gets a 401...
        self.assertIsNotNone(await sessions.rotate_session(self.db, second.refresh_token))  # ...the family survives

    async def test_expired_and_unknown_tokens(self):
        issued = await sessions.start_session(self.db, self.user)
        self.assertIsNone(await sessions.rotate_session(self.db, "x" * 64))
        self.db["sessions"].docs[0]["expires_at"] = datetime.now(UTC) - timedelta(seconds=1)
        self.assertIsNone(await sessions.rotate_session(self.db, issued.refresh_token))

    async def test_changed_token_version_or_deleted_user_ends_the_family(self):
        issued = await sessions.start_session(self.db, self.user)
        await self.db["users"].update_one({"_id": self.user["_id"]}, {"$inc": {"token_version": 1}})
        self.assertIsNone(await sessions.rotate_session(self.db, issued.refresh_token))
        self.assertEqual(await self.db["sessions"].count_documents({}), 0)

        issued = await sessions.start_session(self.db, await self.db["users"].find_one({"_id": self.user["_id"]}))
        await self.db["users"].delete_one({"_id": self.user["_id"]})
        self.assertIsNone(await sessions.rotate_session(self.db, issued.refresh_token))

    async def test_end_session_only_ends_that_device(self):
        a = await sessions.start_session(self.db, self.user)
        b = await sessions.start_session(self.db, self.user)
        self.assertTrue(await sessions.end_session(self.db, a.refresh_token))
        self.assertFalse(await sessions.end_session(self.db, a.refresh_token))
        self.assertIsNotNone(await sessions.rotate_session(self.db, b.refresh_token))


class AuthRouteTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.db = FakeDb()

    async def signup(self, email="Ricky@Example.com", username="ricky", password=PASSWORD):
        return await auth_routes.signup(request=make_request(), user=UserCreate(username=username, email=email, password=password), auth=AuthService(self.db))

    async def login(self, email="ricky@example.com", password=PASSWORD):
        form = OAuth2PasswordRequestForm(username=email, password=password)
        return await auth_routes.login(request=make_request({"user-agent": "pytest"}), form=form, auth=AuthService(self.db))

    # ---- sign-up -------------------------------------------------------------------------------
    async def test_signup_stores_a_lowercase_email_a_hash_and_a_token_version(self):
        self.assertEqual((await self.signup()).message, "User created successfully")
        [user] = self.db["users"].docs
        self.assertEqual(user["email"], "ricky@example.com")
        self.assertNotEqual(user["password_hash"], PASSWORD)
        self.assertTrue(user["password_hash"].startswith("$argon2"))
        self.assertEqual(user["token_version"], 0)
        self.assertEqual(set(user) - {"_id"}, {"username", "email", "password_hash", "created_at", "token_version"})

    async def test_duplicate_email_in_any_case_is_a_409(self):
        await self.signup()
        with self.assertRaises(AppError) as ctx:
            await self.signup(email="RICKY@EXAMPLE.COM", username="other")
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.detail, "Email already registered")

    # ---- login ---------------------------------------------------------------------------------
    async def test_login_returns_access_and_refresh_tokens(self):
        await self.signup()
        result = await self.login(email="  RICKY@example.com ")  # case and spaces do not matter
        self.assertEqual(result["token_type"], "bearer")
        self.assertEqual(result["expires_in"], SETTINGS.access_token_expire_minutes * 60)
        claims = decode(result["access_token"])
        [user] = self.db["users"].docs
        self.assertEqual(claims["sub"], str(user["_id"]))
        self.assertEqual(await self.db["sessions"].count_documents({"user_id": str(user["_id"])}), 1)
        current = await deps.get_current_user(token=result["access_token"], db=self.db)
        self.assertEqual(current["email"], "ricky@example.com")

    async def test_wrong_password_and_unknown_email_look_identical(self):
        await self.signup()
        errors = []
        for email, password in (("ricky@example.com", "Wr0ng!Password"), ("nobody@example.com", PASSWORD)):
            with self.assertRaises(AppError) as ctx:
                await self.login(email=email, password=password)
            errors.append((ctx.exception.status_code, ctx.exception.detail, ctx.exception.headers))
        self.assertEqual(errors[0], errors[1])
        self.assertEqual(errors[0][0], 401)
        self.assertEqual(await self.db["sessions"].count_documents({}), 0)

    async def test_an_unknown_email_still_costs_one_password_verification(self):
        await self.signup()
        calls = []
        real = security.verify_password

        def counting(plain, hashed):
            calls.append(hashed)
            return real(plain, hashed)

        with patch.object(security, "verify_password", counting):
            for email in ("ricky@example.com", "nobody@example.com"):
                calls.clear()
                with self.assertRaises(AppError):
                    await self.login(email=email, password="Wr0ng!Password")
                self.assertEqual(len(calls), 1, email)
                self.assertTrue(calls[0].startswith("$argon2"), email)

    async def test_oversized_input_is_rejected_without_a_database_lookup(self):
        with self.assertRaises(AppError) as ctx:
            await self.login(email="a" * 300 + "@x.com", password="p" * 5000)
        self.assertEqual(ctx.exception.status_code, 401)

    async def test_legacy_hash_is_upgraded_after_a_successful_login(self):
        user = await make_user(self.db, password_hash="$2b$12$legacy")  # pretend bcrypt
        with patch.object(security, "verify_password", lambda p, h: h == "$2b$12$legacy" or h.startswith("$argon2") and False), \
             patch.object(security, "password_needs_rehash", lambda h: h.startswith("$2")):
            await self.login()
        stored = (await self.db["users"].find_one({"_id": user["_id"]}))["password_hash"]
        self.assertTrue(stored.startswith("$argon2"))

    # ---- refresh / logout ----------------------------------------------------------------------
    async def test_refresh_rotates_and_the_old_token_dies(self):
        await self.signup()
        first = await self.login()
        second = await auth_routes.refresh(request=make_request(), body=RefreshRequest(refresh_token=first["refresh_token"]), auth=AuthService(self.db))
        self.assertNotEqual(second["refresh_token"], first["refresh_token"])
        self.assertEqual(decode(second["access_token"])["sid"], decode(first["access_token"])["sid"])
        with self.assertRaises(AppError) as ctx:
            await auth_routes.refresh(request=make_request(), body=RefreshRequest(refresh_token=first["refresh_token"]), auth=AuthService(self.db))
        self.assertEqual(ctx.exception.status_code, 401)

    async def test_logout_is_idempotent_and_kills_the_session(self):
        await self.signup()
        result = await self.login()
        body = LogoutRequest(refresh_token=result["refresh_token"])
        for _ in range(2):
            self.assertEqual((await auth_routes.logout(request=make_request(), body=body, auth=AuthService(self.db))).message, "Logged out.")
        with self.assertRaises(AppError):
            await deps.get_current_user(token=result["access_token"], db=self.db)

    async def test_logout_all_ends_every_device(self):
        await self.signup()
        phone, laptop = await self.login(), await self.login()
        user = await deps.get_current_user(token=phone["access_token"], db=self.db)
        await auth_routes.logout_all(_user=user, user_id=deps.get_user_id(user), auth=AuthService(self.db))
        for result in (phone, laptop):
            with self.assertRaises(AppError):
                await deps.get_current_user(token=result["access_token"], db=self.db)
            with self.assertRaises(AppError):
                await auth_routes.refresh(request=make_request(), body=RefreshRequest(refresh_token=result["refresh_token"]), auth=AuthService(self.db))

    # ---- forgot / reset ------------------------------------------------------------------------
    async def forgot(self, email):
        background = BackgroundTasks()
        result = await auth_routes.forgot_password(request=make_request(), body=ForgotPasswordRequest(email=email), background_tasks=background, db=self.db)
        return result, background

    async def test_forgot_password_answers_the_same_for_known_and_unknown_emails(self):
        await self.signup()
        with patch.object(password_reset, "send_reset_email", new=AsyncMock()) as mail:
            known, background_known = await self.forgot("RICKY@example.com")
            unknown, background_unknown = await self.forgot("nobody@example.com")
            self.assertEqual(known, unknown)
            self.assertEqual(known.message, "If an account with that email exists, a reset link has been sent.")
            # nothing happened yet: the work is queued to run after the response
            self.assertEqual(len(self.db["password_resets"].docs), 0)
            mail.assert_not_awaited()
            self.assertEqual(len(background_known.tasks), len(background_unknown.tasks))
            await background_known.run()
            await background_unknown.run()
            self.assertEqual(mail.await_count, 1)  # only the real account got mail

    async def request_link(self, email="ricky@example.com"):
        with patch.object(password_reset, "send_reset_email", new=AsyncMock()) as mail:
            _, background = await self.forgot(email)
            await background.run()
        return mail.await_args.args[1] if mail.await_count else None

    async def test_reset_link_uses_a_fragment_and_only_the_hash_is_stored(self):
        await self.signup()
        link = await self.request_link()
        self.assertTrue(link.startswith(SETTINGS.frontend_url + "/reset-password#token="), link)
        self.assertNotIn("?", link)
        token = link.split("#token=")[1]
        [doc] = self.db["password_resets"].docs
        self.assertEqual(doc["reset_token_hash"], hashlib.sha256(token.encode()).hexdigest())
        self.assertNotIn(token, str(doc))
        self.assertEqual(len(token), 43)
        minutes = (doc["reset_token_expires"] - doc["created_at"]).total_seconds() / 60
        self.assertEqual(minutes, SETTINGS.password_reset_expire_minutes)
        # nothing was written onto the user document
        self.assertNotIn("reset_token", self.db["users"].docs[0])

    async def test_requests_within_a_minute_are_ignored_and_a_new_request_replaces_the_old_token(self):
        await self.signup()
        first = await self.request_link()
        self.assertIsNone(await self.request_link())  # throttled: no second mail
        self.db["password_resets"].docs[0]["created_at"] -= timedelta(minutes=5)
        second = await self.request_link()
        self.assertNotEqual(first, second)
        self.assertEqual(len(self.db["password_resets"].docs), 1)
        self.assertIsNone(await password_reset.peek_reset(self.db, first.split("#token=")[1]))
        self.assertIsNotNone(await password_reset.peek_reset(self.db, second.split("#token=")[1]))

    async def reset(self, token, password=NEW_PASSWORD):
        background = BackgroundTasks()
        result = await auth_routes.reset_password(request=make_request(), body=ResetPasswordRequest(token=token, new_password=password), background_tasks=background, auth=AuthService(self.db))
        return result, background

    async def test_full_reset_flow(self):
        await self.signup()
        old_login = await self.login()
        token = (await self.request_link()).split("#token=")[1]

        with patch.object(auth_routes, "send_success_email", new=AsyncMock()) as confirmation:
            result, background = await self.reset(token)
            await background.run()
        self.assertEqual(result.message, "Password successfully reset.")
        confirmation.assert_awaited_once_with("ricky@example.com")

        [user] = self.db["users"].docs
        self.assertEqual(user["token_version"], 1)
        self.assertTrue(security.verify_password(NEW_PASSWORD, user["password_hash"]))
        self.assertFalse(security.verify_password(PASSWORD, user["password_hash"]))
        self.assertEqual(len(self.db["sessions"].docs), 0)  # every device signed out
        self.assertEqual(len(self.db["password_resets"].docs), 0)
        with self.assertRaises(AppError):  # tokens from before the reset are dead
            await deps.get_current_user(token=old_login["access_token"], db=self.db)
        with self.assertRaises(AppError):
            await auth_routes.refresh(request=make_request(), body=RefreshRequest(refresh_token=old_login["refresh_token"]), auth=AuthService(self.db))
        await self.login(password=NEW_PASSWORD)  # new password works
        with self.assertRaises(AppError):
            await self.login(password=PASSWORD)

    async def test_a_reset_link_works_exactly_once(self):
        await self.signup()
        token = (await self.request_link()).split("#token=")[1]
        await self.reset(token)
        with self.assertRaises(AppError) as ctx:
            await self.reset(token, "An0ther!Passw0rd")
        self.assertEqual((ctx.exception.status_code, ctx.exception.detail), (400, "Invalid or expired reset token."))

    async def test_concurrent_claims_have_one_winner(self):
        await self.signup()
        token = (await self.request_link()).split("#token=")[1]
        first = await password_reset.claim_reset(self.db, token)
        second = await password_reset.claim_reset(self.db, token)
        self.assertIsNotNone(first)
        self.assertIsNone(second)

    async def test_expired_unknown_and_wellformed_but_wrong_tokens(self):
        await self.signup()
        token = (await self.request_link()).split("#token=")[1]
        self.db["password_resets"].docs[0]["reset_token_expires"] = datetime.now(UTC) - timedelta(seconds=1)
        for candidate in (token, "B" * 43):
            with self.subTest(candidate=candidate[:6]), self.assertRaises(AppError) as ctx:
                await self.reset(candidate)
            self.assertEqual(ctx.exception.status_code, 400)

    async def test_a_rejected_password_does_not_burn_the_token(self):
        await self.signup()
        token = (await self.request_link()).split("#token=")[1]
        with self.assertRaises(AppError) as ctx:
            await self.reset(token, "Ricky#Example99")  # contains the e-mail name "ricky"
        self.assertEqual(ctx.exception.status_code, 422)
        self.assertIn("email name", ctx.exception.detail)
        await self.reset(token)  # same link still works with an acceptable password

    async def test_legacy_reset_fields_are_removed_on_reset(self):
        await self.signup()
        await self.db["users"].update_one({}, {"$set": {"reset_token": "old", "reset_token_expires": datetime.now(UTC)}})
        token = (await self.request_link()).split("#token=")[1]
        await self.reset(token)
        self.assertNotIn("reset_token", self.db["users"].docs[0])
        self.assertNotIn("reset_token_expires", self.db["users"].docs[0])


if __name__ == "__main__":
    unittest.main()
