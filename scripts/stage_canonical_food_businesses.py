#!/usr/bin/env python3
"""Generate SQL to stage the canonical Singapore food-business CSV.

The script is intentionally staging-only: it creates/updates one import_runs row,
inserts rows into staging_food_businesses, records validation issues in
staging_import_errors, and never mutates production catalog tables.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from urllib import error, parse, request


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CSV = ROOT / "data" / "singapore_food_businesses_canonical.csv"
DEFAULT_OUTPUT = Path("/tmp/hungry-canonical-food-business-staging.sql")
DEFAULT_SPLIT_OUTPUT_DIR = Path("/tmp/hungry-canonical-food-business-staging-sql")
SOURCE_SLUG = "singapore_food_businesses_csv"
SOURCE_FILE_LABEL = "data/singapore_food_businesses_canonical.csv"
IMPORT_UUID_NAMESPACE = uuid.uuid5(uuid.NAMESPACE_URL, "hungry.sg/imports")
IMPORT_URL_ENV = "HUNGRY_SUPABASE_IMPORT_URL"
IMPORT_SERVICE_ROLE_ENV = "HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY"
IMPORT_PROJECT_REF_ENV = "HUNGRY_SUPABASE_IMPORT_PROJECT_REF"
IMPORT_OPT_IN_ENV = "HUNGRY_ALLOW_SERVICE_ROLE_IMPORT"

EXPECTED_COLUMNS = [
    "Business ID",
    "Stall ID",
    "Licence No",
    "Stall / Restaurant Name",
    "Business Name Normalized",
    "Stall Type",
    "Cuisine",
    "Signature Dish",
    "Menu",
    "Price",
    "Price Min (SGD)",
    "Price Max (SGD)",
    "Opening Hours",
    "Closed Days",
    "NEA Hygiene Grade",
    "Michelin Recognition",
    "Dietary Options",
    "Delivery Platforms",
    "Contact",
    "Instagram",
    "Image URL",
    "Hawker Centre / Building",
    "Building Name",
    "Unit No.",
    "Address",
    "Postal Code",
    "Region",
    "Location",
    "Location Key",
    "Latitude",
    "Longitude",
    "Source Type",
    "Source URL",
    "Last Verified Date",
    "Coverage Status",
    "Notes",
]

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
    "building_name",
    "building_display_name",
    "unit_number",
    "address",
    "postal_code",
    "region",
    "location_text",
    "location_key",
    "latitude",
    "longitude",
    "source_type_label",
    "source_url",
    "last_verified_date",
    "coverage_status",
    "notes",
    "validation_status",
    "error_reason",
    "confidence",
    "source_hash",
]


@dataclass(frozen=True)
class StagedRow:
    row_number: int
    values: dict[str, Any]
    issues: list[dict[str, str]]


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def normalize_key(value: str | None) -> str | None:
    value = clean(value)
    if not value:
        return None
    return re.sub(r"\s+", " ", value).casefold()


def parse_decimal(value: str | None) -> Decimal | None:
    value = clean(value)
    if not value:
        return None
    try:
        return Decimal(value)
    except InvalidOperation:
        return None


def parse_float(value: str | None) -> float | None:
    value = clean(value)
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def parse_date(value: str | None) -> str | None:
    value = clean(value)
    if not value:
        return None
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
        return value
    return None


def parse_list(value: str | None) -> list[str]:
    value = clean(value)
    if not value:
        return []
    parts = re.split(r"[;,|]", value)
    return [part.strip() for part in parts if part.strip()]


def row_hash(row: dict[str, str]) -> str:
    payload = json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
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
    return f"{sql_literal(json.dumps(value, ensure_ascii=False, sort_keys=True))}::jsonb"


def sql_text_array(values: list[str]) -> str:
    if not values:
        return "'{}'::text[]"
    return "array[" + ", ".join(sql_literal(value) for value in values) + "]::text[]"


def json_ready(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {key: json_ready(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_ready(item) for item in value]
    return value


def issue(row_number: int, code: str, message: str, severity: str = "error") -> dict[str, str]:
    return {
        "row_number": str(row_number),
        "error_code": code,
        "message": message,
        "severity": severity,
    }


def dedupe_key(row: dict[str, str]) -> str | None:
    for column in ("Business ID", "Stall ID", "Licence No"):
        value = normalize_key(row.get(column))
        if value:
            return f"{column}:{value}"

    name = normalize_key(row.get("Business Name Normalized") or row.get("Stall / Restaurant Name"))
    postal = normalize_key(row.get("Postal Code"))
    unit = normalize_key(row.get("Unit No."))
    if name and (postal or unit):
        return f"name-location:{name}:{postal or ''}:{unit or ''}"
    return None


def confidence_for(row: dict[str, str], status: str) -> Decimal:
    if status == "invalid":
        return Decimal("0.200")
    coverage = (clean(row.get("Coverage Status")) or "").casefold()
    if coverage == "complete":
        return Decimal("0.750")
    if coverage == "partial":
        return Decimal("0.550")
    return Decimal("0.500")


def stage_row(row_number: int, row: dict[str, str], duplicate_counts: Counter[str]) -> StagedRow:
    issues: list[dict[str, str]] = []
    business_name = clean(row.get("Stall / Restaurant Name"))
    normalized_name = clean(row.get("Business Name Normalized"))
    price_min = parse_decimal(row.get("Price Min (SGD)"))
    price_max = parse_decimal(row.get("Price Max (SGD)"))
    latitude = parse_float(row.get("Latitude"))
    longitude = parse_float(row.get("Longitude"))
    last_verified_date = parse_date(row.get("Last Verified Date"))
    coverage_status = clean(row.get("Coverage Status"))

    if not business_name:
        issues.append(issue(row_number, "missing_business_name", "Stall / Restaurant Name is required."))
    if clean(row.get("Price Min (SGD)")) and price_min is None:
        issues.append(issue(row_number, "invalid_price_min", "Price Min (SGD) must be numeric."))
    if clean(row.get("Price Max (SGD)")) and price_max is None:
        issues.append(issue(row_number, "invalid_price_max", "Price Max (SGD) must be numeric."))
    if price_min is not None and price_max is not None and price_min > price_max:
        issues.append(issue(row_number, "invalid_price_range", "Price Min (SGD) cannot exceed Price Max (SGD)."))
    if clean(row.get("Latitude")) and latitude is None:
        issues.append(issue(row_number, "invalid_latitude", "Latitude must be numeric."))
    if clean(row.get("Longitude")) and longitude is None:
        issues.append(issue(row_number, "invalid_longitude", "Longitude must be numeric."))
    if clean(row.get("Last Verified Date")) and last_verified_date is None:
        issues.append(issue(row_number, "invalid_last_verified_date", "Last Verified Date must be YYYY-MM-DD."))
    if coverage_status and coverage_status.casefold() not in {"complete", "partial", "unknown", "out_of_scope"}:
        issues.append(issue(row_number, "invalid_coverage_status", "Coverage Status is not recognized."))

    key = dedupe_key(row)
    duplicate = bool(key and duplicate_counts[key] > 1)
    has_errors = any(item["severity"] == "error" for item in issues)
    if duplicate:
        issues.append(issue(row_number, "duplicate_source_key", f"Duplicate staging key: {key}.", "warning"))

    validation_status = "invalid" if has_errors else "dedupe_candidate" if duplicate else "valid"
    error_reason = "; ".join(item["error_code"] for item in issues if item["severity"] == "error") or None

    source_row_id = (
        clean(row.get("Business ID"))
        or clean(row.get("Stall ID"))
        or clean(row.get("Licence No"))
        or str(row_number)
    )
    raw_payload = {column: row.get(column, "") for column in EXPECTED_COLUMNS}
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
            "postal_code": clean(row.get("Postal Code")),
            "latitude": latitude,
            "longitude": longitude,
        },
        "menu": {
            "signature_dish": clean(row.get("Signature Dish")),
            "menu_text": clean(row.get("Menu")),
            "price_text": clean(row.get("Price")),
            "price_min_sgd": str(price_min) if price_min is not None else None,
            "price_max_sgd": str(price_max) if price_max is not None else None,
        },
        "source": {
            "source_type": clean(row.get("Source Type")),
            "source_url": clean(row.get("Source URL")),
            "coverage_status": coverage_status,
            "last_verified_date": last_verified_date,
        },
        "validation": {
            "status": validation_status,
            "issues": issues,
        },
    }

    values = {
        "source_row_id": source_row_id,
        "row_number": row_number,
        "raw_payload": raw_payload,
        "parsed_payload": parsed_payload,
        "business_id": clean(row.get("Business ID")),
        "stall_id": clean(row.get("Stall ID")),
        "licence_no": clean(row.get("Licence No")),
        "business_name": business_name,
        "normalized_name": normalized_name,
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
        "building_name": clean(row.get("Hawker Centre / Building")),
        "building_display_name": clean(row.get("Building Name")),
        "unit_number": clean(row.get("Unit No.")),
        "address": clean(row.get("Address")),
        "postal_code": clean(row.get("Postal Code")),
        "region": clean(row.get("Region")),
        "location_text": clean(row.get("Location")),
        "location_key": clean(row.get("Location Key")),
        "latitude": latitude,
        "longitude": longitude,
        "source_type_label": clean(row.get("Source Type")),
        "source_url": clean(row.get("Source URL")),
        "last_verified_date": last_verified_date,
        "coverage_status": coverage_status,
        "notes": clean(row.get("Notes")),
        "validation_status": validation_status,
        "error_reason": error_reason,
        "confidence": confidence_for(row, validation_status),
        "source_hash": row_hash(raw_payload),
    }
    return StagedRow(row_number=row_number, values=values, issues=issues)


def load_rows(csv_path: Path, limit: int | None) -> tuple[list[dict[str, str]], list[str]]:
    with csv_path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        fieldnames = reader.fieldnames or []
        missing = [column for column in EXPECTED_COLUMNS if column not in fieldnames]
        if missing:
            raise SystemExit(f"CSV is missing required columns: {', '.join(missing)}")

        rows: list[dict[str, str]] = []
        for row in reader:
            rows.append({column: row.get(column, "") for column in EXPECTED_COLUMNS})
            if limit is not None and len(rows) >= limit:
                break
    return rows, fieldnames


def row_sql(import_run_id: str, staged: StagedRow) -> str:
    values = {
        "import_run_id": import_run_id,
        "source_slug": SOURCE_SLUG,
        **staged.values,
    }
    rendered: list[str] = []
    for column in STAGING_COLUMNS:
        value = values[column]
        if column in {"raw_payload", "parsed_payload"}:
            rendered.append(sql_json(value))
        elif column in {"dietary_options", "delivery_platforms"}:
            rendered.append(sql_text_array(value))
        else:
            rendered.append(sql_literal(value))
    return "(" + ", ".join(rendered) + ")"


def rest_row(import_run_id: str, staged: StagedRow) -> dict[str, Any]:
    return json_ready(
        {
            "import_run_id": import_run_id,
            "source_slug": SOURCE_SLUG,
            **staged.values,
        }
    )


def rest_import_run(
    import_run_id: str,
    csv_digest: str,
    staged_rows: list[StagedRow],
    status: str,
    limited: bool,
) -> dict[str, Any]:
    valid_rows = sum(1 for row in staged_rows if row.values["validation_status"] == "valid")
    invalid_rows = sum(1 for row in staged_rows if row.values["validation_status"] == "invalid")
    dedupe_rows = sum(1 for row in staged_rows if row.values["validation_status"] == "dedupe_candidate")
    now = datetime.now(UTC).isoformat()
    payload = {
        "id": import_run_id,
        "source_slug": SOURCE_SLUG,
        "source_type": "csv",
        "source_file": SOURCE_FILE_LABEL,
        "status": status,
        "total_rows": len(staged_rows),
        "processed_rows": len(staged_rows) if status == "completed" else 0,
        "accepted_rows": valid_rows,
        "rejected_rows": invalid_rows,
        "metadata": {
            "csv_sha256": csv_digest,
            "generator": "scripts/stage_canonical_food_businesses.py",
            "limited": limited,
            "dedupe_candidate_rows": dedupe_rows,
        },
        "updated_at": now,
    }
    if status == "running":
        payload["started_at"] = now
        payload["completed_at"] = None
    if status == "completed":
        payload["completed_at"] = now
    return payload


def issue_rest_rows(import_run_id: str, staged_rows: list[StagedRow]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for staged in staged_rows:
        raw_payload = staged.values["raw_payload"]
        for item in staged.issues:
            rows.append(
                {
                    "import_run_id": import_run_id,
                    "staging_table": "staging_food_businesses",
                    "source_row_number": staged.row_number,
                    "severity": item["severity"],
                    "error_code": item["error_code"],
                    "message": item["message"],
                    "raw_payload": raw_payload,
                }
            )
    return rows


def import_run_counts(staged_rows: list[StagedRow]) -> tuple[int, int, int]:
    valid_rows = sum(1 for row in staged_rows if row.values["validation_status"] == "valid")
    invalid_rows = sum(1 for row in staged_rows if row.values["validation_status"] == "invalid")
    dedupe_rows = sum(1 for row in staged_rows if row.values["validation_status"] == "dedupe_candidate")
    return valid_rows, invalid_rows, dedupe_rows


def import_metadata(csv_digest: str, dedupe_rows: int, limited: bool) -> dict[str, Any]:
    return {
        "csv_sha256": csv_digest,
        "generator": "scripts/stage_canonical_food_businesses.py",
        "limited": limited,
        "dedupe_candidate_rows": dedupe_rows,
    }


def is_local_supabase_url(url_text: str) -> bool:
    try:
        parsed = parse.urlparse(url_text)
    except ValueError:
        return False
    return parsed.hostname in {"localhost", "127.0.0.1", "::1"}


def assert_import_target_is_allowed(url_text: str) -> None:
    if is_local_supabase_url(url_text):
        return

    hostname = parse.urlparse(url_text).hostname
    if not hostname or "." not in hostname:
        raise SystemExit(f"{IMPORT_URL_ENV} must be a valid Supabase project URL.")

    project_ref = hostname.split(".")[0]
    expected_project_ref = clean(os_environ(IMPORT_PROJECT_REF_ENV))
    if not expected_project_ref:
        raise SystemExit(
            f"Cloud imports require {IMPORT_PROJECT_REF_ENV} to confirm the intended staging project."
        )
    if project_ref != expected_project_ref:
        raise SystemExit(
            f"{IMPORT_PROJECT_REF_ENV}={expected_project_ref} does not match Supabase URL project ref {project_ref}."
        )


def os_environ(name: str) -> str | None:
    import os

    return os.environ.get(name)


def require_import_env() -> tuple[str, str]:
    url = clean(os_environ(IMPORT_URL_ENV))
    service_key = clean(os_environ(IMPORT_SERVICE_ROLE_ENV))
    missing = [name for name, value in [(IMPORT_URL_ENV, url), (IMPORT_SERVICE_ROLE_ENV, service_key)] if not value]
    if os_environ(IMPORT_OPT_IN_ENV) != "1":
        missing.append(f"{IMPORT_OPT_IN_ENV}=1")
    if missing:
        raise SystemExit(f"Missing required import environment: {', '.join(missing)}")
    assert_import_target_is_allowed(url)
    return url.rstrip("/"), service_key


def supabase_rest_request(
    base_url: str,
    service_key: str,
    method: str,
    table: str,
    query: str = "",
    body: Any | None = None,
    prefer: str = "return=minimal",
) -> None:
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


def apply_to_supabase(
    import_run_id: str,
    csv_digest: str,
    staged_rows: list[StagedRow],
    batch_size: int,
    limited: bool,
) -> None:
    base_url, service_key = require_import_env()
    import_run = rest_import_run(import_run_id, csv_digest, staged_rows, "running", limited)
    supabase_rest_request(
        base_url,
        service_key,
        "POST",
        "import_runs",
        "?on_conflict=id",
        [import_run],
        "resolution=merge-duplicates,return=minimal",
    )

    quoted_import_id = parse.quote(import_run_id, safe="")
    supabase_rest_request(
        base_url,
        service_key,
        "DELETE",
        "staging_import_errors",
        f"?import_run_id=eq.{quoted_import_id}",
    )
    supabase_rest_request(
        base_url,
        service_key,
        "DELETE",
        "staging_food_businesses",
        f"?import_run_id=eq.{quoted_import_id}",
    )

    for start in range(0, len(staged_rows), batch_size):
        batch = [rest_row(import_run_id, row) for row in staged_rows[start : start + batch_size]]
        supabase_rest_request(base_url, service_key, "POST", "staging_food_businesses", body=batch)

    errors = issue_rest_rows(import_run_id, staged_rows)
    for start in range(0, len(errors), batch_size):
        supabase_rest_request(
            base_url,
            service_key,
            "POST",
            "staging_import_errors",
            body=errors[start : start + batch_size],
        )

    completed_import_run = rest_import_run(
        import_run_id,
        csv_digest,
        staged_rows,
        "completed",
        limited,
    )
    supabase_rest_request(
        base_url,
        service_key,
        "PATCH",
        "import_runs",
        f"?id=eq.{quoted_import_id}",
        completed_import_run,
    )


def write_sql(
    output_path: Path,
    csv_path: Path,
    import_run_id: str,
    csv_digest: str,
    staged_rows: list[StagedRow],
    batch_size: int,
    limited: bool,
) -> None:
    valid_rows, invalid_rows, dedupe_rows = import_run_counts(staged_rows)
    all_issues = [item for row in staged_rows for item in row.issues]
    metadata = import_metadata(csv_digest, dedupe_rows, limited)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as sql:
        sql.write("-- Generated by scripts/stage_canonical_food_businesses.py.\n")
        sql.write("-- Staging-only import: does not mutate buildings, venues, dishes, or media tables.\n")
        sql.write("begin;\n\n")
        sql.write("insert into import_runs (\n")
        sql.write("  id, source_slug, source_type, source_file, status,\n")
        sql.write("  total_rows, processed_rows, accepted_rows, rejected_rows,\n")
        sql.write("  metadata, started_at, completed_at\n")
        sql.write(") values (\n")
        sql.write(
            "  "
            + ", ".join(
                [
                    sql_literal(import_run_id),
                    sql_literal(SOURCE_SLUG),
                    sql_literal("csv"),
                    sql_literal(SOURCE_FILE_LABEL),
                    sql_literal("completed"),
                    sql_literal(len(staged_rows)),
                    sql_literal(len(staged_rows)),
                    sql_literal(valid_rows),
                    sql_literal(invalid_rows),
                    sql_json(metadata),
                    "now()",
                    "now()",
                ]
            )
            + "\n"
        )
        sql.write(")\n")
        sql.write("on conflict (id) do update set\n")
        sql.write("  status = excluded.status,\n")
        sql.write("  total_rows = excluded.total_rows,\n")
        sql.write("  processed_rows = excluded.processed_rows,\n")
        sql.write("  accepted_rows = excluded.accepted_rows,\n")
        sql.write("  rejected_rows = excluded.rejected_rows,\n")
        sql.write("  metadata = excluded.metadata,\n")
        sql.write("  completed_at = excluded.completed_at,\n")
        sql.write("  updated_at = now();\n\n")
        sql.write(f"delete from staging_import_errors where import_run_id = {sql_literal(import_run_id)};\n")
        sql.write(f"delete from staging_food_businesses where import_run_id = {sql_literal(import_run_id)};\n\n")

        columns = ", ".join(STAGING_COLUMNS)
        for start in range(0, len(staged_rows), batch_size):
            batch = staged_rows[start : start + batch_size]
            sql.write(f"insert into staging_food_businesses ({columns}) values\n")
            sql.write(",\n".join(row_sql(import_run_id, row) for row in batch))
            sql.write(";\n\n")

        if all_issues:
            sql.write(
                "insert into staging_import_errors (import_run_id, staging_table, source_row_number, severity, error_code, message, raw_payload) values\n"
            )
            issue_values = []
            for staged in staged_rows:
                raw_payload = staged.values["raw_payload"]
                for item in staged.issues:
                    issue_values.append(
                        "("
                        + ", ".join(
                            [
                                sql_literal(import_run_id),
                                sql_literal("staging_food_businesses"),
                                sql_literal(staged.row_number),
                                sql_literal(item["severity"]),
                                sql_literal(item["error_code"]),
                                sql_literal(item["message"]),
                                sql_json(raw_payload),
                            ]
                        )
                        + ")"
                    )
            sql.write(",\n".join(issue_values))
            sql.write(";\n\n")
        sql.write("commit;\n")


def write_text(path: Path, text: str) -> None:
    path.write_text(text, encoding="utf-8")


def write_split_sql(
    output_dir: Path,
    import_run_id: str,
    csv_digest: str,
    staged_rows: list[StagedRow],
    batch_size: int,
    limited: bool,
) -> list[Path]:
    valid_rows, invalid_rows, dedupe_rows = import_run_counts(staged_rows)
    metadata = import_metadata(csv_digest, dedupe_rows, limited)
    all_issues = [item for row in staged_rows for item in row.issues]
    output_dir.mkdir(parents=True, exist_ok=True)
    for stale_file in output_dir.glob("*.sql"):
        stale_file.unlink()

    written: list[Path] = []
    prepare_path = output_dir / "0001_prepare_import.sql"
    write_text(
        prepare_path,
        "\n".join(
            [
                "-- Generated by scripts/stage_canonical_food_businesses.py.",
                "-- Staging-only import prepare step.",
                "begin;",
                "insert into import_runs (",
                "  id, source_slug, source_type, source_file, status,",
                "  total_rows, processed_rows, accepted_rows, rejected_rows,",
                "  metadata, started_at, completed_at",
                ") values (",
                "  "
                + ", ".join(
                    [
                        sql_literal(import_run_id),
                        sql_literal(SOURCE_SLUG),
                        sql_literal("csv"),
                        sql_literal(SOURCE_FILE_LABEL),
                        sql_literal("running"),
                        sql_literal(len(staged_rows)),
                        sql_literal(0),
                        sql_literal(0),
                        sql_literal(0),
                        sql_json(metadata),
                        "now()",
                        "null",
                    ]
                ),
                ")",
                "on conflict (id) do update set",
                "  status = excluded.status,",
                "  total_rows = excluded.total_rows,",
                "  processed_rows = 0,",
                "  accepted_rows = 0,",
                "  rejected_rows = 0,",
                "  metadata = excluded.metadata,",
                "  started_at = coalesce(import_runs.started_at, now()),",
                "  completed_at = null,",
                "  updated_at = now();",
                f"delete from staging_import_errors where import_run_id = {sql_literal(import_run_id)};",
                f"delete from staging_food_businesses where import_run_id = {sql_literal(import_run_id)};",
                "commit;",
                "",
            ]
        ),
    )
    written.append(prepare_path)

    columns = ", ".join(STAGING_COLUMNS)
    next_index = 2
    for start in range(0, len(staged_rows), batch_size):
        batch = staged_rows[start : start + batch_size]
        batch_path = output_dir / f"{next_index:04d}_staging_food_businesses_{start + 1:05d}.sql"
        write_text(
            batch_path,
            "\n".join(
                [
                    "-- Generated by scripts/stage_canonical_food_businesses.py.",
                    "-- Staging-only food-business rows.",
                    "begin;",
                    f"insert into staging_food_businesses ({columns}) values",
                    ",\n".join(row_sql(import_run_id, row) for row in batch) + ";",
                    "commit;",
                    "",
                ]
            ),
        )
        written.append(batch_path)
        next_index += 1

    for start in range(0, len(all_issues), batch_size):
        issue_values = []
        for staged in staged_rows:
            raw_payload = staged.values["raw_payload"]
            for item in staged.issues:
                issue_values.append(
                    "("
                    + ", ".join(
                        [
                            sql_literal(import_run_id),
                            sql_literal("staging_food_businesses"),
                            sql_literal(staged.row_number),
                            sql_literal(item["severity"]),
                            sql_literal(item["error_code"]),
                            sql_literal(item["message"]),
                            sql_json(raw_payload),
                        ]
                    )
                    + ")"
                )
        batch_values = issue_values[start : start + batch_size]
        if not batch_values:
            continue
        issue_path = output_dir / f"{next_index:04d}_staging_import_errors_{start + 1:05d}.sql"
        write_text(
            issue_path,
            "\n".join(
                [
                    "-- Generated by scripts/stage_canonical_food_businesses.py.",
                    "-- Staging-only validation issues.",
                    "begin;",
                    "insert into staging_import_errors (import_run_id, staging_table, source_row_number, severity, error_code, message, raw_payload) values",
                    ",\n".join(batch_values) + ";",
                    "commit;",
                    "",
                ]
            ),
        )
        written.append(issue_path)
        next_index += 1

    complete_path = output_dir / f"{next_index:04d}_complete_import.sql"
    write_text(
        complete_path,
        "\n".join(
            [
                "-- Generated by scripts/stage_canonical_food_businesses.py.",
                "-- Staging-only import completion step.",
                "begin;",
                "update import_runs set",
                "  status = 'completed',",
                f"  processed_rows = {sql_literal(len(staged_rows))},",
                f"  accepted_rows = {sql_literal(valid_rows)},",
                f"  rejected_rows = {sql_literal(invalid_rows)},",
                "  completed_at = now(),",
                "  updated_at = now()",
                f"where id = {sql_literal(import_run_id)};",
                "commit;",
                "",
            ]
        ),
    )
    written.append(complete_path)
    return written


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", default=str(DEFAULT_CSV), help="Canonical CSV path.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="SQL output path.")
    parser.add_argument(
        "--split-output-dir",
        nargs="?",
        const=str(DEFAULT_SPLIT_OUTPUT_DIR),
        help=(
            "Write the staging import as sequential smaller SQL files for Supabase CLI db query. "
            f"Defaults to {DEFAULT_SPLIT_OUTPUT_DIR} when no value is provided."
        ),
    )
    parser.add_argument("--limit", type=int, help="Limit rows for contract tests or dry runs.")
    parser.add_argument("--batch-size", type=int, default=500, help="Rows per insert statement.")
    parser.add_argument("--summary-only", action="store_true", help="Print summary without writing SQL.")
    parser.add_argument(
        "--apply-supabase",
        action="store_true",
        help=(
            "Apply rows directly to Supabase REST staging tables. Requires "
            f"{IMPORT_URL_ENV}, {IMPORT_SERVICE_ROLE_ENV}, and {IMPORT_OPT_IN_ENV}=1."
        ),
    )
    args = parser.parse_args()

    csv_path = Path(args.csv)
    output_path = Path(args.output)
    rows, _ = load_rows(csv_path, args.limit)
    digest = file_hash(csv_path)
    import_run_id = str(uuid.uuid5(IMPORT_UUID_NAMESPACE, f"{SOURCE_FILE_LABEL}:{digest}"))
    duplicate_counts = Counter(key for row in rows if (key := dedupe_key(row)))
    staged_rows = [stage_row(index + 2, row, duplicate_counts) for index, row in enumerate(rows)]
    summary = {
        "csv": str(csv_path),
        "output": None if args.summary_only or args.apply_supabase or args.split_output_dir else str(output_path),
        "split_output_dir": args.split_output_dir,
        "source_slug": SOURCE_SLUG,
        "import_run_id": import_run_id,
        "csv_sha256": digest,
        "total_rows": len(staged_rows),
        "valid_rows": sum(1 for row in staged_rows if row.values["validation_status"] == "valid"),
        "dedupe_candidate_rows": sum(
            1 for row in staged_rows if row.values["validation_status"] == "dedupe_candidate"
        ),
        "invalid_rows": sum(1 for row in staged_rows if row.values["validation_status"] == "invalid"),
        "issue_count": sum(len(row.issues) for row in staged_rows),
        "limited": args.limit is not None,
    }

    if args.apply_supabase and args.summary_only:
        raise SystemExit("--apply-supabase cannot be combined with --summary-only")
    if args.apply_supabase and args.split_output_dir:
        raise SystemExit("--apply-supabase cannot be combined with --split-output-dir")

    if args.apply_supabase:
        apply_to_supabase(
            import_run_id,
            digest,
            staged_rows,
            args.batch_size,
            args.limit is not None,
        )
        summary["applied_to_supabase"] = True
    elif args.split_output_dir:
        split_paths = write_split_sql(
            Path(args.split_output_dir),
            import_run_id,
            digest,
            staged_rows,
            args.batch_size,
            args.limit is not None,
        )
        summary["split_output_dir"] = args.split_output_dir
        summary["split_file_count"] = len(split_paths)
    elif not args.summary_only:
        write_sql(
            output_path,
            csv_path,
            import_run_id,
            digest,
            staged_rows,
            args.batch_size,
            args.limit is not None,
        )

    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
