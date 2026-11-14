#!/usr/bin/env python3
"""Delete exactly one import batch from STAGING (dry-run by default).

Deletes rows whose import_batch_id equals --batch-id, children before parents.
The batch id is printed by import_menu.py and stored in summary.json. Pre-load
backups (CSV) live in <out-dir>/<batch>/backup/ and cover the pre-existing rows;
those rows are never touched because every imported id is namespaced
(bld-/ven-/dsh-) and tagged with the batch id.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from errors import report_error  # noqa: E402
from guard import GuardError, resolve_connection  # noqa: E402

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
ORDER = ["dish_dietary_flags", "dish_taste_vectors", "dishes", "venues", "buildings"]


def build_sql(batch: str, apply: bool) -> str:
    if not UUID_RE.match(batch):
        raise ValueError("batch id must be a lowercase uuid")
    counts = " union all ".join(f"select '{t}' t, count(*) n from public.{t} where import_batch_id = '{batch}'::uuid" for t in ORDER)
    if not apply:
        return counts + ";\n"
    deletes = "".join(f"delete from public.{t} where import_batch_id = '{batch}'::uuid;\n" for t in ORDER)
    return "\\set ON_ERROR_STOP on\nbegin;\nset local statement_timeout = 0;\n" + deletes + "commit;\n" + counts + ";\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--batch-id", required=True)
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args(argv)
    try:
        sql = build_sql(args.batch_id, args.apply)
        conn = resolve_connection()                      # guard runs even for the read-only preview
        from psql_runner import run_psql
        out = run_psql(conn, sql)
        print(("APPLIED; rows remaining:\n" if args.apply else "DRY-RUN; rows that would be deleted:\n") + out)
        return 0
    except GuardError as exc:
        print(f"REFUSED by staging guard: {exc}", file=sys.stderr)
        return 3
    except Exception as exc:
        report_error(exc, {"stage": "rollback_import"})
        return 1


if __name__ == "__main__":
    sys.exit(main())
