import logging
import os
import secrets
import hashlib
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func, text, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.prices import PriceHistoryResponse, get_price_history


LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://imperial:imperial@db:5432/imperial")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("imperial.backend")

engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"
    __table_args__ = (UniqueConstraint("user_id", "ticker", name="uq_watchlist_user_ticker"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    ticker: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class AuthRequest(BaseModel):
    email: str
    password: str


class WatchlistCreateRequest(BaseModel):
    ticker: str


class UserResponse(BaseModel):
    id: str
    email: str


class WatchlistItemResponse(BaseModel):
    id: str
    ticker: str
    created_at: datetime


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_ticker(ticker: str) -> str:
    return ticker.strip().upper()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, expected_digest = stored_hash.split("$", 2)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    actual_digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000)
    return secrets.compare_digest(actual_digest.hex(), expected_digest)


def validate_auth_request(payload: AuthRequest) -> str:
    email = normalize_email(payload.email)
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a valid email address.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters.")
    return email


def validate_ticker(ticker: str) -> str:
    normalized = normalize_ticker(ticker)
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Ticker is required.")
    if len(normalized) > 10 or not normalized.replace(".", "").replace("-", "").isalnum():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Enter a valid ticker symbol.")
    return normalized


async def get_user_or_404(user_id: str) -> User:
    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    return user


def serialize_watchlist_item(item: WatchlistItem) -> WatchlistItemResponse:
    return WatchlistItemResponse(id=item.id, ticker=item.ticker, created_at=item.created_at)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Backend starting")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")
    yield
    await engine.dispose()
    logger.info("Backend stopped")


app = FastAPI(title="Imperial Watchlist API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - started_at) * 1000
    logger.info(
        "%s %s -> %s %.2fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.get("/health")
async def health():
    db_status = "ok"
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        logger.exception("Database health check failed")
        db_status = "error"

    return {"status": "ok", "database": db_status}


@app.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: AuthRequest):
    email = validate_auth_request(payload)
    user = User(email=email, password_hash=hash_password(payload.password))

    async with SessionLocal() as session:
        session.add(user)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
        await session.refresh(user)

    logger.info("Registered user %s", user.id)
    return UserResponse(id=user.id, email=user.email)


@app.post("/auth/login", response_model=UserResponse)
async def login(payload: AuthRequest):
    email = normalize_email(payload.email)

    async with SessionLocal() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    logger.info("Logged in user %s", user.id)
    return UserResponse(id=user.id, email=user.email)


@app.get("/watchlist", response_model=list[WatchlistItemResponse])
async def list_watchlist(x_user_id: str = Header(..., alias="X-User-Id")):
    await get_user_or_404(x_user_id)

    async with SessionLocal() as session:
        result = await session.execute(
            select(WatchlistItem)
            .where(WatchlistItem.user_id == x_user_id)
            .order_by(WatchlistItem.created_at.asc(), WatchlistItem.ticker.asc())
        )
        items = result.scalars().all()

    return [serialize_watchlist_item(item) for item in items]


@app.post("/watchlist", response_model=WatchlistItemResponse, status_code=status.HTTP_201_CREATED)
async def add_watchlist_item(payload: WatchlistCreateRequest, x_user_id: str = Header(..., alias="X-User-Id")):
    await get_user_or_404(x_user_id)
    ticker = validate_ticker(payload.ticker)

    async with SessionLocal() as session:
        count_result = await session.execute(select(func.count()).select_from(WatchlistItem).where(WatchlistItem.user_id == x_user_id))
        item_count = count_result.scalar_one()
        if item_count >= 10:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Watchlist is limited to 10 tickers.")

        item = WatchlistItem(user_id=x_user_id, ticker=ticker)
        session.add(item)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ticker is already on this watchlist.")
        await session.refresh(item)

    logger.info("Added ticker %s for user %s", ticker, x_user_id)
    return serialize_watchlist_item(item)


@app.delete("/watchlist/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_watchlist_item(ticker: str, x_user_id: str = Header(..., alias="X-User-Id")):
    await get_user_or_404(x_user_id)
    normalized_ticker = validate_ticker(ticker)

    async with SessionLocal() as session:
        result = await session.execute(
            select(WatchlistItem).where(
                WatchlistItem.user_id == x_user_id,
                WatchlistItem.ticker == normalized_ticker,
            )
        )
        item = result.scalar_one_or_none()
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticker is not on this watchlist.")

        await session.delete(item)
        await session.commit()

    logger.info("Removed ticker %s for user %s", normalized_ticker, x_user_id)


@app.get("/prices/{ticker}", response_model=PriceHistoryResponse)
async def price_history(ticker: str):
    normalized_ticker = validate_ticker(ticker)
    logger.info("Fetching price history for %s", normalized_ticker)
    response = await get_price_history(normalized_ticker)
    return response
