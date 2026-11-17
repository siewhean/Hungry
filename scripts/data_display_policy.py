#!/usr/bin/env python3
"""Shared production-display policy for workbook cache rows."""

from __future__ import annotations

from typing import Any


TRUTHY_VALUES = {"1", "true", "yes", "y", "approved", "display", "displayable"}
ALLOWED_RIGHTS_STATUSES = {
    "licensed",
    "merchant_owned",
    "operator_owned",
    "user_submitted",
    "permitted_api",
}
PLACEHOLDER_URL_PATTERNS = (
    "images.unsplash.com",
    "source.unsplash.com",
    "picsum.photos",
    "hungry-logo",
    "hungry-app-logo",
    "food.grab.com/static/images/logo-grabfood",
    "food.grab.com/static/images/quick-add",
    "plus-white.svg",
    "placeholder",
)


def clean_text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def truthy(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return clean_text(value).casefold() in TRUTHY_VALUES


def approved_rights_status(value: Any) -> bool:
    return clean_text(value).casefold() in ALLOWED_RIGHTS_STATUSES


def display_authorized(approved: Any, rights_status: Any) -> bool:
    return truthy(approved) and approved_rights_status(rights_status)


def is_placeholder_url(value: Any) -> bool:
    url = clean_text(value).casefold()
    return bool(url) and any(pattern in url for pattern in PLACEHOLDER_URL_PATTERNS)
