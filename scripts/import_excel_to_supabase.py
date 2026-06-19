#!/usr/bin/env python3
"""Stage the Hungry F&B Excel workbook into Supabase import tables.

Default mode writes deterministic SQL to /tmp. Live REST apply is guarded by
HUNGRY_ALLOW_SERVICE_ROLE_IMPORT=1 and import-specific service-role env vars.
This script never promotes rows into production catalog tables.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import uuid
from collections import Counter
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any
from urllib import error, parse, request

from validate_excel_workbook import (
    DEFAULT_SHEET,
    DEFAULT_WORKBOOK,
    EXPECTED_COLUMNS,
    clean,
    dedupe_key,
    load_workbook_rows,
    parse_date,
    parse_decimal,
    parse_float,
    parse_int,
    validate_row,
)


SOURCE_SLUG = "hungry_fnb_excel_workbook"
SOURCE_FILE_LABEL = "data/Hungry F&B Database.xlsx"
IMPORT_UUID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "hungry.sg/excel-imports")
DEFAULT_OUTPUT = Path("/tmp/hungry-excel-food-business-staging.sql")
IMPORT_URL_ENV = "HUNGRY_SUPABASE_IMPORT_URL"
IMPORT_SERVICE_ROLE_ENV = "HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY"
IMPORT_PROJECT_REF_ENV = "HUNGRY_SUPABASE_IMPORT_PROJECT_REF"
IMPORT_OPT_IN_ENV = "HUNGRY_ALLOW_SERVICE_ROLE_IMPORT"

STAGING_COLUMNS = [
    "import_run_id",
    "source_slug",
    "source_row_id",
    "row_number",
    "raw_payload",
    "parsed_payload",
    "business_id",
    "stall_id",
    "licence_no",
    "business_name",
    "normalized_name",
    "stall_type",
    "cuisine",
    "signature_dish",
    "menu_text",
    "price_text",
    "price_min_sgd",
    "price_max_sgd",
    "opening_hours_text",
    "closed_days",
    "hygiene_grade",
    "michelin_recognition",
    "dietary_options",
    "delivery_platforms",
    "contact",
    "instagram",
    "image_url",
    "dishes_image_url",
    "building_name",
    "building_display_name",
    "unit_number",
    "address",
    "postal_code",
    "region",
    "planning_area",
    "location_text",
    "location_key",
    "latitude",
    "longitude",
    "source_type_label",
    "source_url",
    "last_verified_date",
    "coverage_status",
    "notes",
    "google_place_id",
    "google_name",
    "google_formatted_address",
    "google_latitude",
    "google_longitude",
    "google_primary_type",
    "google_types",
    "google_maps_uri",
    "google_rating",
    "google_review_count",
    "google_price_level",
    "google_website",
    "google_opening_hours",
    "google_opening_hours_json",
    "google_photo_metadata",
    "google_photo_last_refreshed",
    "menu_source",
    "menu_items_text",
    "validation_status",
    "error_reason",
    "confidence",
    "source_hash",
]


def parse_list(value: Any) -> list[str]:
    value = clean(value)
    if not value:
        return []
    return [part.strip() for part in value.replace("|", ",").replace(";", ",").split(",") if part.strip()]


def parse_jsonish(value: Any) -> dict[str, Any]:
    value = clean(value)
    if not value:
        return {}
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        return {"raw": value}
    return parsed if isinstance(parsed, dict) else {"items": parsed}


def json_ready(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: json_ready(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_ready(item) for item in value]
    return value


def row_hash(row: dict[str, Any]) -> str:
    payload = json.dumps(json_ready(row), ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sql_literal(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, int):
        return str(value)
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"


def sql_json(value: Any) -> str:
    return f"{sql_literal(json.dumps(json_ready(value), ensure_ascii=False, sort_keys=True))}::jsonb"


def sql_text_array(values: list[str]) -> str:
    if not values:
        return "'{}'::text[]"
    return "array[" + ", ".join(sql_literal(value) for value in values) + "]::text[]"


def confidence_for(row: dict[str, Any], has_errors: bool) -> Decimal:
    if has_errors:
        return Decimal("0.200")
    coverage = (clean(row.get("Coverage Status")) or "").casefold()
    if coverage == "complete":
        return Decimal("0.750")
    if coverage == "partial":
        return Decimal("0.550")
    return Decimal("0.500")


def normalized_postal(value: Any) -> str | None:
    value = clean(value)
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    if not digits:
        return value
    return digits.zfill(6) if len(digits) <= 6 else digits


def build_raw_payload(row: dict[str, Any]) -> dict[str, Any]:
    return {column: json_ready(row.get(column)) for column in EXPECTED_COLUMNS}


def build_staging_values(row: dict[str, Any], issues: list[dict[str, Any]]) -> dict[str, Any]:
    has_errors = any(item["severity"] == "error" for item in issues)
    raw_payload = build_raw_payload(row)
    key = dedupe_key(row)
    latitude = parse_float(row.get("Latitude"))
    longitude = parse_float(row.get("Longitude"))
    price_min = parse_decimal(row.get("Price Min (SGD)"))
    price_max = parse_decimal(row.get("Price Max (SGD)"))
    google_latitude = parse_float(row.get("Google Latitude"))
    google_longitude = parse_float(row.get("Google Longitude"))

    parsed_payload = {
        "identity": {
            "business_id": clean(row.get("Business ID")),
            "stall_id": clean(row.get("Stall ID")),
            "licence_no": clean(row.get("Licence No")),
            "dedupe_key": key,
        },
        "location": {
            "building_name": clean(row.get("Hawker Centre / Building")),
            "building_display_name": clean(row.get("Building Name")),
            "address": clean(row.get("Address")),
            "postal_code": normalized_postal(row.get("Postal Code")),
            "latitude": latitude,
            "longitude": longitude,
            "region": clean(row.get("Region")),
            "planning_area": clean(row.get("Area")),
        },
        "google": {
            "place_id": clean(row.get("Google Place ID")),
            "display_name": clean(row.get("Google Display Name")),
            "formatted_address": clean(row.get("Google Formatted Address")),
            "latitude": google_latitude,
            "longitude": google_longitude,
            "primary_type": clean(row.get("Google Primary Type")),
            "maps_uri": clean(row.get("Google Maps URI")),
        },
        "menu": {
            "signature_dish": clean(row.get("Signature Dish")),
            "menu_text": clean(row.get("Menu")),
            "menu_items": clean(row.get("Menu Items")),
            "menu_source": clean(row.get("Menu Source")),
            "price_text": clean(row.get("Price")),
            "price_min_sgd": str(price_min) if price_min is not None else None,
            "price_max_sgd": str(price_max) if price_max is not None else None,
            "dishes_image_url": clean(row.get("Dishes Image URL")),
        },
        "validation": {
            "status": "invalid" if has_errors else "valid",
            "issues": issues,
        },
    }

    return {
        "source_row_id": clean(row.get("Business ID")) or clean(row.get("Stall ID")) or clean(row.get("Licence No")) or str(row["_row_number"]),
        "row_number": int(row["_row_number"]),
        "raw_payload": raw_payload,
        "parsed_payload": parsed_payload,
        "business_id": clean(row.get("Business ID")),
        "stall_id": clean(row.get("Stall ID")),
        "licence_no": clean(row.get("Licence No")),
        "business_name": clean(row.get("Stall / Restaurant Name")),
        "normalized_name": clean(row.get("Business Name Normalized")),
        "stall_type": clean(row.get("Stall Type")),
        "cuisine": clean(row.get("Cuisine")),
        "signature_dish": clean(row.get("Signature Dish")),
        "menu_text": clean(row.get("Menu")),
        "price_text": clean(row.get("Price")),
        "price_min_sgd": price_min,
        "price_max_sgd": price_max,
        "opening_hours_text": clean(row.get("Opening Hours")),
        "closed_days": clean(row.get("Closed Days")),
        "hygiene_grade": clean(row.get("NEA Hygiene Grade")),
        "michelin_recognition": clean(row.get("Michelin Recognition")),
        "dietary_options": parse_list(row.get("Dietary Options")),
        "delivery_platforms": parse_list(row.get("Delivery Platforms")),
        "contact": clean(row.get("Contact")),
        "instagram": clean(row.get("Instagram")),
        "image_url": clean(row.get("Image URL")),
        "dishes_image_url": clean(row.get("Dishes Image URL")),
        "building_name": clean(row.get("Hawker Centre / Building")),
        "building_display_name": clean(row.get("Building Name")),
        "unit_number": clean(row.get("Unit No.")),
        "address": clean(row.get("Address")),
        "postal_code": normalized_postal(row.get("Postal Code")),
        "region": clean(row.get("Region")),
        "planning_area": clean(row.get("Area")),
        "location_text": clean(row.get("Location")),
        "location_key": clean(row.get("Location Key")),
        "latitude": latitude,
        "longitude": longitude,
        "source_type_label": clean(row.get("Source Type")),
        "source_url": clean(row.get("Source URL")),
        "last_verified_date": parse_date(row.get("Last Verified Date")),
        "coverage_status": clean(row.get("Coverage Status")),
        "notes": clean(row.get("Notes")),
        "google_place_id": clean(row.get("Google Place ID")),
        "google_name": clean(row.get("Google Display Name")),
        "google_formatted_address": clean(row.get("Google Formatted Address")),
        "google_latitude": google_latitude,
        "google_longitude": google_longitude,
        "google_primary_type": clean(row.get("Google Primary Type")),
        "google_types": parse_list(row.get("Google Primary Type")),
        "google_maps_uri": clean(row.get("Google Maps URI")),
        "google_rating": parse_decimal(row.get("Google Rating")),
        "google_review_count": parse_int(row.get("Google Review Count")),
        "google_price_level": parse_int(row.get("Google Price Level")),
        "google_website": clean(row.get("Google Website")),
        "google_opening_hours": clean(row.get("Google Opening Hours JSON")),
        "google_opening_hours_json": parse_jsonish(row.get("Google Opening Hours JSON")),
        "google_photo_metadata": parse_jsonish(row.get("Google Photo Metadata")),
        "google_photo_last_refreshed": parse_date(row.get("Google Photo Last Refreshed")),
        "menu_source": clean(row.get("Menu Source")),
        "menu_items_text": clean(row.get("Menu Items")),
        "validation_status": "invalid" if has_errors else "valid",
        "error_reason": "; ".join(item["error_code"] for item in issues if item["severity"] == "error") or None,
        "confidence": confidence_for(row, has_errors),
        "source_hash": row_hash(raw_payload),
    }


def row_sql(import_run_id: str, values: dict[str, Any]) -> str:
    rendered: list[str] = []
    payload = {"import_run_id": import_run_id, "source_slug": SOURCE_SLUG, **values}
    for column in STAGING_COLUMNS:
        value = payload[column]
        if column in {"raw_payload", "parsed_payload", "google_opening_hours_json", "google_photo_metadata"}:
            rendered.append(sql_json(value))
        elif column in {"dietary_options", "delivery_platforms", "google_types"}:
            rendered.append(sql_text_array(value))
        else:
            rendered.append(sql_literal(value))
    return "(" + ", ".join(rendered) + ")"


def issue_sql(import_run_id: str, row: dict[str, Any], item: dict[str, Any]) -> str:
    return "(" + ", ".join(
        [
            sql_literal(import_run_id),
            sql_literal("staging_food_businesses"),
            sql_literal(row["_row_number"]),
            sql_literal(item["severity"]),
            sql_literal(item["error_code"]),
            sql_literal(item["message"]),
            sql_json(build_raw_payload(row)),
        ]
    ) + ")"


def import_run_payload(import_run_id: str, digest: str, total_rows: int, staged_rows: int, rejected_rows: int, limited: bool) -> dict[str, Any]:
    return {
        "id": import_run_id,
        "source_slug": SOURCE_SLUG,
        "source_type": "spreadsheet",
        "source_file": SOURCE_FILE_LABEL,
        "status": "completed",
        "total_rows": total_rows,
        "processed_rows": total_rows,
        "accepted_rows": staged_rows,
        "rejected_rows": rejected_rows,
        "metadata": {
            "workbook_sha256": digest,
            "generator": "scripts/import_excel_to_supabase.py",
            "limited": limited,
            "staging_only": True,
        },
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


def write_sql(
    output_path: Path,
    import_run_id: str,
    digest: str,
    rows: list[dict[str, Any]],
    staged_values: list[dict[str, Any]],
    issues_by_row: dict[int, list[dict[str, Any]]],
    batch_size: int,
    limited: bool,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    rejected_rows = sum(1 for issues in issues_by_row.values() if any(item["severity"] == "error" for item in issues))
    run = import_run_payload(import_run_id, digest, len(rows), len(staged_values), rejected_rows, limited)
    with output_path.open("w", encoding="utf-8") as sql:
        sql.write("-- Generated by scripts/import_excel_to_supabase.py.\n")
        sql.write("-- Staging-only import: does not mutate buildings, venues, dishes, or media tables.\n")
        sql.write("begin;\n\n")
        sql.write("insert into import_runs (id, source_slug, source_type, source_file, status, total_rows, processed_rows, accepted_rows, rejected_rows, metadata, completed_at)\n")
        sql.write("values (")
        sql.write(", ".join([
            sql_literal(run["id"]),
            sql_literal(run["source_slug"]),
            sql_literal(run["source_type"]),
            sql_literal(run["source_file"]),
            sql_literal(run["status"]),
            sql_literal(run["total_rows"]),
            sql_literal(run["processed_rows"]),
            sql_literal(run["accepted_rows"]),
            sql_literal(run["rejected_rows"]),
            sql_json(run["metadata"]),
            "now()",
        ]))
        sql.write(")\n")
        sql.write("on conflict (id) do update set status = excluded.status, total_rows = excluded.total_rows, processed_rows = excluded.processed_rows, accepted_rows = excluded.accepted_rows, rejected_rows = excluded.rejected_rows, metadata = excluded.metadata, completed_at = excluded.completed_at, updated_at = now();\n\n")
        sql.write(f"delete from staging_import_errors where import_run_id = {sql_literal(import_run_id)};\n")
        sql.write(f"delete from staging_food_businesses where import_run_id = {sql_literal(import_run_id)};\n\n")

        columns = ", ".join(STAGING_COLUMNS)
        for start in range(0, len(staged_values), batch_size):
            batch = staged_values[start : start + batch_size]
            sql.write(f"insert into staging_food_businesses ({columns}) values\n")
            sql.write(",\n".join(row_sql(import_run_id, values) for values in batch))
            sql.write(";\n\n")

        issue_values: list[str] = []
        for row in rows:
            for item in issues_by_row.get(int(row["_row_number"]), []):
                issue_values.append(issue_sql(import_run_id, row, item))
        if issue_values:
            sql.write("insert into staging_import_errors (import_run_id, staging_table, source_row_number, severity, error_code, message, raw_payload) values\n")
            sql.write(",\n".join(issue_values))
            sql.write(";\n\n")
        sql.write("commit;\n")


def rest_request(base_url: str, service_key: str, method: str, table: str, query: str = "", body: Any | None = None, prefer: str = "return=minimal") -> None:
    endpoint = f"{base_url}/rest/v1/{table}{query}"
    data = None if body is None else json.dumps(json_ready(body)).encode("utf-8")
    req = request.Request(endpoint, data=data, method=method)
    req.add_header("apikey", service_key)
    req.add_header("Authorization", f"Bearer {service_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", prefer)
    try:
        with request.urlopen(req, timeout=60) as response:
            response.read()
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")
        raise SystemExit(f"Supabase REST {method} {table} failed: {exc.code} {detail}") from exc
    except error.URLError as exc:
        raise SystemExit(f"Supabase REST {method} {table} failed: {exc.reason}") from exc


def upsert_import_run(base_url: str, service_key: str, run_payload: dict[str, Any]) -> None:
    rest_request(
        base_url,
        service_key,
        "POST",
        "import_runs",
        "?on_conflict=id",
        [run_payload],
        "resolution=merge-duplicates,return=minimal",
    )


def require_import_env() -> tuple[str, str]:
    if os.environ.get(IMPORT_OPT_IN_ENV) != "1":
        raise SystemExit(f"Set {IMPORT_OPT_IN_ENV}=1 to allow service-role import.")
    url = clean(os.environ.get(IMPORT_URL_ENV))
    key = clean(os.environ.get(IMPORT_SERVICE_ROLE_ENV))
    project_ref = clean(os.environ.get(IMPORT_PROJECT_REF_ENV))
    missing = [name for name, value in [(IMPORT_URL_ENV, url), (IMPORT_SERVICE_ROLE_ENV, key), (IMPORT_PROJECT_REF_ENV, project_ref)] if not value]
    if missing:
        raise SystemExit(f"Missing required import environment: {', '.join(missing)}")
    hostname = parse.urlparse(url).hostname or ""
    if hostname not in {"localhost", "127.0.0.1", "::1"} and hostname.split(".")[0] != project_ref:
        raise SystemExit(f"{IMPORT_PROJECT_REF_ENV} does not match {IMPORT_URL_ENV} project ref.")
    return url.rstrip("/"), key


def apply_to_supabase(import_run_id: str, run_payload: dict[str, Any], staged_values: list[dict[str, Any]], rows: list[dict[str, Any]], issues_by_row: dict[int, list[dict[str, Any]]], batch_size: int) -> None:
    base_url, service_key = require_import_env()
    started_at = datetime.now(timezone.utc).isoformat()
    running_payload = {
        **run_payload,
        "status": "running",
        "completed_at": None,
        "started_at": started_at,
    }
    completed_payload = {
        **run_payload,
        "status": "completed",
        "started_at": started_at,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }

    upsert_import_run(base_url, service_key, running_payload)
    try:
        quoted = parse.quote(import_run_id, safe="")
        rest_request(base_url, service_key, "DELETE", "staging_import_errors", f"?import_run_id=eq.{quoted}")
        rest_request(base_url, service_key, "DELETE", "staging_food_businesses", f"?import_run_id=eq.{quoted}")
        rest_rows = [{"import_run_id": import_run_id, "source_slug": SOURCE_SLUG, **values} for values in staged_values]
        for start in range(0, len(rest_rows), batch_size):
            rest_request(base_url, service_key, "POST", "staging_food_businesses", body=rest_rows[start : start + batch_size])
        rest_errors = []
        for row in rows:
            for item in issues_by_row.get(int(row["_row_number"]), []):
                rest_errors.append({
                    "import_run_id": import_run_id,
                    "staging_table": "staging_food_businesses",
                    "source_row_number": int(row["_row_number"]),
                    "severity": item["severity"],
                    "error_code": item["error_code"],
                    "message": item["message"],
                    "raw_payload": build_raw_payload(row),
                })
        for start in range(0, len(rest_errors), batch_size):
            rest_request(base_url, service_key, "POST", "staging_import_errors", body=rest_errors[start : start + batch_size])
    except SystemExit as exc:
        failed_payload = {
            **running_payload,
            "status": "failed",
            "metadata": {
                **run_payload.get("metadata", {}),
                "failure": str(exc),
            },
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        upsert_import_run(base_url, service_key, failed_payload)
        raise

    upsert_import_run(base_url, service_key, completed_payload)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--sheet", default=DEFAULT_SHEET)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--batch-size", type=int, default=500)
    parser.add_argument("--apply-supabase", action="store_true")
    args = parser.parse_args()

    headers, rows = load_workbook_rows(args.workbook, args.sheet, args.limit)
    missing = [column for column in EXPECTED_COLUMNS if column not in headers]
    if missing:
        raise SystemExit(f"Workbook is missing required columns: {', '.join(missing)}")

    duplicate_counts = Counter(key for row in rows if (key := dedupe_key(row)))
    staged_values: list[dict[str, Any]] = []
    issues_by_row: dict[int, list[dict[str, Any]]] = {}
    for row in rows:
        issues = validate_row(row, duplicate_counts)
        issues_by_row[int(row["_row_number"])] = issues
        if any(item["severity"] == "error" for item in issues):
            continue
        staged_values.append(build_staging_values(row, issues))

    digest = file_hash(args.workbook)
    limited = args.limit is not None
    import_run_id = str(uuid.uuid5(IMPORT_UUID_NAMESPACE, f"{SOURCE_SLUG}:{digest}:{args.sheet}:{args.limit or 'all'}"))
    rejected_rows = len(rows) - len(staged_values)
    run_payload = import_run_payload(import_run_id, digest, len(rows), len(staged_values), rejected_rows, limited)
    write_sql(args.output, import_run_id, digest, rows, staged_values, issues_by_row, args.batch_size, limited)
    if args.apply_supabase:
        apply_to_supabase(import_run_id, run_payload, staged_values, rows, issues_by_row, args.batch_size)

    summary = {
        "workbook": str(args.workbook),
        "sheet": args.sheet,
        "import_run_id": import_run_id,
        "rows_read": len(rows),
        "staged_rows": len(staged_values),
        "skipped_rows": rejected_rows,
        "output": str(args.output),
        "applied": args.apply_supabase,
    }
    print(json.dumps(summary, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
