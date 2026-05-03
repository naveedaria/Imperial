"""Logging setup. Importing this module gives every other module a shared logger."""

import logging

from app.config import settings


_CONFIGURED = False


def configure_logging() -> None:
    """Configure root logging once. Safe to call multiple times."""

    global _CONFIGURED
    if _CONFIGURED:
        return
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    _CONFIGURED = True


logger = logging.getLogger("imperial.backend")
