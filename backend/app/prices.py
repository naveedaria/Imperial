import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Optional

import yfinance as yf
from pydantic import BaseModel


logger = logging.getLogger("imperial.backend.prices")

CACHE_TTL_SECONDS = 60.0
HISTORY_PERIOD = "7d"
HISTORY_INTERVAL = "5m"


class PricePoint(BaseModel):
    timestamp: str
    open: Optional[float]
    high: Optional[float]
    low: Optional[float]
    close: Optional[float]
    volume: Optional[int]


class PriceHistoryResponse(BaseModel):
    ticker: str
    interval: str
    period: str
    points: list[PricePoint]
    warning: Optional[str] = None


@dataclass
class _CacheEntry:
    expires_at: float
    response: PriceHistoryResponse


_cache: dict[str, _CacheEntry] = {}
_cache_lock = asyncio.Lock()


def _fetch_history_sync(ticker: str) -> PriceHistoryResponse:
    """Run the synchronous yfinance call. Always returns a response, never raises."""

    response = PriceHistoryResponse(
        ticker=ticker,
        interval=HISTORY_INTERVAL,
        period=HISTORY_PERIOD,
        points=[],
    )

    try:
        history = yf.Ticker(ticker).history(
            period=HISTORY_PERIOD,
            interval=HISTORY_INTERVAL,
            auto_adjust=False,
        )
    except Exception as error:  # noqa: BLE001 - yfinance can raise many kinds of errors.
        logger.exception("yfinance lookup failed for %s", ticker)
        response.warning = f"Could not load price data: {error}"
        return response

    if history is None or history.empty:
        logger.warning("yfinance returned no data for %s", ticker)
        response.warning = "No recent price data is available for this ticker."
        return response

    points: list[PricePoint] = []
    for index, row in history.iterrows():
        try:
            timestamp = index.isoformat() if hasattr(index, "isoformat") else str(index)
        except Exception:  # noqa: BLE001
            timestamp = str(index)

        points.append(
            PricePoint(
                timestamp=timestamp,
                open=_clean_float(row.get("Open")),
                high=_clean_float(row.get("High")),
                low=_clean_float(row.get("Low")),
                close=_clean_float(row.get("Close")),
                volume=_clean_int(row.get("Volume")),
            )
        )

    response.points = points
    return response


def _clean_float(value) -> Optional[float]:
    try:
        if value is None:
            return None
        as_float = float(value)
    except (TypeError, ValueError):
        return None
    if as_float != as_float:  # NaN check without importing math.
        return None
    return as_float


def _clean_int(value) -> Optional[int]:
    cleaned = _clean_float(value)
    if cleaned is None:
        return None
    return int(cleaned)


async def get_price_history(ticker: str) -> PriceHistoryResponse:
    """Fetch price history with a short-lived in-memory cache."""

    cache_key = ticker.upper()

    async with _cache_lock:
        entry = _cache.get(cache_key)
        if entry and entry.expires_at > time.monotonic():
            logger.info("Price cache hit for %s", cache_key)
            return entry.response

    response = await asyncio.to_thread(_fetch_history_sync, cache_key)

    if not response.warning:
        async with _cache_lock:
            _cache[cache_key] = _CacheEntry(
                expires_at=time.monotonic() + CACHE_TTL_SECONDS,
                response=response,
            )

    return response
