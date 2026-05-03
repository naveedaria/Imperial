"""FastAPI application factory.

This module is intentionally tiny: it wires up middleware, lifespan, and
routers. All domain logic lives in :mod:`app.routes`, :mod:`app.services`, and
the model/schema modules.
"""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.logging_config import configure_logging, logger
from app.models import User, WatchlistItem  # noqa: F401 - register tables on Base.metadata
from app.routes import auth, health, prices, watchlist


configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Backend starting")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    logger.info("Database tables ready")
    yield
    await engine.dispose()
    logger.info("Backend stopped")


def create_app() -> FastAPI:
    app = FastAPI(title="Imperial Watchlist API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
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

    app.include_router(health.router)
    app.include_router(auth.router)
    app.include_router(watchlist.router)
    app.include_router(prices.router)

    return app


app = create_app()
