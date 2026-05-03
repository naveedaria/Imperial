"""Pydantic request/response models exposed at the API boundary."""

from datetime import datetime

from pydantic import BaseModel


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
