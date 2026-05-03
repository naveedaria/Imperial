import asyncio

from sqlalchemy import select

from app.main import Base, SessionLocal, User, engine, hash_password, logger, normalize_email


DEMO_USERS = [
    {"email": "demo@example.com", "password": "password123"},
    {"email": "alice@example.com", "password": "password123"},
    {"email": "bob@example.com", "password": "password123"},
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
                logger.info("Updated demo user %s", email)
                continue

            session.add(User(email=email, password_hash=hash_password(demo_user["password"])))
            logger.info("Created demo user %s", email)

        await session.commit()

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed_users())
