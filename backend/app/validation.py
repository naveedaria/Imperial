"""Input validators that translate bad input into HTTP 400 responses.

Kept separate from :mod:`app.security` so the security helpers stay free of
FastAPI imports and remain easy to unit-test in isolation.
"""

from fastapi import HTTPException, status

from app.schemas import AuthRequest
from app.security import normalize_email, normalize_ticker


def validate_auth_request(payload: AuthRequest) -> str:
    email = normalize_email(payload.email)
    if "@" not in email or "." not in email.rsplit("@", 1)[-1]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid email address.",
        )
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters.",
        )
    return email


def validate_ticker(ticker: str) -> str:
    normalized = normalize_ticker(ticker)
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Ticker is required."
        )
    if len(normalized) > 10 or not normalized.replace(".", "").replace("-", "").isalnum():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Enter a valid ticker symbol.",
        )
    return normalized
