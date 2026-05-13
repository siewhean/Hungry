#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


DEFAULT_SPREADSHEET_ID = "18R6h57sXZPuYyFkZhnvUr81mEwf4ZCynbzGPaLXr9ZM"
DEFAULT_SHEET_NAME = "Sheet1"
DEFAULT_SOURCE_CSV = Path("data/singapore_food_businesses_canonical.csv")
KEY_HEADERS = ("Business Name Normalized", "Postal Code", "Address")
NULLISH = {"", "-", "—", "N/A", "NA", "nil", "None", "none", "null"}


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text in NULLISH else text


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", clean(value)).strip()


def normalize_postal(value: str) -> str:
    digits = re.sub(r"\D", "", clean(value))
    if not digits:
        return ""
    return digits[-6:] if len(digits) >= 6 else digits.zfill(6)


def normalize_key_value(header: str, value: str) -> str:
    if header == "Postal Code":
        return normalize_postal(value)
    return normalize_spaces(value).lower()


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        os.environ.setdefault(key, value)


def sheets_request(method: str, url: str, token: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url=url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
        raise RuntimeError(f"HTTP {exc.code} for {url}: {body[:600]}") from exc


def get_sheet_values(spreadsheet_id: str, sheet_name: str, token: str) -> list[list[str]]:
    quoted = urllib.parse.quote(f"{sheet_name}!A1:ZZ", safe="")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{quoted}"
    res = sheets_request("GET", url, token)
    return res.get("values", []) or []


def batch_update_cells(spreadsheet_id: str, value_ranges: list[dict[str, Any]], token: str) -> None:
    if not value_ranges:
        return
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values:batchUpdate"
    sheets_request(
        "POST",
        url,
        token,
        {
            "valueInputOption": "RAW",
            "data": value_ranges,
            "includeValuesInResponse": False,
        },
    )


def append_rows(spreadsheet_id: str, sheet_name: str, rows: list[list[str]], token: str) -> None:
    if not rows:
        return
    quoted = urllib.parse.quote(f"{sheet_name}!A:ZZ", safe="")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{quoted}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"
    sheets_request("POST", url, token, {"values": rows})


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def build_key(row: dict[str, str]) -> tuple[str, str, str] | None:
    parts = []
    for header in KEY_HEADERS:
        normalized = normalize_key_value(header, row.get(header, ""))
        parts.append(normalized)
    if not all(parts):
        return None
    return tuple(parts)  # type: ignore[return-value]


def cell_a1(col_idx_0: int, row_number_1: int) -> str:
    n = col_idx_0 + 1
    chars: list[str] = []
    while n:
        n, rem = divmod(n - 1, 26)
        chars.append(chr(65 + rem))
    return f"{''.join(reversed(chars))}{row_number_1}"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--spreadsheet-id", default=DEFAULT_SPREADSHEET_ID)
    parser.add_argument("--sheet-name", default=DEFAULT_SHEET_NAME)
    parser.add_argument("--source-csv", default=str(DEFAULT_SOURCE_CSV))
    parser.add_argument("--allow-overwrite-existing", action="store_true")
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--token-env", default="GOOGLE_SHEETS_ACCESS_TOKEN")
    parser.add_argument("--token-env-backup", default="GOOGLE_SHEETS_ACCESS_TOKEN_BACKUP")
    parser.add_argument("--use-backup-token", action="store_true")
    args = parser.parse_args()

    load_dotenv(Path(args.env_file))
    token_env = args.token_env_backup if args.use_backup_token else args.token_env
    token = clean(os.getenv(token_env))
    if not token:
        raise SystemExit(f"Missing Sheets token in env `{token_env}`")

    source_rows = read_csv_rows(Path(args.source_csv))
    sheet_values = get_sheet_values(args.spreadsheet_id, args.sheet_name, token)
    if not sheet_values:
        raise SystemExit("Sheet has no headers/rows.")
    headers = [clean(h) for h in sheet_values[0]]
    header_idx = {name: i for i, name in enumerate(headers)}
    for key_header in KEY_HEADERS:
        if key_header not in header_idx:
            raise SystemExit(f"Missing required key header in sheet: {key_header}")

    existing_rows: list[dict[str, str]] = []
    existing_keys: dict[tuple[str, str, str], int] = {}
    for i, row_values in enumerate(sheet_values[1:], start=2):
        row = {}
        for col_name, col_idx in header_idx.items():
            row[col_name] = clean(row_values[col_idx]) if col_idx < len(row_values) else ""
        existing_rows.append(row)
        key = build_key(row)
        if key and key not in existing_keys:
            existing_keys[key] = i

    rows_scanned = 0
    rows_matched = 0
    rows_to_append = 0
    rows_skipped_missing_key = 0
    cells_to_update = 0
    value_ranges: list[dict[str, Any]] = []
    append_payload: list[list[str]] = []

    for src in source_rows:
        rows_scanned += 1
        key = build_key(src)
        if key is None:
            rows_skipped_missing_key += 1
            continue
        row_number = existing_keys.get(key)
        if row_number is None:
            rows_to_append += 1
            append_payload.append([clean(src.get(h, "")) for h in headers])
            continue

        rows_matched += 1
        existing = existing_rows[row_number - 2]
        for header in headers:
            src_value = clean(src.get(header, ""))
            if not src_value:
                continue
            old_value = clean(existing.get(header, ""))
            if old_value:
                if args.allow_overwrite_existing and old_value != src_value:
                    col = header_idx[header]
                    value_ranges.append(
                        {
                            "range": f"{args.sheet_name}!{cell_a1(col, row_number)}",
                            "values": [[src_value]],
                        }
                    )
                    cells_to_update += 1
                continue
            col = header_idx[header]
            value_ranges.append(
                {
                    "range": f"{args.sheet_name}!{cell_a1(col, row_number)}",
                    "values": [[src_value]],
                }
            )
            cells_to_update += 1

    summary = {
        "spreadsheet_id": args.spreadsheet_id,
        "sheet_name": args.sheet_name,
        "rows_scanned": rows_scanned,
        "rows_matched": rows_matched,
        "rows_to_append": rows_to_append,
        "rows_appended": 0,
        "cells_to_update": cells_to_update,
        "cells_updated": 0,
        "rows_skipped_missing_key": rows_skipped_missing_key,
        "overwrite_existing": bool(args.allow_overwrite_existing),
        "dry_run": bool(args.dry_run),
    }

    if not args.dry_run:
        for i in range(0, len(value_ranges), 500):
            batch_update_cells(args.spreadsheet_id, value_ranges[i : i + 500], token)
        for i in range(0, len(append_payload), 500):
            append_rows(args.spreadsheet_id, args.sheet_name, append_payload[i : i + 500], token)
        summary["rows_appended"] = rows_to_append
        summary["cells_updated"] = cells_to_update

    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
