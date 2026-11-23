"""Password policy and request schemas (S8)."""

import json
import unittest
from pathlib import Path

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from pydantic import ValidationError  # noqa: E402

from app.core.passwords import password_problems  # noqa: E402
from schemas.auth import ForgotPasswordRequest, RefreshRequest, ResetPasswordRequest, UserCreate  # noqa: E402
from schemas.user import UserUpdate  # noqa: E402

GOOD = "Tr0ub4dor&Horse"
TOKEN = "A" * 43
ILLUSTRATIONS = [u for urls in json.loads((Path(__file__).parent / "fixtures" / "illustrations.json").read_text()).values() for u in urls]


class PasswordPolicyTests(unittest.TestCase):
    def test_a_good_password_has_no_problems(self):
        self.assertEqual(password_problems(GOOD), [])

    def test_each_rule_is_reported(self):
        cases = {
            "Ab1!": "at least 8",
            "alllower1!": "uppercase",
            "ALLUPPER1!": "lowercase",
            "NoDigits!!": "number",
            "NoSpecial11": "special",
            "A" * 129 + "a1!": "at most 128",
        }
        for password, fragment in cases.items():
            with self.subTest(password=password[:12]):
                self.assertTrue(any(fragment in p for p in password_problems(password)), password_problems(password))

    def test_common_passwords_are_refused(self):
        self.assertTrue(any("too common" in p for p in password_problems("Password@123")))

    def test_repeated_character_is_refused(self):
        self.assertTrue(any("repeated" in p for p in password_problems("aaaaaaaaaaaa")))

    def test_control_characters_are_refused(self):
        self.assertTrue(any("control" in p for p in password_problems("Good1!pass\x00word")))

    def test_may_not_contain_email_name_or_username(self):
        self.assertTrue(any("email name" in p for p in password_problems("Rickypanu!99X", email="rickypanu@x.com")))
        self.assertTrue(any("username" in p for p in password_problems("Zebra#Stripes9", username="zebra")))
        self.assertEqual(password_problems("Zeb#Stripes9", username="zebra"), [])  # fewer than 4 chars never matches


class UserCreateTests(unittest.TestCase):
    def test_email_is_trimmed_and_lowercased_and_username_normalised(self):
        user = UserCreate(username="  Ricky_P ", email="  Ricky@Example.COM ", password=GOOD)
        self.assertEqual(user.email, "ricky@example.com")
        self.assertEqual(user.username, "Ricky_P")

    def test_unknown_fields_are_rejected_so_nobody_can_sign_up_as_admin(self):
        with self.assertRaises(ValidationError):
            UserCreate(username="ricky", email="a@b.com", password=GOOD, is_admin=True)

    def test_weak_password_is_rejected_on_the_server(self):
        with self.assertRaises(ValidationError) as ctx:
            UserCreate(username="ricky", email="a@b.com", password="short")
        self.assertIn("at least 8", str(ctx.exception))

    def test_password_containing_the_email_name_is_rejected(self):
        with self.assertRaises(ValidationError):
            UserCreate(username="someone", email="rickypanu@example.com", password="Rickypanu#2026")

    def test_username_rules(self):
        for bad in ("ab", "has space", "a" * 41, "<script>", "tab\tname", "quote'name"):
            with self.subTest(bad=bad), self.assertRaises(ValidationError):
                UserCreate(username=bad, email="a@b.com", password=GOOD)

    def test_invalid_and_overlong_emails_are_rejected(self):
        for bad in ("not-an-email", "a@b", "x" * 250 + "@example.com"):
            with self.subTest(bad=bad[:20]), self.assertRaises(ValidationError):
                UserCreate(username="ricky", email=bad, password=GOOD)


class ResetAndRefreshSchemaTests(unittest.TestCase):
    def test_forgot_password_normalises_email(self):
        self.assertEqual(ForgotPasswordRequest(email=" A@B.Com ").email, "a@b.com")

    def test_reset_token_must_have_the_exact_shape(self):
        self.assertEqual(ResetPasswordRequest(token=TOKEN, new_password=GOOD).token, TOKEN)
        for bad in ("short", "A" * 44, "A" * 42 + "!", "", "../" * 15):
            with self.subTest(bad=bad), self.assertRaises(ValidationError):
                ResetPasswordRequest(token=bad, new_password=GOOD)

    def test_reset_password_policy_is_enforced(self):
        with self.assertRaises(ValidationError):
            ResetPasswordRequest(token=TOKEN, new_password="weakpass")

    def test_old_field_names_and_extras_are_rejected(self):
        with self.assertRaises(ValidationError):
            ResetPasswordRequest(token=TOKEN, new_password=GOOD, email="a@b.com")

    def test_refresh_token_shape(self):
        RefreshRequest(refresh_token="B" * 64)
        with self.assertRaises(ValidationError):
            RefreshRequest(refresh_token="nope")


class UserUpdateTests(unittest.TestCase):
    def test_every_illustration_the_profile_picker_offers_is_accepted(self):
        self.assertEqual(len(ILLUSTRATIONS), 52)
        for url in ILLUSTRATIONS:
            with self.subTest(url=url[:60]):
                self.assertEqual(UserUpdate(avatar_url=url).avatar_url, url)

    def test_uploaded_avatar_urls_are_accepted(self):
        url = "/uploads/avatars/" + "a1" * 12 + "?v=1760000000"
        self.assertEqual(UserUpdate(avatar_url=url).avatar_url, url)
        self.assertEqual(UserUpdate(avatar_url="/uploads/avatars/" + "a1" * 12).avatar_url, "/uploads/avatars/" + "a1" * 12)

    def test_null_avatar_means_remove(self):
        self.assertIsNone(UserUpdate(avatar_url=None).avatar_url)
        self.assertEqual(UserUpdate(avatar_url=None).model_dump(exclude_unset=True), {"avatar_url": None})

    def test_dangerous_avatar_urls_are_rejected(self):
        svg = "data:image/svg+xml;utf8,"
        good_body = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#fff"/></svg>'
        from urllib.parse import quote

        self.assertEqual(UserUpdate(avatar_url=svg + quote(good_body)).avatar_url, svg + quote(good_body))
        bad = [
            "javascript:alert(1)",
            "http://evil.example/pixel.png",
            "https://evil.example/a.png",
            "https://api.dicebear.com.evil.example/7.x/x/svg?seed=a&backgroundColor=b6e3f4",
            "https://api.dicebear.com/7.x/bottts/svg?seed=a&backgroundColor=b6e3f4&x=<script>",
            "//evil.example/a.png",
            "/uploads/avatars/../../etc/passwd",
            "/uploads/avatars/" + "G" * 24,
            "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
            svg + quote('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
            svg + quote('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>'),
            svg + quote('<svg xmlns="http://www.w3.org/2000/svg"><image href="http://evil/x.png"/></svg>'),
            svg + quote('<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(http://evil/x)"/></svg>'),
            svg + quote('<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>'),
            svg + quote('<!DOCTYPE svg [<!ENTITY a "b">]><svg xmlns="http://www.w3.org/2000/svg"/>'),
            svg + quote('<svg xmlns="http://www.w3.org/2000/svg"><style>*{}</style></svg>'),
            svg + quote("<svg xmlns='http://www.w3.org/2000/svg'>" + "<g>" * 2500 + "</g>" * 2500 + "</svg>"),
            svg + "%3Csvg",  # not well-formed
        ]
        for url in bad:
            with self.subTest(url=url[:70]), self.assertRaises(ValidationError):
                UserUpdate(avatar_url=url)

    def test_only_username_and_avatar_can_be_changed(self):
        for field in ("is_admin", "email", "password_hash", "token_version"):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                UserUpdate(**{field: "x"})

    def test_blank_username_is_an_error(self):
        with self.assertRaises(ValidationError):
            UserUpdate(username="   ")


if __name__ == "__main__":
    unittest.main()
