"""Thin psql wrapper. The password only ever travels in the child's PGPASSWORD."""
from __future__ import annotations

import os
import subprocess

from guard import GuardError, STAGING_REF, assert_staging_target


class PsqlError(RuntimeError):
    pass


def run_psql(conn: dict[str, str], sql: str | None = None, *, args: list[str] | None = None, timeout: int = 1800) -> str:
    # Re-validate on every call: no connection can be opened without the guard.
    assert_staging_target(ref=STAGING_REF if conn.get("PGUSER", "").endswith(STAGING_REF) else conn.get("PGUSER"),
                          host=conn.get("PGHOST"), user=conn.get("PGUSER"))
    env = {**os.environ, **conn}
    cmd = ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|"] + (args or [])
    proc = subprocess.run(cmd, input=sql, text=True, capture_output=True, env=env, timeout=timeout)
    if proc.returncode != 0:
        tail = "\n".join(proc.stderr.strip().splitlines()[-5:])
        raise PsqlError(f"psql exited {proc.returncode}: {tail.replace(conn.get('PGPASSWORD', '') or chr(0), '<redacted>')}")
    return proc.stdout


def assert_connected_to_staging_only(conn: dict[str, str]) -> None:
    """Defence in depth: the server must report an expected schema marker, not prod-only objects."""
    out = run_psql(conn, "select current_database();")
    if not out.strip():
        raise GuardError("could not verify database identity")
