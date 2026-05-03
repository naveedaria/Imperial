"""Idempotent demo data seeder.

Creates (or refreshes) a handful of demo users with starter watchlists.
Safe to re-run: existing users get their password reset, existing watchlist
rows are left in place.
"""

import asyncio

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.logging_config import configure_logging, logger
from app.models import User, WatchlistItem
from app.security import hash_password, normalize_email, normalize_ticker


configure_logging()


DEMO_USERS = [
    {"email": "demo@example.com", "password": "password123", "tickers": ["AAPL", "MSFT", "NVDA"]},
    {"email": "alice@example.com", "password": "password123", "tickers": ["TSLA", "AMZN"]},
    {"email": "bob@example.com", "password": "password123", "tickers": ["GOOG"]},
]


async def seed_users() -> None:
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    async with SessionLocal() as session:
        for demo_user in DEMO_USERS:
            email = normalize_email(demo_user["email"])
            result = await session.execute(select(User).where(User.email == email))
            existing_user = result.scalar_one_or_none()

            if existing_user:
                existing_user.password_hash = hash_password(demo_user["password"])
                user = existing_user
                logger.info("Updated demo user %s", email)
            else:
                user = User(
                    email=email,
                    password_hash=hash_password(demo_user["password"]),
                )
                session.add(user)
                await session.flush()
                logger.info("Created demo user %s", email)

            for ticker in demo_user["tickers"]:
                normalized_ticker = normalize_ticker(ticker)
                watchlist_result = await session.execute(
                    select(WatchlistItem).where(
                        WatchlistItem.user_id == user.id,
                        WatchlistItem.ticker == normalized_ticker,
                    )
                )
                if watchlist_result.scalar_one_or_none():
                    continue

                session.add(WatchlistItem(user_id=user.id, ticker=normalized_ticker))
                logger.info("Added demo ticker %s for %s", normalized_ticker, email)

        await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_users())
