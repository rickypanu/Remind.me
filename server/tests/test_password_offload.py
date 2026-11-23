"""CPU-bound hashing must not block the event loop and must not run unbounded (finding P4); key parsing is cached."""

import asyncio
import threading
import time
import unittest
from unittest.mock import patch

from tests import auth_stubs  # noqa: F401  (must stay first: it prepares the test environment)

# isort: split

from app.core.config import get_settings  # noqa: E402
from utils import crypto, security  # noqa: E402


class OffloadTests(unittest.IsolatedAsyncioTestCase):
    async def test_hashing_and_verifying_run_on_a_worker_thread(self):
        main_thread = threading.get_ident()
        seen: dict[str, int] = {}
        real_hash, real_verify = security.get_password_hash, security.verify_password_or_dummy

        def spy_hash(password):
            seen["hash"] = threading.get_ident()
            return real_hash(password)

        def spy_verify(password, hashed):
            seen["verify"] = threading.get_ident()
            return real_verify(password, hashed)

        with patch.object(security, "get_password_hash", spy_hash), patch.object(security, "verify_password_or_dummy", spy_verify):
            hashed = await security.ahash_password("Tr0ub4dor&Horse")
            self.assertTrue(await security.averify_password("Tr0ub4dor&Horse", hashed))
            self.assertFalse(await security.averify_password("wrong", None))  # unknown user: dummy verify, same path
        self.assertNotEqual(seen["hash"], main_thread)
        self.assertNotEqual(seen["verify"], main_thread)

    async def test_the_event_loop_keeps_running_while_a_hash_is_computed(self):
        ticks = 0

        def slow_hash(_password):
            time.sleep(0.3)  # stands in for argon2's ~50-100 ms of CPU
            return "$argon2id$slow"

        async def heartbeat():
            nonlocal ticks
            while True:
                await asyncio.sleep(0.01)
                ticks += 1

        beat = asyncio.create_task(heartbeat())
        try:
            with patch.object(security, "get_password_hash", slow_hash):
                await security.ahash_password("x")
        finally:
            beat.cancel()
        self.assertGreaterEqual(ticks, 10, "the loop was blocked while hashing")

    async def test_at_most_the_configured_number_of_hashes_run_at_once(self):
        limit = get_settings().password_hash_concurrency
        lock = threading.Lock()
        running = peak = 0

        def tracked(_password):
            nonlocal running, peak
            with lock:
                running += 1
                peak = max(peak, running)
            time.sleep(0.05)
            with lock:
                running -= 1
            return "$argon2id$x"

        with patch.object(security, "get_password_hash", tracked):
            await asyncio.gather(*(security.ahash_password(str(n)) for n in range(limit * 3)))
        self.assertLessEqual(peak, limit)
        self.assertGreaterEqual(peak, min(2, limit), "hashes did not overlap at all")

    def test_each_event_loop_gets_its_own_semaphore(self):
        async def grab():
            return security._hash_semaphore()

        first, second = asyncio.run(grab()), asyncio.run(grab())
        self.assertIsNot(first, second)

    async def test_the_semaphore_is_reused_within_a_loop(self):
        self.assertIs(security._hash_semaphore(), security._hash_semaphore())

    async def test_a_failing_hash_releases_its_slot(self):
        def boom(_password):
            raise RuntimeError("no memory")

        with patch.object(security, "get_password_hash", boom):
            for _ in range(get_settings().password_hash_concurrency + 2):
                with self.assertRaises(RuntimeError):
                    await security.ahash_password("x")
        self.assertTrue((await security.ahash_password("fine")).startswith("$argon2"))


class CryptoKeyCacheTests(unittest.TestCase):
    def test_master_keys_are_parsed_once_per_configuration(self):
        crypto._parse_master_keys.cache_clear()
        crypto.encrypt_text("u1", "title", "a")
        before = crypto._parse_master_keys.cache_info()
        for _ in range(25):
            crypto.encrypt_text("u1", "title", "a")
        after = crypto._parse_master_keys.cache_info()
        self.assertEqual(after.misses, before.misses)  # no re-parsing
        self.assertGreaterEqual(after.hits - before.hits, 25)

    def test_changing_the_key_in_the_environment_is_picked_up(self):
        import os

        original = os.environ["REMINDER_ENCRYPTION_KEY"]
        token = crypto.encrypt_text("u1", "title", "secret")
        try:
            os.environ["REMINDER_ENCRYPTION_KEY"] = "Zz9" + original[3:]
            self.assertEqual(crypto.decrypt_text("u1", "title", token), crypto.UNREADABLE)
        finally:
            os.environ["REMINDER_ENCRYPTION_KEY"] = original
        self.assertEqual(crypto.decrypt_text("u1", "title", token), "secret")


if __name__ == "__main__":
    unittest.main()


class Argon2ConfigTests(unittest.TestCase):
    """ARGON2_* settings reach the hasher; unset keeps the library defaults (free-tier tuning, 0.1 CPU)."""

    def _hasher_with(self, env):
        from unittest.mock import patch

        from app.core.config import get_settings
        from utils import security

        base = {"SECRET_KEY": "Qm7vX2pLr9TzK4wYb8NcJ3hFd6SgU1aE5oIxV0eRt", "REMINDER_ENCRYPTION_KEY": "Hn3Zc8Ws1Ke6Dy9Bq4Pj7Lt2Vf5Gm0Ua8Rx3Ni6Oo1Xb"}
        with patch.dict("os.environ", {**base, **env}, clear=True):
            get_settings.cache_clear()
            security._get_hasher.cache_clear()
            try:
                return security._get_hasher()
            finally:
                get_settings.cache_clear()
                security._get_hasher.cache_clear()

    def test_unset_means_library_defaults(self):
        self.assertEqual(getattr(self._hasher_with({}), "kwargs", {}), {})

    def test_overrides_are_passed_through(self):
        h = self._hasher_with({"ARGON2_TIME_COST": "2", "ARGON2_MEMORY_KIB": "19456", "ARGON2_PARALLELISM": "1"})
        self.assertEqual(h.kwargs, {"time_cost": 2, "memory_cost": 19456, "parallelism": 1})
