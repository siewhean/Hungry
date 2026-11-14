#!/usr/bin/env python3
"""Staging-only menu + stall importer.

Dry-run by default (no database connection at all). `--apply` is refused unless
the staging guard passes (see guard.py). Production can never be targeted: the
target ref must equal the staging ref and differ from the production ref.

Usage (dry run):
  python3 -I scripts/staging_menu_import/import_menu.py --out-dir <dir>

Usage (apply, after these migrations are applied to STAGING: 20261114150000_menu_import_columns and
20261114160000_hygiene_grade_nullable; 20261114170000_clear_hygiene_grade only clears existing grades):
  HUNGRY_IMPORT_CONFIRM_STAGING_REF=uuylnktiipkmcweyqnpd STAGING_PGPASSWORD=... \
    python3 -I scripts/staging_menu_import/import_menu.py --apply --approve-menu-display --out-dir <dir>
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import sqlgen  # noqa: E402
import transform as T  # noqa: E402
import xlsx_stream  # noqa: E402
from errors import report_error  # noqa: E402
from guard import GuardError, resolve_connection  # noqa: E402

REPO = HERE.parents[1]
EXPECTED_SHA256 = "9dd02a3126e0aaa48fcac857ad94b43efc63a9adca30cf2138dcfe517372c005"
DEFAULT_SOURCE = REPO / "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
DEFAULT_QA_DIR = REPO.parent / "Hungry-main" / "catalog-qa"
SAMPLE_SIZE = 20
DISH_CHUNK = 4000
VENUE_CHUNK = 5000


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def read_sheet(path: Path, name: str) -> T.Sheet:
    it = xlsx_stream.iter_rows(str(path), name)
    headers = [h or "" for h in next(it)]
    return T.Sheet(headers, list(it))


def evenly_sample(rows: list, n: int = SAMPLE_SIZE) -> list:
    if len(rows) <= n:
        return list(rows)
    step = len(rows) / n
    return [rows[int(i * step)] for i in range(n)]


def write_outputs(plan: T.Plan, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "samples").mkdir(exist_ok=True)
    with open(out_dir / "exclusions.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["kind", "reason", "all_matching_reasons", "key", "venue", "dish", "price", "licence"])
        for e in plan.exclusions:
            w.writerow([e.kind, e.reason, e.all_reasons, e.key, e.venue, e.dish, e.price, e.licence])
    tables = {"buildings": plan.buildings, "venues": plan.venues, "dishes": plan.dishes,
              "dish_taste_vectors": plan.taste_vectors, "dietary_flags": plan.dietary_flag_seed,
              "dish_dietary_flags": plan.dish_dietary_flags}
    for name, rows in tables.items():
        sample = evenly_sample(rows)
        if not sample:
            continue
        with open(out_dir / "samples" / f"{name}.csv", "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(sample[0]))
            w.writeheader()
            for r in sample:
                w.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (dict, list)) else v for k, v in r.items()})
    summary = {"batch_id": plan.batch_id, "source_sha256": plan.source_sha256, **plan.counts}
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")


def iter_chunks(plan: T.Plan):
    """Yield (label, sql) in FK-safe order. Generation is pure; used by dry-run and apply."""
    yield "dietary_flags(seed)", sqlgen.flag_seed_sql(plan.dietary_flag_seed)
    for i, c in enumerate(sqlgen.chunked(plan.buildings, VENUE_CHUNK)):
        yield f"buildings[{i}]", sqlgen.chunk_sql("buildings", c)
    for i, c in enumerate(sqlgen.chunked(plan.venues, VENUE_CHUNK)):
        yield f"venues[{i}]", sqlgen.chunk_sql("venues", c)
    taste_by = {t["dish_id"]: t for t in plan.taste_vectors}
    flags_by: dict[str, list[dict]] = {}
    for f in plan.dish_dietary_flags:
        flags_by.setdefault(f["dish_id"], []).append(f)
    for i, c in enumerate(sqlgen.chunked(plan.dishes, DISH_CHUNK)):
        tastes = [taste_by[d["id"]] for d in c if d["id"] in taste_by]
        flags = [f for d in c for f in flags_by.get(d["id"], [])]
        yield f"dishes[{i}]", sqlgen.dish_chunk_sql(c, tastes, flags, plan.batch_id)


def backup_tables(conn: dict, backup_dir: Path) -> dict[str, int]:
    from psql_runner import run_psql
    backup_dir.mkdir(parents=True, exist_ok=True)
    manifest: dict[str, int] = {}
    for table in sqlgen.BACKUP_TABLES:
        path = backup_dir / f"{table}.csv"
        run_psql(conn, args=["-c", f"\\copy (select * from public.{table}) to '{path}' csv header"])
        n = int(run_psql(conn, f"select count(*) from public.{table};").strip())
        written = max(sum(1 for _ in open(path, encoding="utf-8", errors="replace")) - 1, 0)
        if written < 0 or (n and written == 0):
            raise RuntimeError(f"backup of {table} looks empty (db rows {n})")
        manifest[table] = n
    (backup_dir / "manifest.json").write_text(json.dumps({"rows": manifest, "taken_at": time.time()}), encoding="utf-8")
    return manifest


def verify_migration(conn: dict) -> None:
    from psql_runner import run_psql
    problems = [ln.strip() for ln in run_psql(conn, sqlgen.MIGRATION_CHECK_SQL).splitlines() if ln.strip()]
    if problems:
        raise RuntimeError("staging schema is not ready for the importer: " + "; ".join(problems))


def apply_plan(plan: T.Plan, out_dir: Path) -> dict:
    conn = resolve_connection()      # raises GuardError unless target is provably staging
    from psql_runner import run_psql
    verify_migration(conn)
    backup = backup_tables(conn, out_dir / "backup")
    for label, sql in iter_chunks(plan):
        t0 = time.time()
        try:
            run_psql(conn, sql)
        except Exception as exc:  # report with context, then stop: a failed chunk never continues silently
            report_error(exc, {"chunk": label, "batch_id": plan.batch_id})
            raise
        print(f"[apply] {label} ok in {time.time() - t0:.1f}s", flush=True)
    run_psql(conn, sqlgen.planning_area_sql(plan.batch_id))
    print("[apply] planning_area filled from nearest area ok", flush=True)
    sql_path = HERE / "rowcounts.sql"
    out = run_psql(conn, args=["-v", f"batch={plan.batch_id}", "-f", str(sql_path)])
    loaded = {line.split("|")[0]: int(line.split("|")[1]) for line in out.strip().splitlines() if "|" in line}
    expected = {"buildings": len(plan.buildings), "venues": len(plan.venues), "dishes": len(plan.dishes),
                "dish_taste_vectors": len(plan.taste_vectors), "dish_dietary_flags": len(plan.dish_dietary_flags)}
    expected.update({"venues_hygiene_set": 0,
                     "dishes_discovery_visible": plan.counts["display"]["dishes_discovery_visible"],
                     "dishes_delivery_price": plan.counts["price_confidence"].get("delivery_price", 0),
                     "dishes_counter_price": plan.counts["price_confidence"].get("counter_price", 0),
                     "venues_without_planning_area": 0})
    mismatch = {k: (loaded.get(k), v) for k, v in expected.items() if loaded.get(k) != v}
    return {"backup_rows": backup, "loaded": loaded, "expected": expected, "mismatch": mismatch}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    ap.add_argument("--expected-sha256", default=EXPECTED_SHA256)
    ap.add_argument("--qa-dir", type=Path, default=DEFAULT_QA_DIR)
    ap.add_argument("--out-dir", type=Path, default=REPO / "outputs" / "staging_menu_import")
    ap.add_argument("--apply", action="store_true", help="write to STAGING (refused unless the guard passes)")
    ap.add_argument("--approve-menu-display", action="store_true",
                    help="mark imported venues/dishes menu-display-approved (operator_owned) so discovery returns them; "
                         "REQUIRED for the loaded dishes to appear in the app (omit = loaded but hidden)")
    args = ap.parse_args(argv)
    try:
        if args.apply:
            resolve_connection()     # fail fast, before the expensive workbook parse
        actual = sha256_file(args.source)
        if actual != args.expected_sha256:
            raise SystemExit(f"source sha256 mismatch: expected {args.expected_sha256}, got {actual}")
        directory = read_sheet(args.source, "Food Directory")
        menu = read_sheet(args.source, "Menu & Price")
        confirmed, templates = T.load_catalog_qa(str(args.qa_dir / "confirmed_high.csv"), str(args.qa_dir / "systematic_templates.csv"))
        plan = T.build_plan(directory, menu, source_sha256=actual, confirmed_errors=confirmed, template_rows=templates,
                            approve_menu_display=args.approve_menu_display)
        out_dir = args.out_dir / plan.batch_id
        write_outputs(plan, out_dir)
        total_bytes = sum(len(sql) for _, sql in iter_chunks(plan))     # exercises SQL generation in dry-run too
        mode = "APPLY" if args.apply else "DRY-RUN (no database connection opened)"
        print(f"[{mode}] batch {plan.batch_id}; generated {total_bytes:,} bytes of SQL; outputs in {out_dir}")
        print(json.dumps(plan.counts["rows_to_insert"], indent=2))
        if args.apply:
            result = apply_plan(plan, out_dir)
            (out_dir / "apply_result.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
            print(json.dumps(result, indent=2))
            if result["mismatch"]:
                print("[apply] row-count mismatch after load; see apply_result.json", file=sys.stderr)
                return 2
        return 0
    except GuardError as exc:
        print(f"REFUSED by staging guard: {exc}", file=sys.stderr)
        return 3
    except SystemExit:
        raise
    except Exception as exc:
        report_error(exc, {"stage": "import_menu"})
        return 1


if __name__ == "__main__":
    sys.exit(main())
