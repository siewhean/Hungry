#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any


SHEET_ID = "18R6h57sXZPuYyFkZhnvUr81mEwf4ZCynbzGPaLXr9ZM"
SHEET_TAB = "Sheet1"
SOURCE_CSV = "data/singapore_food_businesses_canonical.csv"
KEY_FIELDS = ("Business Name Normalized", "Postal Code", "Address")


def clean(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def row_key(row: dict[str, str]) -> str:
    return "|".join(clean(row.get(field, "")).lower() for field in KEY_FIELDS)


def api_request(token: str, method: str, url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    req = urllib.request.Request(url=url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        req.add_header("Content-Type", "application/json; charset=utf-8")
    try:
        with urllib.request.urlopen(req, data=data, timeout=60) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {exc.code} {method} {url}: {detail[:600]}") from exc


def fetch_access_token_from_refresh() -> str:
    client_id = clean(os.getenv("GOOGLE_OAUTH_CLIENT_ID"))
    client_secret = clean(os.getenv("GOOGLE_OAUTH_CLIENT_SECRET"))
    refresh_token = clean(os.getenv("GOOGLE_OAUTH_REFRESH_TOKEN"))
    if not (client_id and client_secret and refresh_token):
        return ""

    token_url = "https://oauth2.googleapis.com/token"
    body = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    req = urllib.request.Request(url=token_url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
            return clean(payload.get("access_token"))
    except Exception:
        return ""


def col_to_index(col: str) -> int:
    value = 0
    for char in col:
        value = value * 26 + (ord(char) - 64)
    return value - 1


def col_from_index(index: int) -> str:
    out = []
    n = index + 1
    while n:
        n, rem = divmod(n - 1, 26)
        out.append(chr(65 + rem))
    return "".join(reversed(out))


def load_csv_rows() -> list[dict[str, str]]:
    with open(SOURCE_CSV, "r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return [{k: clean(v) for k, v in row.items()} for row in reader]


def fetch_sheet_rows(token: str) -> tuple[list[str], list[list[str]]]:
    encoded = urllib.parse.quote(f"{SHEET_TAB}!A1:ZZ")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{encoded}"
    data = api_request(token, "GET", url)
    values = data.get("values") or []
    if not values:
        raise RuntimeError("Sheet appears empty; expected header row in Sheet1.")
    header = [clean(v) for v in values[0]]
    rows = [[clean(cell) for cell in row] for row in values[1:]]
    return header, rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--spreadsheet-id", default=SHEET_ID)
    parser.add_argument("--sheet-name", default=SHEET_TAB)
    args = parser.parse_args()

    token = clean(os.getenv("GOOGLE_SHEETS_ACCESS_TOKEN"))
    token = fetch_access_token_from_refresh() or token
    if not token:
        raise SystemExit("Missing GOOGLE_SHEETS_ACCESS_TOKEN")

    csv_rows = load_csv_rows()
    header, sheet_rows = fetch_sheet_rows(token)
    header_idx = {name: idx for idx, name in enumerate(header)}
    for field in KEY_FIELDS:
        if field not in header_idx:
            raise SystemExit(f"Missing key field in sheet header: {field}")

    existing: dict[str, tuple[int, list[str]]] = {}
    for i, row in enumerate(sheet_rows):
        row_map: dict[str, str] = {}
        for name, idx in header_idx.items():
            row_map[name] = row[idx] if idx < len(row) else ""
        key = row_key(row_map)
        if key:
            existing[key] = (i + 2, row)

    rows_matched = 0
    rows_to_append: list[list[str]] = []
    update_cells: list[dict[str, Any]] = []
    rows_skipped_missing_key = 0

    for row in csv_rows:
        key = row_key(row)
        if not key or key == "||":
            rows_skipped_missing_key += 1
            continue
        if key in existing:
            rows_matched += 1
            sheet_row_num, current = existing[key]
            for h, idx in header_idx.items():
                incoming = clean(row.get(h, ""))
                if not incoming:
                    continue
                current_value = clean(current[idx] if idx < len(current) else "")
                if current_value:
                    continue
                update_cells.append({"range": f"{args.sheet_name}!{col_from_index(idx)}{sheet_row_num}", "value": incoming})
            continue
        rows_to_append.append([clean(row.get(h, "")) for h in header])

    result = {
        "spreadsheet_id": args.spreadsheet_id,
        "sheet_name": args.sheet_name,
        "rows_scanned": len(csv_rows),
        "rows_matched": rows_matched,
        "rows_to_append": len(rows_to_append),
        "cells_to_update": len(update_cells),
        "rows_skipped_missing_key": rows_skipped_missing_key,
        "overwrite_existing": False,
        "mode": "dry-run" if args.dry_run else "write",
    }

    if args.dry_run:
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    if rows_to_append:
        append_url = (
            f"https://sheets.googleapis.com/v4/spreadsheets/{args.spreadsheet_id}/values/"
            f"{urllib.parse.quote(args.sheet_name)}!A1:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS"
        )
        api_request(token, "POST", append_url, {"majorDimension": "ROWS", "values": rows_to_append})

    if update_cells:
        update_payload = {
            "valueInputOption": "RAW",
            "data": [{"range": item["range"], "majorDimension": "ROWS", "values": [[item["value"]]]} for item in update_cells],
        }
        update_url = f"https://sheets.googleapis.com/v4/spreadsheets/{args.spreadsheet_id}/values:batchUpdate"
        api_request(token, "POST", update_url, update_payload)

    result["rows_appended"] = len(rows_to_append)
    result["cells_updated"] = len(update_cells)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
