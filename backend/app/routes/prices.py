"""Price history endpoint."""

from fastapi import APIRouter

from app.logging_config import logger
from app.services.prices import PriceHistoryResponse, get_price_history
from app.validation import validate_ticker


router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("/{ticker}", response_model=PriceHistoryResponse)
async def price_history(ticker: str) -> PriceHistoryResponse:
    normalized = validate_ticker(ticker)
    logger.info("Fetching price history for %s", normalized)
    return await get_price_history(normalized)
