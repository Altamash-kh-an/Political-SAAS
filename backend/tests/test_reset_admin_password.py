import os
import secrets
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "postgresql+asyncpg://user:pass@localhost/test"
os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)

import main
import reset_admin_password


class FakeSession:
    def __init__(self, user):
        self.user = user
        self.statement = None
        self.committed = False
        self.rolled_back = False

    async def scalar(self, statement):
        self.statement = statement
        if self.user is None:
            return None
        if self.user.email != "admin@example.com" or self.user.role != "admin":
            return None
        return self.user

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True


class FakeSessionContext:
    def __init__(self, session):
        self.session = session

    async def __aenter__(self):
        return self.session

    async def __aexit__(self, _exc_type, _exc, _traceback):
        return False


class ResetAdminPasswordTests(unittest.IsolatedAsyncioTestCase):
    def make_user(self, role="admin"):
        return main.User(
            email="admin@example.com",
            role=role,
            password_hash="previous-hash",
        )

    async def test_reset_updates_only_the_admin_password_hash(self):
        user = self.make_user()
        original_values = {
            column.key: getattr(user, column.key)
            for column in main.User.__table__.columns
            if column.key != "password_hash"
        }
        session = FakeSession(user)

        with patch.object(
            reset_admin_password.main,
            "async_session_maker",
            return_value=FakeSessionContext(session),
        ):
            await reset_admin_password.reset_admin_password(
                "admin@example.com", "new-secure-password"
            )

        self.assertTrue(session.committed)
        self.assertFalse(session.rolled_back)
        self.assertNotEqual(user.password_hash, "previous-hash")
        self.assertTrue(
            main.password_hasher.verify("new-secure-password", user.password_hash)
        )
        self.assertEqual(
            {
                column.key: getattr(user, column.key)
                for column in main.User.__table__.columns
                if column.key != "password_hash"
            },
            original_values,
        )

    async def test_reset_rejects_missing_or_non_admin_user_without_commit(self):
        for user in (None, self.make_user(role="field_worker")):
            with self.subTest(user_exists=user is not None):
                session = FakeSession(user)
                with patch.object(
                    reset_admin_password.main,
                    "async_session_maker",
                    return_value=FakeSessionContext(session),
                ):
                    with self.assertRaisesRegex(
                        RuntimeError, "No Admin account matches"
                    ):
                        await reset_admin_password.reset_admin_password(
                            "admin@example.com", "new-secure-password"
                        )
                self.assertFalse(session.committed)

    async def test_reset_rejects_password_outside_backend_limits(self):
        with self.assertRaisesRegex(ValueError, "8 and 128"):
            await reset_admin_password.reset_admin_password(
                "admin@example.com", "short"
            )


if __name__ == "__main__":
    unittest.main()
