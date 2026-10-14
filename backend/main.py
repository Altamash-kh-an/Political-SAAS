
import base64
import binascii
import os
import secrets
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
import jwt
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from sqlalchemy import DateTime, Integer, String, func, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, validates
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    @validates("role")
    def validate_role(self, _key: str, value: str) -> str:
        if value not in {"admin", "field_worker"}:
            raise ValueError("role must be 'admin' or 'field_worker'")
        return value


class UserRegistration(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["admin", "field_worker"]

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    created_at: datetime


class UserLogin(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class UserLoginResponse(BaseModel):
    id: int
    email: str
    role: str
    access_token: str
    token_type: Literal["bearer"]


class AuthenticatedUserResponse(BaseModel):
    id: int
    email: str
    role: str


password_hasher = PasswordHash.recommended()
dummy_password_hash = password_hasher.hash(secrets.token_urlsafe(32))
bearer_scheme = HTTPBearer(auto_error=False)


load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

jwt_secret_key_value = os.getenv("JWT_SECRET_KEY")
if not jwt_secret_key_value or not jwt_secret_key_value.strip():
    raise ValueError("JWT_SECRET_KEY must be a URL-safe Base64 encoding of 32 random bytes")
try:
    jwt_secret_key = base64.b64decode(
        jwt_secret_key_value + "=" * (-len(jwt_secret_key_value) % 4),
        altchars=b"-_",
        validate=True,
    )
except (binascii.Error, ValueError):
    jwt_secret_key = b""
if (
    len(jwt_secret_key) != 32
    or base64.urlsafe_b64encode(jwt_secret_key).decode("ascii").rstrip("=")
    != jwt_secret_key_value
):
    raise ValueError("JWT_SECRET_KEY must be a URL-safe Base64 encoding of 32 random bytes")

try:
    jwt_access_token_expire_minutes = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "15")
    )
except ValueError:
    raise ValueError(
        "JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be a positive integer"
    ) from None
if jwt_access_token_expire_minutes < 1:
    raise ValueError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be a positive integer")

database_url_value = os.getenv("DATABASE_URL")
if not database_url_value or not database_url_value.strip():
    raise ValueError("DATABASE_URL must be configured")

database_url = make_url(database_url_value)
if database_url.drivername in {"postgres", "postgresql"}:
    database_url = database_url.set(drivername="postgresql+asyncpg")
elif database_url.drivername != "postgresql+asyncpg":
    raise ValueError("DATABASE_URL must use a PostgreSQL URL scheme")

connect_args = {}
sslmode = database_url.query.get("sslmode")
database_url = database_url.difference_update_query(["channel_binding"])
if sslmode is not None:
    database_url = database_url.difference_update_query(["sslmode"])
    connect_args["ssl"] = sslmode

engine = create_async_engine(
    database_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    try:
        yield
    finally:
        await engine.dispose()


app = FastAPI(title="Political-SAAS API", lifespan=lifespan)

@app.get("/")
def home():
    return {"message": "Political-SAAS Backend is running!"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/db-check")
async def db_check(session: AsyncSession = Depends(get_db)):
    try:
        await session.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        ) from exc

    return {"database": "connected"}


@app.post("/auth/register", response_model=UserResponse, status_code=201)
async def register_user(
    registration: UserRegistration,
    session: AsyncSession = Depends(get_db),
):
    if registration.role == "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin accounts must be provisioned through a trusted process",
        )

    existing_user_id = await session.scalar(
        select(User.id).where(User.email == registration.email)
    )
    if existing_user_id is not None:
        raise HTTPException(status_code=409, detail="Email is already registered")

    user = User(
        email=registration.email,
        password_hash=password_hasher.hash(registration.password),
        role=registration.role,
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        ) from exc

    await session.refresh(user)
    return user


@app.post("/auth/login", response_model=UserLoginResponse)
async def login_user(
    credentials: UserLogin,
    session: AsyncSession = Depends(get_db),
):
    user = await session.scalar(
        select(User).where(User.email == credentials.email)
    )
    try:
        password_is_valid = password_hasher.verify(
            credentials.password,
            user.password_hash if user is not None else dummy_password_hash,
        )
    except UnknownHashError:
        password_is_valid = False

    if user is None or not password_is_valid:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    now = datetime.now(timezone.utc)
    access_token = jwt.encode(
        {
            "sub": str(user.id),
            "iat": now,
            "exp": now + timedelta(minutes=jwt_access_token_expire_minutes),
        },
        jwt_secret_key,
        algorithm="HS256",
    )
    return UserLoginResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        access_token=access_token,
        token_type="bearer",
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=401,
        detail="Invalid or expired authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(
            credentials.credentials,
            jwt_secret_key,
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sub"]},
        )
        subject = payload.get("sub")
        if not isinstance(subject, str) or not subject.isdecimal():
            raise jwt.InvalidTokenError("Invalid subject")
        user_id = int(subject)
    except (jwt.InvalidTokenError, ValueError):
        raise unauthorized from None

    user = await session.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


@app.get("/auth/me", response_model=AuthenticatedUserResponse)
async def get_authenticated_user(
    user: User = Depends(get_current_user),
):
    return AuthenticatedUserResponse(id=user.id, email=user.email, role=user.role)
