"""Password hashing and string normalisation helpers.

These are pure functions with no FastAPI coupling so they're trivial to unit test.
"""

import hashlib
import secrets


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_ticker(ticker: str) -> str:
    return ticker.strip().upper()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    )
    return f"pbkdf2_sha256${salt}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        algorithm, salt, expected_digest = stored_hash.split("$", 2)
    except ValueError:
        return False

    if algorithm != "pbkdf2_sha256":
        return False

    actual_digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000
    )
    return secrets.compare_digest(actual_digest.hex(), expected_digest)
