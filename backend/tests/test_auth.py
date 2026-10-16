import asyncio
import os
import secrets
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["DATABASE_URL"] = "postgresql://test:test@localhost/test"
os.environ["JWT_SECRET_KEY"] = secrets.token_urlsafe(32)

import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

import main


class FakeSession:
    def __init__(self, user=None):
        self.user = user
        self.added_user = None
        self.committed = False
        self.rolled_back = False

    async def scalar(self, _statement):
        return self.user

    def add(self, user):
        self.added_user = user

    async def commit(self):
        self.committed = True

    async def rollback(self):
        self.rolled_back = True

    async def refresh(self, user):
        user.id = 10
        user.created_at = datetime.now(timezone.utc)

    async def get(self, model, user_id):
        if self.user is not None and self.user.id == user_id:
            return self.user
        return None


class AuthenticationTests(unittest.IsolatedAsyncioTestCase):
    def profile_fields(self):
        return {
            "full_name": "Field Worker",
            "mobile_number": "9876543210",
            "father_name": "Parent Name",
            "address": "12 Sample Road, Locality",
            "qualification": "Graduate",
            "nearby_location": "Central Market",
        }

    def make_user(self, password="correct-password"):
        return main.User(
            id=10,
            email="person@example.com",
            role="field_worker",
            password_hash=main.password_hasher.hash(password),
        )

    def test_registration_email_is_normalized_and_validated(self):
        request = main.UserRegistration(
            email="  PERSON@example.com ",
            **self.profile_fields(),
            password="correct-password",
            role="field_worker",
        )
        self.assertEqual(request.email, "person@example.com")
        for email in ("a..b@example.com", "user@-bad-.com", "user@example..com"):
            with self.subTest(email=email), self.assertRaises(ValidationError):
                main.UserRegistration(
                    email=email,
                    **self.profile_fields(),
                    password="correct-password",
                    role="field_worker",
                )

    def test_registration_normalizes_indian_mobile_number(self):
        for mobile in ("9876543210", "+919876543210", "+91 9876543210"):
            with self.subTest(mobile=mobile):
                request = main.UserRegistration(
                    email="person@example.com",
                    password="long-enough-password",
                    role="field_worker",
                    mobile_number=mobile,
                    full_name="Field Worker",
                    father_name="Parent Name",
                    address="12 Sample Road, Locality",
                    qualification="Graduate",
                    nearby_location="Central Market",
                )
                self.assertEqual(request.mobile_number, "+919876543210")

        for mobile in ("1234567890", "987654321", "+9198765432101"):
            with self.subTest(mobile=mobile), self.assertRaises(ValidationError):
                main.UserRegistration(
                    email="person@example.com",
                    password="long-enough-password",
                    role="field_worker",
                    mobile_number=mobile,
                    full_name="Field Worker",
                    father_name="Parent Name",
                    address="12 Sample Road, Locality",
                    qualification="Graduate",
                    nearby_location="Central Market",
                )

    async def test_registration_stores_only_a_password_hash(self):
        session = FakeSession()
        request = main.UserRegistration(
            email="person@example.com",
            **self.profile_fields(),
            password="correct-password",
            role="field_worker",
        )

        user = await main.register_user(request, session)

        self.assertTrue(session.committed)
        self.assertEqual(user.password_hash, session.added_user.password_hash)
        self.assertNotEqual(user.password_hash, request.password)
        self.assertTrue(
            main.password_hasher.verify(request.password, user.password_hash)
        )

    async def test_public_registration_cannot_assign_admin_role(self):
        session = FakeSession()
        request = main.UserRegistration(
            email="admin@example.com",
            **self.profile_fields(),
            password="correct-password",
            role="admin",
        )

        with self.assertRaises(HTTPException) as raised:
            await main.register_user(request, session)

        self.assertEqual(raised.exception.status_code, 403)
        self.assertIsNone(session.added_user)

    async def test_registration_rejects_duplicate_email(self):
        session = FakeSession(self.make_user())
        request = main.UserRegistration(
            email="person@example.com",
            **self.profile_fields(),
            password="correct-password",
            role="field_worker",
        )

        with self.assertRaises(HTTPException) as raised:
            await main.register_user(request, session)

        self.assertEqual(raised.exception.status_code, 409)
        self.assertFalse(session.committed)

    async def test_login_issues_token_and_response_has_safe_fields(self):
        user = self.make_user()
        response = await main.login_user(
            main.UserLogin(
                email=" PERSON@EXAMPLE.COM ",
                password="correct-password",
            ),
            FakeSession(user),
        )

        payload = jwt.decode(
            response.access_token,
            main.jwt_secret_key,
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub"]},
        )
        self.assertEqual(payload["sub"], str(user.id))
        self.assertEqual(response.email, user.email)
        self.assertEqual(response.token_type, "bearer")
        self.assertNotIn("password_hash", response.model_dump())
        self.assertNotIn("password", response.model_dump())

    async def test_login_uses_same_generic_error_for_unknown_user_and_bad_password(self):
        for session, password in (
            (FakeSession(), "correct-password"),
            (FakeSession(self.make_user()), "wrong-password"),
        ):
            with self.subTest(user_exists=session.user is not None):
                with self.assertRaises(HTTPException) as raised:
                    await main.login_user(
                        main.UserLogin(
                            email="person@example.com",
                            password=password,
                        ),
                        session,
                    )
                self.assertEqual(raised.exception.status_code, 401)
                self.assertEqual(
                    raised.exception.detail,
                    "Invalid email or password",
                )

    async def test_current_user_rejects_invalid_expired_and_missing_exp_tokens(self):
        session = FakeSession(self.make_user())
        now = datetime.now(timezone.utc)
        tokens = [
            "malformed",
            jwt.encode(
                {"sub": "10", "iat": now, "exp": now + timedelta(minutes=1)},
                main.jwt_secret_key,
                algorithm="HS384",
            ),
            jwt.encode(
                {"sub": "10", "iat": now, "exp": now + timedelta(minutes=1)},
                b"not-the-signing-key-0123456789ab",
                algorithm="HS256",
            ),
            jwt.encode(
                {"sub": "10", "iat": now, "exp": now - timedelta(seconds=1)},
                main.jwt_secret_key,
                algorithm="HS256",
            ),
            jwt.encode(
                {"sub": "10", "iat": now},
                main.jwt_secret_key,
                algorithm="HS256",
            ),
        ]

        for token in tokens:
            with self.subTest(token=token[:10]):
                with self.assertRaises(HTTPException) as raised:
                    await main.get_current_user(
                        HTTPAuthorizationCredentials(
                            scheme="Bearer",
                            credentials=token,
                        ),
                        session,
                    )
                self.assertEqual(raised.exception.status_code, 401)

    async def test_current_user_is_loaded_from_database(self):
        user = self.make_user()
        session = FakeSession(user)
        token = jwt.encode(
            {
                "sub": str(user.id),
                "iat": datetime.now(timezone.utc),
                "exp": datetime.now(timezone.utc) + timedelta(minutes=1),
            },
            main.jwt_secret_key,
            algorithm="HS256",
        )

        current_user = await main.get_current_user(
            HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
            session,
        )
        response = await main.get_authenticated_user(current_user)

        self.assertEqual(
            response.model_dump(),
            {
                "id": user.id,
                "email": user.email,
                "role": user.role,
                "full_name": None,
                "mobile_number": None,
                "father_name": None,
                "address": None,
                "qualification": None,
                "nearby_location": None,
            },
        )

    async def test_authenticated_profile_returns_safe_profile_fields(self):
        user = self.make_user()
        user.full_name = "Field Worker"
        user.mobile_number = "+919876543210"
        user.father_name = "Parent Name"
        user.address = "12 Sample Road, Locality"
        user.qualification = "Graduate"
        user.nearby_location = "Central Market"

        response = await main.get_authenticated_user(user)

        self.assertEqual(response.full_name, user.full_name)
        self.assertEqual(response.mobile_number, user.mobile_number)
        self.assertEqual(response.father_name, user.father_name)
        self.assertEqual(response.address, user.address)
        self.assertEqual(response.qualification, user.qualification)
        self.assertEqual(response.nearby_location, user.nearby_location)
        self.assertNotIn("password_hash", response.model_dump())
        self.assertNotIn("password", response.model_dump())


if __name__ == "__main__":
    unittest.main()
