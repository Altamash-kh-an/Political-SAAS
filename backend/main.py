
import base64
import binascii
import logging
import os
import secrets
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv
import jwt
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    ValidationInfo,
    field_validator,
)
from pwdlib import PasswordHash
from pwdlib.exceptions import UnknownHashError
from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    select,
    text,
)
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    aliased,
    mapped_column,
    relationship,
    validates,
)
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from starlette.responses import JSONResponse

from booth_import import (
    MAX_IMPORT_ROWS,
    BoothImportFormatError,
    parse_booth_import,
)


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
    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    mobile_number: Mapped[str | None] = mapped_column(String(13), nullable=True)
    father_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    qualification: Mapped[str | None] = mapped_column(String(150), nullable=True)
    nearby_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    @validates("role")
    def validate_role(self, _key: str, value: str) -> str:
        if value not in {"admin", "field_worker"}:
            raise ValueError("role must be 'admin' or 'field_worker'")
        return value


class Block(Base):
    __tablename__ = "blocks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("blocks.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    parent: Mapped["Block | None"] = relationship(
        back_populates="children", remote_side="Block.id"
    )
    children: Mapped[list["Block"]] = relationship(back_populates="parent")
    panchayats: Mapped[list["Panchayat"]] = relationship(
        back_populates="block", passive_deletes="all"
    )


class Panchayat(Base):
    __tablename__ = "panchayats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    block_id: Mapped[int | None] = mapped_column(
        ForeignKey("blocks.id", ondelete="RESTRICT"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    block: Mapped[Block | None] = relationship(back_populates="panchayats")
    booths: Mapped[list["Booth"]] = relationship(
        back_populates="panchayat", passive_deletes="all"
    )


class Booth(Base):
    __tablename__ = "booths"
    __table_args__ = (
        UniqueConstraint(
            "panchayat_id", "booth_number", name="uq_booths_panchayat_number"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    panchayat_id: Mapped[int] = mapped_column(
        ForeignKey("panchayats.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    booth_number: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    village_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    panchayat: Mapped[Panchayat] = relationship(back_populates="booths")
    voters: Mapped[list["Voter"]] = relationship(
        back_populates="booth", passive_deletes="all"
    )


class Voter(Base):
    __tablename__ = "voters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booth_id: Mapped[int] = mapped_column(
        ForeignKey("booths.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    electoral_roll_id: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    booth: Mapped[Booth] = relationship(back_populates="voters")


class UserRegistration(BaseModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["admin", "field_worker"]
    full_name: str = Field(min_length=2, max_length=150)
    mobile_number: str = Field(min_length=10, max_length=16)
    father_name: str = Field(min_length=2, max_length=150)
    address: str = Field(min_length=5, max_length=2000)
    qualification: str = Field(min_length=2, max_length=150)
    nearby_location: str = Field(min_length=2, max_length=255)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator(
        "full_name",
        "father_name",
        "address",
        "qualification",
        "nearby_location",
        mode="before",
    )
    @classmethod
    def strip_profile_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("mobile_number", mode="before")
    @classmethod
    def normalize_indian_mobile_number(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip().replace(" ", "").replace("-", "")
        if normalized.startswith("+91"):
            return normalized
        return f"+91{normalized}"

    @field_validator("mobile_number")
    @classmethod
    def validate_indian_mobile_number(cls, value: str) -> str:
        if (
            len(value) != 13
            or not value.startswith("+91")
            or value[3] not in "6789"
            or not value[4:].isdigit()
        ):
            raise ValueError(
                "mobile_number must be a valid Indian mobile number with an optional +91 prefix"
            )
        return value


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    role: str
    created_at: datetime
    full_name: str | None
    mobile_number: str | None
    father_name: str | None
    address: str | None
    qualification: str | None
    nearby_location: str | None


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
    full_name: str | None
    mobile_number: str | None
    father_name: str | None
    address: str | None
    qualification: str | None
    nearby_location: str | None


class PanchayatCreate(BaseModel):
    name: str = Field(min_length=2, max_length=150)
    block_id: int | None = Field(default=None, gt=0)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PanchayatUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    block_id: int | None = Field(default=None, gt=0)

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        if value is None:
            raise ValueError("name cannot be empty")
        return value.strip() if isinstance(value, str) else value


class PanchayatResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    block_id: int | None
    block_name: str | None
    parent_block_id: int | None
    parent_block_name: str | None
    created_at: datetime


class BlockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    parent_id: int | None
    created_at: datetime


class BoothCreate(BaseModel):
    panchayat_id: int = Field(gt=0)
    booth_number: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=150)
    address: str = Field(min_length=3, max_length=2000)
    village_name: str | None = Field(default=None, max_length=150)

    @field_validator("booth_number", "name", "address", mode="before")
    @classmethod
    def strip_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("village_name", mode="before")
    @classmethod
    def normalize_village_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class BoothUpdate(BaseModel):
    panchayat_id: int | None = Field(default=None, gt=0)
    booth_number: str | None = Field(default=None, min_length=1, max_length=32)
    name: str | None = Field(default=None, min_length=1, max_length=150)
    address: str | None = Field(default=None, min_length=3, max_length=2000)
    village_name: str | None = Field(default=None, max_length=150)

    @field_validator("panchayat_id", "booth_number", "name", "address", mode="before")
    @classmethod
    def reject_null_and_strip_text(cls, value: object) -> object:
        if value is None:
            raise ValueError("Updated fields cannot be null")
        return value.strip() if isinstance(value, str) else value

    @field_validator("village_name", mode="before")
    @classmethod
    def normalize_village_name(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip() or None
        return value


class BoothResponse(BaseModel):
    id: int
    panchayat_id: int
    panchayat_name: str
    block_id: int | None
    block_name: str | None
    parent_block_id: int | None
    parent_block_name: str | None
    booth_number: str
    name: str
    address: str
    village_name: str | None
    created_at: datetime


class VoterCreate(BaseModel):
    booth_id: int = Field(gt=0)
    electoral_roll_id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=2, max_length=150)

    @field_validator("electoral_roll_id", mode="before")
    @classmethod
    def normalize_electoral_roll_id(cls, value: object) -> object:
        return value.strip().upper() if isinstance(value, str) else value

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class VoterUpdate(BaseModel):
    booth_id: int | None = Field(default=None, gt=0)
    electoral_roll_id: str | None = Field(default=None, min_length=1, max_length=64)
    name: str | None = Field(default=None, min_length=2, max_length=150)

    @field_validator("booth_id", "electoral_roll_id", "name", mode="before")
    @classmethod
    def reject_null_and_normalize(
        cls, value: object, info: ValidationInfo
    ) -> object:
        if value is None:
            raise ValueError("Updated fields cannot be null")
        if isinstance(value, str):
            value = value.strip()
            return value.upper() if info.field_name == "electoral_roll_id" else value
        return value


class VoterResponse(BaseModel):
    id: int
    booth_id: int
    booth_number: str
    booth_name: str
    panchayat_name: str
    block_id: int | None
    block_name: str | None
    parent_block_id: int | None
    parent_block_name: str | None
    electoral_roll_id: str
    name: str
    created_at: datetime


class AdminSummaryResponse(BaseModel):
    panchayat_count: int
    booth_count: int
    voter_count: int


class BoothImportRow(BaseModel):
    row_number: int = Field(gt=1)
    booth_number: str = Field(max_length=32)
    polling_station_name: str = Field(max_length=150)
    polling_station_address: str = Field(max_length=2000)
    block_name: str = Field(max_length=150)
    village_name: str = Field(default="", max_length=150)
    panchayat_name: str = Field(max_length=150)


class BoothImportConfirmation(BaseModel):
    confirmed: Literal[True]
    rows: list[BoothImportRow] = Field(min_length=1, max_length=MAX_IMPORT_ROWS)


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
logger = logging.getLogger(__name__)


@app.exception_handler(SQLAlchemyError)
async def handle_database_error(request: Request, exc: SQLAlchemyError):
    logger.error(
        "Database request failed for %s",
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "A database error occurred. Check the server logs for details."},
    )

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
        full_name=registration.full_name,
        mobile_number=registration.mobile_number,
        father_name=registration.father_name,
        address=registration.address,
        qualification=registration.qualification,
        nearby_location=registration.nearby_location,
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


async def get_admin_user(
    user: User = Depends(get_current_user),
) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required")
    return user


async def get_panchayat_block(
    session: AsyncSession, block_id: int | None
) -> Block | None:
    if block_id is None:
        return None
    block = await session.get(Block, block_id)
    if block is None:
        raise HTTPException(status_code=404, detail="Block not found")
    if block.parent_id is None:
        raise HTTPException(
            status_code=422, detail="Panchayats must be assigned to a child Block"
        )
    return block


async def get_block_parent(
    session: AsyncSession, block: Block | None
) -> Block | None:
    if block is None or block.parent_id is None:
        return None
    return await session.get(Block, block.parent_id)


def block_response_fields(
    block: Block | None, parent: Block | None
) -> dict[str, int | str | None]:
    return {
        "block_id": block.id if block else None,
        "block_name": block.name if block else None,
        "parent_block_id": parent.id if parent else None,
        "parent_block_name": parent.name if parent else None,
    }


def make_panchayat_response(
    panchayat: Panchayat, block: Block | None, parent: Block | None
) -> PanchayatResponse:
    return PanchayatResponse(
        id=panchayat.id,
        name=panchayat.name,
        created_at=panchayat.created_at,
        **block_response_fields(block, parent),
    )


def make_booth_response(
    booth: Booth,
    panchayat_name: str,
    block: Block | None,
    parent: Block | None,
) -> BoothResponse:
    return BoothResponse(
        id=booth.id,
        panchayat_id=booth.panchayat_id,
        panchayat_name=panchayat_name,
        **block_response_fields(block, parent),
        booth_number=booth.booth_number,
        name=booth.name,
        address=booth.address,
        village_name=booth.village_name,
        created_at=booth.created_at,
    )


def make_voter_response(
    voter: Voter,
    booth_number: str,
    booth_name: str,
    panchayat_name: str,
    block: Block | None,
    parent: Block | None,
) -> VoterResponse:
    return VoterResponse(
        id=voter.id,
        booth_id=voter.booth_id,
        booth_number=booth_number,
        booth_name=booth_name,
        panchayat_name=panchayat_name,
        **block_response_fields(block, parent),
        electoral_roll_id=voter.electoral_roll_id,
        name=voter.name,
        created_at=voter.created_at,
    )


async def get_panchayat_block_context(
    session: AsyncSession, panchayat: Panchayat
) -> tuple[Block | None, Block | None]:
    block = (
        await session.get(Block, panchayat.block_id)
        if panchayat.block_id is not None
        else None
    )
    return block, await get_block_parent(session, block)


async def get_panchayat_response(
    session: AsyncSession, panchayat: Panchayat
) -> PanchayatResponse:
    block, parent = await get_panchayat_block_context(session, panchayat)
    return make_panchayat_response(panchayat, block, parent)


@app.get("/auth/me", response_model=AuthenticatedUserResponse)
async def get_authenticated_user(
    user: User = Depends(get_current_user),
):
    return AuthenticatedUserResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        full_name=user.full_name,
        mobile_number=user.mobile_number,
        father_name=user.father_name,
        address=user.address,
        qualification=user.qualification,
        nearby_location=user.nearby_location,
    )


@app.get("/admin/summary", response_model=AdminSummaryResponse)
async def get_admin_summary(
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    return AdminSummaryResponse(
        panchayat_count=await session.scalar(select(func.count()).select_from(Panchayat)),
        booth_count=await session.scalar(select(func.count()).select_from(Booth)),
        voter_count=await session.scalar(select(func.count()).select_from(Voter)),
    )


@app.get("/workspace/blocks", response_model=list[BlockResponse])
async def list_workspace_blocks(
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return (
        await session.scalars(
            select(Block).order_by(Block.parent_id, Block.name)
        )
    ).all()


@app.get("/admin/blocks", response_model=list[BlockResponse])
async def list_blocks(
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    return (
        await session.scalars(
            select(Block).order_by(Block.parent_id, Block.name)
        )
    ).all()


@app.get("/workspace/panchayats", response_model=list[PanchayatResponse])
async def list_workspace_panchayats(
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    parent_block = aliased(Block)
    rows = (
        await session.execute(
            select(Panchayat, Block, parent_block)
            .outerjoin(Block, Panchayat.block_id == Block.id)
            .outerjoin(parent_block, Block.parent_id == parent_block.id)
            .order_by(Panchayat.name)
        )
    ).all()
    return [
        make_panchayat_response(panchayat, block, parent)
        for panchayat, block, parent in rows
    ]


@app.get("/workspace/booths", response_model=list[BoothResponse])
async def list_workspace_booths(
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    parent_block = aliased(Block)
    rows = (
        await session.execute(
            select(Booth, Panchayat.name, Block, parent_block)
            .join(Panchayat, Booth.panchayat_id == Panchayat.id)
            .outerjoin(Block, Panchayat.block_id == Block.id)
            .outerjoin(parent_block, Block.parent_id == parent_block.id)
            .order_by(Panchayat.name, Booth.booth_number)
        )
    ).all()
    return [
        BoothResponse(
            id=booth.id,
            panchayat_id=booth.panchayat_id,
            panchayat_name=panchayat_name,
            **block_response_fields(block, parent),
            booth_number=booth.booth_number,
            name=booth.name,
            address=booth.address,
            village_name=booth.village_name,
            created_at=booth.created_at,
        )
        for booth, panchayat_name, block, parent in rows
    ]


@app.get("/workspace/voters", response_model=list[VoterResponse])
async def list_workspace_voters(
    _user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    parent_block = aliased(Block)
    rows = (
        await session.execute(
            select(
                Voter,
                Booth.booth_number,
                Booth.name,
                Panchayat.name,
                Block,
                parent_block,
            )
            .join(Booth, Voter.booth_id == Booth.id)
            .join(Panchayat, Booth.panchayat_id == Panchayat.id)
            .outerjoin(Block, Panchayat.block_id == Block.id)
            .outerjoin(parent_block, Block.parent_id == parent_block.id)
            .order_by(Voter.name)
        )
    ).all()
    return [
        VoterResponse(
            id=voter.id,
            booth_id=voter.booth_id,
            booth_number=booth_number,
            booth_name=booth_name,
            panchayat_name=panchayat_name,
            **block_response_fields(block, parent),
            electoral_roll_id=voter.electoral_roll_id,
            name=voter.name,
            created_at=voter.created_at,
        )
        for voter, booth_number, booth_name, panchayat_name, block, parent in rows
    ]


@app.get("/admin/panchayats", response_model=list[PanchayatResponse])
async def list_panchayats(
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    parent_block = aliased(Block)
    rows = (
        await session.execute(
            select(Panchayat, Block, parent_block)
            .outerjoin(Block, Panchayat.block_id == Block.id)
            .outerjoin(parent_block, Block.parent_id == parent_block.id)
            .order_by(Panchayat.name)
        )
    ).all()
    return [
        make_panchayat_response(panchayat, block, parent)
        for panchayat, block, parent in rows
    ]


@app.post(
    "/admin/panchayats",
    response_model=PanchayatResponse,
    status_code=201,
)
async def create_panchayat(
    record: PanchayatCreate,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    block = await get_panchayat_block(session, record.block_id)
    panchayat = Panchayat(name=record.name, block_id=record.block_id)
    session.add(panchayat)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="A Panchayat with that name already exists"
        ) from exc
    await session.refresh(panchayat)
    parent = await get_block_parent(session, block)
    return make_panchayat_response(panchayat, block, parent)


@app.patch("/admin/panchayats/{panchayat_id}", response_model=PanchayatResponse)
async def update_panchayat(
    panchayat_id: int,
    changes: PanchayatUpdate,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    panchayat = await session.get(Panchayat, panchayat_id)
    if panchayat is None:
        raise HTTPException(status_code=404, detail="Panchayat not found")
    fields = changes.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="At least one field is required")
    if "block_id" in fields:
        await get_panchayat_block(session, fields["block_id"])
    for field, value in fields.items():
        setattr(panchayat, field, value)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="A Panchayat with that name already exists"
        ) from exc
    await session.refresh(panchayat)
    return await get_panchayat_response(session, panchayat)


@app.delete("/admin/panchayats/{panchayat_id}", status_code=204)
async def delete_panchayat(
    panchayat_id: int,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    panchayat = await session.get(Panchayat, panchayat_id)
    if panchayat is None:
        raise HTTPException(status_code=404, detail="Panchayat not found")
    booth_count = await session.scalar(
        select(func.count(Booth.id)).where(Booth.panchayat_id == panchayat_id)
    )
    if booth_count:
        raise HTTPException(
            status_code=409,
            detail="Reassign or delete this Panchayat's booths before deleting it",
        )
    await session.delete(panchayat)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Reassign or delete this Panchayat's booths before deleting it",
        ) from exc


async def validate_booth_import_rows(
    session: AsyncSession,
    rows: list[dict[str, object]],
) -> list[dict[str, object]]:
    blocks = (await session.scalars(select(Block))).all()
    panchayats = (await session.scalars(select(Panchayat))).all()
    existing_booths = (
        await session.execute(select(Booth.panchayat_id, Booth.booth_number))
    ).all()

    blocks_by_name: dict[str, list[Block]] = {}
    for block in blocks:
        blocks_by_name.setdefault(block.name.strip().casefold(), []).append(block)
    panchayats_by_name: dict[str, list[Panchayat]] = {}
    for panchayat in panchayats:
        panchayats_by_name.setdefault(
            panchayat.name.strip().casefold(), []
        ).append(panchayat)

    existing_booth_keys = {
        (panchayat_id, booth_number)
        for panchayat_id, booth_number in existing_booths
    }
    validated_rows: list[dict[str, Any]] = []
    rows_by_booth_key: dict[tuple[int, str], int] = {}
    for source in rows:
        row = {
            "row_number": source["row_number"],
            "booth_number": str(source.get("booth_number", "")).strip(),
            "polling_station_name": str(
                source.get("polling_station_name", "")
            ).strip(),
            "polling_station_address": str(
                source.get("polling_station_address", "")
            ).strip(),
            "block_name": str(source.get("block_name", "")).strip(),
            "village_name": str(source.get("village_name", "")).strip(),
            "panchayat_name": str(source.get("panchayat_name", "")).strip(),
            "panchayat_id": None,
            "errors": [],
        }
        errors = list(source.get("parse_errors", []))
        row["errors"] = errors

        required = {
            "booth_number": "Booth number",
            "polling_station_name": "Polling station name",
            "polling_station_address": "Polling station address",
            "block_name": "Block name",
            "panchayat_name": "Panchayat name",
        }
        for field_name, label in required.items():
            if not row[field_name]:
                errors.append(f"{label} is required.")

        field_limits = {
            "booth_number": 32,
            "polling_station_name": 150,
            "polling_station_address": 2000,
            "block_name": 150,
            "village_name": 150,
            "panchayat_name": 150,
        }
        for field_name, max_length in field_limits.items():
            if len(row[field_name]) > max_length:
                errors.append(
                    f"{field_name.replace('_', ' ').capitalize()} "
                    f"must be no longer than {max_length} characters."
                )
            if "\x00" in row[field_name]:
                errors.append(
                    f"{field_name.replace('_', ' ').capitalize()} contains an invalid character."
                )
        if (
            row["polling_station_address"]
            and len(row["polling_station_address"]) < 3
        ):
            errors.append("Polling station address must contain at least 3 characters.")

        block = None
        if row["block_name"]:
            block_matches = blocks_by_name.get(row["block_name"].casefold(), [])
            if len(block_matches) == 1:
                block = block_matches[0]
            elif not block_matches:
                errors.append(f"Block '{row['block_name']}' does not exist.")
            else:
                errors.append(
                    f"Block name '{row['block_name']}' matches multiple records."
                )

        panchayat = None
        if row["panchayat_name"]:
            panchayat_matches = panchayats_by_name.get(
                row["panchayat_name"].casefold(), []
            )
            if len(panchayat_matches) == 1:
                panchayat = panchayat_matches[0]
                row["panchayat_id"] = panchayat.id
            elif not panchayat_matches:
                errors.append(
                    f"Panchayat '{row['panchayat_name']}' does not exist."
                )
            else:
                errors.append(
                    f"Panchayat name '{row['panchayat_name']}' matches multiple records."
                )

        if block is not None and panchayat is not None:
            if panchayat.block_id != block.id:
                errors.append(
                    f"Panchayat '{panchayat.name}' is not assigned to "
                    f"Block '{block.name}'."
                )

            booth_number = row["booth_number"]
            if booth_number:
                key = (panchayat.id, booth_number)
                previous_index = rows_by_booth_key.get(key)
                if previous_index is not None:
                    previous_row = validated_rows[previous_index]
                    previous_row["errors"].append(
                        f"Duplicate booth number in this file (row {row['row_number']})."
                    )
                    errors.append(
                        f"Duplicate booth number in this file (row {previous_row['row_number']})."
                    )
                else:
                    rows_by_booth_key[key] = len(validated_rows)
                if key in existing_booth_keys:
                    errors.append(
                        "This booth number already exists in the selected Panchayat."
                    )

        row["name"] = row["polling_station_name"]
        row["address"] = row["polling_station_address"]
        validated_rows.append(row)

    return validated_rows


async def read_booth_import_upload(request: Request) -> bytes:
    max_file_size = 10 * 1024 * 1024
    chunks = []
    total_size = 0
    async for chunk in request.stream():
        total_size += len(chunk)
        if total_size > max_file_size:
            raise HTTPException(
                status_code=413,
                detail="Import files must be no larger than 10 MB.",
            )
        chunks.append(chunk)
    return b"".join(chunks)


@app.post("/admin/booths/import/preview")
async def preview_booth_import(
    request: Request,
    filename: str = Query(min_length=1, max_length=255),
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    try:
        rows = parse_booth_import(filename, await read_booth_import_upload(request))
    except BoothImportFormatError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if not rows:
        raise HTTPException(
            status_code=422,
            detail="The file does not contain any booth data rows.",
        )

    validated_rows = await validate_booth_import_rows(session, rows)
    error_count = sum(bool(row["errors"]) for row in validated_rows)
    return {
        "row_count": len(validated_rows),
        "valid_count": len(validated_rows) - error_count,
        "error_count": error_count,
        "importable": error_count == 0,
        "rows": validated_rows,
    }


@app.post("/admin/booths/import/confirm")
async def confirm_booth_import(
    confirmation: BoothImportConfirmation,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    if not confirmation.confirmed:
        raise HTTPException(
            status_code=400,
            detail="Explicit confirmation is required before importing booths.",
        )

    validated_rows = await validate_booth_import_rows(
        session,
        [row.model_dump() for row in confirmation.rows],
    )
    if any(row["errors"] for row in validated_rows):
        raise HTTPException(
            status_code=409,
            detail="Import validation changed. Review a new preview before confirming.",
        )

    booths = [
        Booth(
            panchayat_id=row["panchayat_id"],
            booth_number=row["booth_number"],
            name=row["name"],
            address=row["address"],
            village_name=row["village_name"] or None,
        )
        for row in validated_rows
    ]
    session.add_all(booths)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Booth records changed during import. No rows were saved; preview the file again.",
        ) from exc
    return {"imported_count": len(booths)}


@app.get("/admin/booths", response_model=list[BoothResponse])
async def list_booths(
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    parent_block = aliased(Block)
    rows = (
        await session.execute(
            select(Booth, Panchayat.name, Block, parent_block)
            .select_from(Booth)
            .join(Panchayat, Booth.panchayat_id == Panchayat.id)
            .outerjoin(Block, Panchayat.block_id == Block.id)
            .outerjoin(parent_block, Block.parent_id == parent_block.id)
            .order_by(Panchayat.name, Booth.booth_number)
        )
    ).all()
    return [
        make_booth_response(booth, panchayat_name, block, parent)
        for booth, panchayat_name, block, parent in rows
    ]


@app.post("/admin/booths", response_model=BoothResponse, status_code=201)
async def create_booth(
    record: BoothCreate,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    panchayat = await session.get(Panchayat, record.panchayat_id)
    if panchayat is None:
        raise HTTPException(status_code=404, detail="Panchayat not found")
    booth = Booth(**record.model_dump())
    session.add(booth)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="That booth number is already used in this Panchayat",
        ) from exc
    await session.refresh(booth)
    block, parent = await get_panchayat_block_context(session, panchayat)
    return make_booth_response(booth, panchayat.name, block, parent)


@app.patch("/admin/booths/{booth_id}", response_model=BoothResponse)
async def update_booth(
    booth_id: int,
    changes: BoothUpdate,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    booth = await session.get(Booth, booth_id)
    if booth is None:
        raise HTTPException(status_code=404, detail="Booth not found")
    fields = changes.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="At least one field is required")
    panchayat_id = fields.get("panchayat_id", booth.panchayat_id)
    panchayat = await session.get(Panchayat, panchayat_id)
    if panchayat is None:
        raise HTTPException(status_code=404, detail="Panchayat not found")
    for field, value in fields.items():
        setattr(booth, field, value)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="That booth number is already used in this Panchayat",
        ) from exc
    await session.refresh(booth)
    block, parent = await get_panchayat_block_context(session, panchayat)
    return make_booth_response(booth, panchayat.name, block, parent)


@app.delete("/admin/booths/{booth_id}", status_code=204)
async def delete_booth(
    booth_id: int,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    booth = await session.get(Booth, booth_id)
    if booth is None:
        raise HTTPException(status_code=404, detail="Booth not found")
    voter_count = await session.scalar(
        select(func.count(Voter.id)).where(Voter.booth_id == booth_id)
    )
    if voter_count:
        raise HTTPException(
            status_code=409,
            detail="Reassign or delete this booth's voters before deleting it",
        )
    await session.delete(booth)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409,
            detail="Reassign or delete this booth's voters before deleting it",
        ) from exc


@app.get("/admin/voters", response_model=list[VoterResponse])
async def list_voters(
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    parent_block = aliased(Block)
    rows = (
        await session.execute(
            select(
                Voter,
                Booth.booth_number,
                Booth.name,
                Panchayat.name,
                Block,
                parent_block,
            )
            .join(Booth, Voter.booth_id == Booth.id)
            .join(Panchayat, Booth.panchayat_id == Panchayat.id)
            .outerjoin(Block, Panchayat.block_id == Block.id)
            .outerjoin(parent_block, Block.parent_id == parent_block.id)
            .order_by(Voter.name)
        )
    ).all()
    return [
        make_voter_response(
            voter, booth_number, booth_name, panchayat_name, block, parent
        )
        for voter, booth_number, booth_name, panchayat_name, block, parent in rows
    ]


@app.post("/admin/voters", response_model=VoterResponse, status_code=201)
async def create_voter(
    record: VoterCreate,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    booth = await session.get(Booth, record.booth_id)
    if booth is None:
        raise HTTPException(status_code=404, detail="Booth not found")
    panchayat = await session.get(Panchayat, booth.panchayat_id)
    if panchayat is None:
        raise HTTPException(status_code=409, detail="Booth has no valid Panchayat")
    voter = Voter(**record.model_dump())
    session.add(voter)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="That electoral roll ID already exists"
        ) from exc
    await session.refresh(voter)
    block, parent = await get_panchayat_block_context(session, panchayat)
    return make_voter_response(
        voter, booth.booth_number, booth.name, panchayat.name, block, parent
    )


@app.patch("/admin/voters/{voter_id}", response_model=VoterResponse)
async def update_voter(
    voter_id: int,
    changes: VoterUpdate,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    voter = await session.get(Voter, voter_id)
    if voter is None:
        raise HTTPException(status_code=404, detail="Voter not found")
    fields = changes.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="At least one field is required")
    booth_id = fields.get("booth_id", voter.booth_id)
    booth = await session.get(Booth, booth_id)
    if booth is None:
        raise HTTPException(status_code=404, detail="Booth not found")
    panchayat = await session.get(Panchayat, booth.panchayat_id)
    if panchayat is None:
        raise HTTPException(status_code=409, detail="Booth has no valid Panchayat")
    for field, value in fields.items():
        setattr(voter, field, value)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=409, detail="That electoral roll ID already exists"
        ) from exc
    await session.refresh(voter)
    block, parent = await get_panchayat_block_context(session, panchayat)
    return make_voter_response(
        voter, booth.booth_number, booth.name, panchayat.name, block, parent
    )


@app.delete("/admin/voters/{voter_id}", status_code=204)
async def delete_voter(
    voter_id: int,
    _admin: User = Depends(get_admin_user),
    session: AsyncSession = Depends(get_db),
):
    voter = await session.get(Voter, voter_id)
    if voter is None:
        raise HTTPException(status_code=404, detail="Voter not found")
    await session.delete(voter)
    await session.commit()


app = CORSMiddleware(
    app=app,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
