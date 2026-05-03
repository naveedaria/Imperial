"""FastAPI dependencies shared across route modules.

* ``get_session`` yields an async SQLAlchemy session per request.
* ``get_current_user`` reads ``X-User-Id`` and resolves the row, replacing the
  former ``get_user_or_404`` helper that every authenticated route had to call
  manually.
"""

from collections.abc import AsyncIterator

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import SessionLocal
from app.models import User


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


async def get_current_user(
    x_user_id: str = Header(..., alias="X-User-Id"),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Resolve the user identified by the ``X-User-Id`` header.

    For this take-home, the header itself is the auth token: there is no JWT
    or session. A real deployment would swap this out for a real auth scheme.
    """

    result = await session.execute(select(User).where(User.id == x_user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found."
        )
    return user
