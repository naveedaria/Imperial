"""Watchlist CRUD endpoints scoped to the authenticated user."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_user, get_session
from app.logging_config import logger
from app.models import User, WatchlistItem
from app.schemas import WatchlistCreateRequest, WatchlistItemResponse
from app.services.prices import get_price_history
from app.validation import validate_ticker


WATCHLIST_LIMIT = 10

router = APIRouter(prefix="/watchlist", tags=["watchlist"])


def _serialize(item: WatchlistItem) -> WatchlistItemResponse:
    return WatchlistItemResponse(
        id=item.id, ticker=item.ticker, created_at=item.created_at
    )


@router.get("", response_model=list[WatchlistItemResponse])
async def list_watchlist(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[WatchlistItemResponse]:
    result = await session.execute(
        select(WatchlistItem)
        .where(WatchlistItem.user_id == user.id)
        .order_by(WatchlistItem.created_at.asc(), WatchlistItem.ticker.asc())
    )
    return [_serialize(item) for item in result.scalars().all()]


@router.post("", response_model=WatchlistItemResponse, status_code=status.HTTP_201_CREATED)
async def add_watchlist_item(
    payload: WatchlistCreateRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> WatchlistItemResponse:
    ticker = validate_ticker(payload.ticker)

    count_result = await session.execute(
        select(func.count())
        .select_from(WatchlistItem)
        .where(WatchlistItem.user_id == user.id)
    )
    if count_result.scalar_one() >= WATCHLIST_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Watchlist is limited to {WATCHLIST_LIMIT} tickers.",
        )

    price_response = await get_price_history(ticker)
    if not price_response.points:
        logger.info("Rejected unknown ticker %s for user %s", ticker, user.id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{ticker} is not a recognized ticker symbol. "
                "Please double-check and try again."
            ),
        )

    item = WatchlistItem(user_id=user.id, ticker=ticker)
    session.add(item)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ticker is already on this watchlist.",
        )
    await session.refresh(item)

    logger.info("Added ticker %s for user %s", ticker, user.id)
    return _serialize(item)


@router.delete("/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_watchlist_item(
    ticker: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    normalized_ticker = validate_ticker(ticker)

    result = await session.execute(
        select(WatchlistItem).where(
            WatchlistItem.user_id == user.id,
            WatchlistItem.ticker == normalized_ticker,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticker is not on this watchlist.",
        )

    await session.delete(item)
    await session.commit()

    logger.info("Removed ticker %s for user %s", normalized_ticker, user.id)
