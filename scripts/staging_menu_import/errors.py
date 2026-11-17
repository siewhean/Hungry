"""Error reporting for the importer.

Mirrors src/lib/monitoring/reportError.ts: log locally, forward to Sentry when a
DSN is configured (same EXPO_PUBLIC_SENTRY_DSN the app uses, or
HUNGRY_IMPORT_SENTRY_DSN), and never throw from the reporter.
"""
from __future__ import annotations

import json
import os
import sys
import time
import traceback
import urllib.request
import uuid
from urllib.parse import urlparse

_SECRET_HINTS = ("password", "secret", "token", "key", "dsn")


def _scrub(context: dict) -> dict:
    out = {}
    for k, v in context.items():
        out[k] = "<redacted>" if any(h in k.lower() for h in _SECRET_HINTS) else v
    return out


def report_error(error: BaseException, context: dict | None = None) -> None:
    context = _scrub(context or {})
    try:
        sys.stderr.write(f"[staging-menu-import] error: {type(error).__name__}: {error} {json.dumps(context, default=str)}\n")
        dsn = os.environ.get("HUNGRY_IMPORT_SENTRY_DSN") or os.environ.get("EXPO_PUBLIC_SENTRY_DSN")
        if not dsn:
            return
        parsed = urlparse(dsn)
        project_id = parsed.path.strip("/")
        public_key = parsed.username
        if not (parsed.hostname and project_id and public_key):
            return
        event = {
            "event_id": uuid.uuid4().hex,
            "timestamp": time.time(),
            "platform": "python",
            "level": "error",
            "tags": {"component": "staging_menu_import"},
            "extra": context,
            "exception": {"values": [{"type": type(error).__name__, "value": str(error)[:500],
                                       "stacktrace": {"frames": [{"filename": f.filename, "function": f.name, "lineno": f.lineno}
                                                                  for f in traceback.extract_tb(error.__traceback__)]}}]},
        }
        envelope = (json.dumps({"event_id": event["event_id"]}) + "\n" + json.dumps({"type": "event"}) + "\n" + json.dumps(event)).encode()
        req = urllib.request.Request(
            f"https://{parsed.hostname}/api/{project_id}/envelope/",
            data=envelope,
            headers={"Content-Type": "application/x-sentry-envelope",
                     "X-Sentry-Auth": f"Sentry sentry_version=7, sentry_key={public_key}, sentry_client=hungry-menu-import/1.0"},
        )
        urllib.request.urlopen(req, timeout=5).read()
    except Exception:  # reporting must never crash the caller
        pass
