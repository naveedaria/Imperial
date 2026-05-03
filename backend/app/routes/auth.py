"""Authentication endpoints: register and login."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_session
from app.logging_config import logger
from app.models import User
from app.schemas import AuthRequest, UserResponse
from app.security import hash_password, normalize_email, verify_password
from app.validation import validate_auth_request


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: AuthRequest,
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    email = validate_auth_request(payload)
    user = User(email=email, password_hash=hash_password(payload.password))

    session.add(user)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )
    await session.refresh(user)

    logger.info("Registered user %s", user.id)
    return UserResponse(id=user.id, email=user.email)


@router.post("/login", response_model=UserResponse)
async def login(
    payload: AuthRequest,
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    email = normalize_email(payload.email)

    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    logger.info("Logged in user %s", user.id)
    return UserResponse(id=user.id, email=user.email)
