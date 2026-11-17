"""Staging-only target guard.

Hard-fails unless the target project ref equals the staging ref AND differs
from the production ref. Nothing in this package may open a database
connection without passing through `assert_staging_target`.
"""
from __future__ import annotations

import os
import re

STAGING_REF = "uuylnktiipkmcweyqnpd"
PROD_REF = "frluxwpqqyomiqmjzavd"
CONFIRM_ENV = "HUNGRY_IMPORT_CONFIRM_STAGING_REF"
PASSWORD_ENV = "STAGING_PGPASSWORD"
DEFAULT_POOLER_HOST = "aws-0-ap-northeast-2.pooler.supabase.com"

_REF_RE = re.compile(r"[a-z]{20}")


class GuardError(RuntimeError):
    """Raised when a target is not provably the staging project."""


def extract_refs(*targets: str | None) -> set[str]:
    """Return every 20-char supabase-style ref found in hosts/users/URLs."""
    refs: set[str] = set()
    for target in targets:
        if not target:
            continue
        for token in re.split(r"[^a-z0-9]", target.lower()):
            if _REF_RE.fullmatch(token):
                refs.add(token)
    return refs


def assert_staging_target(
    *,
    ref: str | None = None,
    host: str | None = None,
    user: str | None = None,
    url: str | None = None,
) -> str:
    """Validate the target. Returns the staging ref or raises GuardError.

    Rules (all must hold):
      * the declared ref equals STAGING_REF exactly;
      * no ref found anywhere in host/user/url is PROD_REF;
      * every ref found in host/user/url equals STAGING_REF;
      * the declared ref is not PROD_REF (belt and braces).
    """
    if ref is None:
        raise GuardError("no target project ref declared; refusing")
    declared = ref.strip().lower()
    if declared == PROD_REF or PROD_REF in "".join(x or "" for x in (host, user, url)).lower():
        raise GuardError("production project ref detected; refusing")
    if declared != STAGING_REF:
        raise GuardError("target ref is not the staging ref; refusing")
    for found in extract_refs(host, user, url):
        if found != STAGING_REF:
            raise GuardError("a connection field names a project other than staging; refusing")
    if STAGING_REF == PROD_REF:  # pragma: no cover - constant sanity
        raise GuardError("staging and production refs are identical; refusing")
    return declared


def resolve_connection(env: dict[str, str] | None = None) -> dict[str, str]:
    """Build libpq settings for staging from the environment.

    Never reads or prints the password value other than passing it to psql via
    the PGPASSWORD environment variable of the child process.
    """
    env = dict(os.environ if env is None else env)
    host = env.get("STAGING_PGHOST", DEFAULT_POOLER_HOST)
    user = env.get("STAGING_PGUSER", f"postgres.{STAGING_REF}")
    ref = env.get("STAGING_PROJECT_REF", STAGING_REF)
    assert_staging_target(ref=ref, host=host, user=user)
    if env.get(CONFIRM_ENV, "") != STAGING_REF:
        raise GuardError(f"{CONFIRM_ENV} must equal the staging ref to apply")
    password = env.get(PASSWORD_ENV, "")
    if not password:
        raise GuardError(f"{PASSWORD_ENV} is not set in the environment")
    return {
        "PGHOST": host,
        "PGPORT": env.get("STAGING_PGPORT", "5432"),
        "PGUSER": user,
        "PGDATABASE": env.get("STAGING_PGDATABASE", "postgres"),
        "PGPASSWORD": password,
        "PGSSLMODE": "require",
    }
