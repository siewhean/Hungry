#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from google_places_sheet_enrich import run_passes


DEFAULT_SPREADSHEET_ID = "18R6h57sXZPuYyFkZhnvUr81mEwf4ZCynbzGPaLXr9ZM"
DEFAULT_SHEET_NAME = "Sheet1"
NULLISH = {"", "-", "—", "N/A", "NA", "nil", "None", "none", "null"}
AR_AZ_COLUMNS = ("AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ")


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text in NULLISH else text


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip("'").strip('"'))


def sheets_request(method: str, url: str, token: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url=url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if hasattr(exc, "read") else ""
        raise RuntimeError(f"HTTP {exc.code} for {url}: {body[:600]}") from exc


def fetch_sheet(spreadsheet_id: str, sheet_name: str, token: str) -> tuple[list[str], list[dict[str, str]]]:
    quoted = urllib.parse.quote(f"{sheet_name}!A1:ZZ", safe="")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/{quoted}"
    values = (sheets_request("GET", url, token).get("values") or [])
    if not values:
        raise RuntimeError("Sheet has no values.")
    headers = [clean(x) for x in values[0]]
    rows: list[dict[str, str]] = []
    for row_vals in values[1:]:
        row = {}
        for i, h in enumerate(headers):
            row[h] = clean(row_vals[i]) if i < len(row_vals) else ""
        rows.append(row)
    return headers, rows


def apply_updates(spreadsheet_id: str, updates: list[dict[str, Any]], sheet_name: str, token: str) -> int:
    if not updates:
        return 0
    data = []
    for u in updates:
        data.append(
            {
                "range": f"{sheet_name}!{u['col']}{u['row']}",
                "values": [[u.get("value", "")]],
            }
        )
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values:batchUpdate"
    for i in range(0, len(data), 500):
        sheets_request(
            "POST",
            url,
            token,
            {
                "valueInputOption": "RAW",
                "data": data[i : i + 500],
                "includeValuesInResponse": False,
            },
        )
    return len(data)


def build_field_map(headers: list[str]) -> dict[str, str]:
    mapping = {}
    for h in headers:
        mapping[h] = h
    return mapping


def is_hard_quota_error(message: str) -> bool:
    msg = message.lower()
    return "http 429" in msg and ("resource_exhausted" in msg or "per day" in msg or "quota" in msg)


def run_account(
    account: str,
    spreadsheet_id: str,
    sheet_name: str,
    token: str,
    api_key: str,
    credit_ceiling_usd: float,
    rate_limit_per_min: int,
    max_search_per_chunk: int,
    max_detail_per_chunk: int,
    max_photo_per_chunk: int,
) -> dict[str, Any]:
    total = {
        "account": account,
        "status": "running",
        "quota_reached": False,
        "rows_scanned": 0,
        "rows_enriched": 0,
        "rows_skipped_low_confidence": 0,
        "dedupe_savings": 0,
        "geo_diff_flagged_rows": [],
        "search_text": 0,
        "get_place": 0,
        "get_photo_meta": 0,
        "backoff_429_events": 0,
        "cells_updated": 0,
        "iterations": 0,
        "next_row_to_continue": 2,
        "ar_az_fill_counts": {k: 0 for k in AR_AZ_COLUMNS},
    }
    start_row = 2
    seen_updates = set()
    while True:
        total["iterations"] += 1
        headers, rows = fetch_sheet(spreadsheet_id, sheet_name, token)
        if start_row > len(rows) + 1:
            start_row = 2
        scoped_rows = rows[start_row - 2 :]
        payload = {
            "api_key": api_key,
            "credit_ceiling_usd": credit_ceiling_usd,
            "credit_spend_so_far_usd": 0,
            "rate_limit_per_min": rate_limit_per_min,
            "enable_place_id_matching": True,
            "enable_place_details": True,
            "enable_photo_metadata": True,
            "max_search_text_per_run": max_search_per_chunk,
            "max_details_per_run": max_detail_per_chunk,
            "max_photo_meta_per_run": max_photo_per_chunk,
            "start_row": start_row,
            "rows": scoped_rows,
            "field_map": build_field_map(headers),
            "max_low_confidence_samples": 25,
        }
        try:
            result = run_passes(payload)
        except RuntimeError as exc:
            message = str(exc)
            if is_hard_quota_error(message):
                total["status"] = "quota_reached"
                total["quota_reached"] = True
                break
            total["status"] = "error"
            total["error"] = message
            break

        updates = result.get("updates", []) or []
        filtered_updates = []
        for u in updates:
            key = (u.get("row"), u.get("col"), clean(u.get("value")))
            if key in seen_updates:
                continue
            seen_updates.add(key)
            filtered_updates.append(u)
        applied = apply_updates(spreadsheet_id, filtered_updates, sheet_name, token)
        total["cells_updated"] += applied
        total["rows_scanned"] += int(result.get("rows_scanned", 0) or 0)
        total["rows_enriched"] += int(result.get("rows_enriched_place_id", 0) or 0)
        total["rows_skipped_low_confidence"] += int(result.get("rows_skipped_low_confidence", 0) or 0)
        total["dedupe_savings"] += int(result.get("dedupe_savings", 0) or 0)
        total["geo_diff_flagged_rows"].extend(result.get("geo_diff_flagged_rows", []) or [])

        usage = result.get("usage", {}) or {}
        total["search_text"] += int(usage.get("SearchText", 0) or 0)
        total["get_place"] += int(usage.get("GetPlace", 0) or 0)
        total["get_photo_meta"] += int(usage.get("GetPhotoMeta", 0) or 0)
        total["backoff_429_events"] += int(usage.get("Backoff429Events", 0) or 0)

        for u in filtered_updates:
            col = clean(u.get("col"))
            if col in AR_AZ_COLUMNS:
                total["ar_az_fill_counts"][col] += 1

        stop_reason = clean(result.get("stop_reason"))
        last_row = int(result.get("last_row_processed") or start_row)
        total["next_row_to_continue"] = min(last_row + 1, max(2, len(rows) + 1))

        # Keep pinning quota until hard 429 for the account.
        if stop_reason == "credit_ceiling_reached":
            total["status"] = "credit_ceiling_reached"
            break
        if stop_reason == "max_search_text_per_run_reached":
            start_row = total["next_row_to_continue"]
            continue
        if not filtered_updates and int(result.get("rows_enriched_place_id", 0) or 0) == 0:
            start_row = total["next_row_to_continue"]
            # Give one more pass from top to fill AR:AZ from existing place IDs.
            if start_row > len(rows):
                start_row = 2
            if total["iterations"] >= 4:
                total["status"] = "completed_without_quota_hit"
                break
            continue

        start_row = total["next_row_to_continue"]
        time.sleep(0.2)
    return total


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--spreadsheet-id", default=DEFAULT_SPREADSHEET_ID)
    parser.add_argument("--sheet-name", default=DEFAULT_SHEET_NAME)
    parser.add_argument("--env-file", default=".env.local")
    parser.add_argument("--credit-ceiling-usd", type=float, default=250.0)
    parser.add_argument("--rate-limit-per-min", type=int, default=180)
    parser.add_argument("--max-search-per-chunk", type=int, default=500)
    parser.add_argument("--max-detail-per-chunk", type=int, default=300)
    parser.add_argument("--max-photo-per-chunk", type=int, default=300)
    args = parser.parse_args()

    load_dotenv(Path(args.env_file))
    sheets_token_primary = clean(os.getenv("GOOGLE_SHEETS_ACCESS_TOKEN"))
    sheets_token_backup = clean(os.getenv("GOOGLE_SHEETS_ACCESS_TOKEN_BACKUP")) or sheets_token_primary
    maps_key_primary = clean(os.getenv("GOOGLE_MAPS_ENRICHMENT_API_KEY"))
    maps_key_backup = clean(os.getenv("GOOGLE_MAPS_ENRICHMENT_API_KEY_BACKUP"))
    if not sheets_token_primary:
        raise SystemExit("Missing GOOGLE_SHEETS_ACCESS_TOKEN")
    if not maps_key_primary:
        raise SystemExit("Missing GOOGLE_MAPS_ENRICHMENT_API_KEY")
    if not maps_key_backup:
        raise SystemExit("Missing GOOGLE_MAPS_ENRICHMENT_API_KEY_BACKUP")

    primary = run_account(
        account="primary",
        spreadsheet_id=args.spreadsheet_id,
        sheet_name=args.sheet_name,
        token=sheets_token_primary,
        api_key=maps_key_primary,
        credit_ceiling_usd=args.credit_ceiling_usd,
        rate_limit_per_min=args.rate_limit_per_min,
        max_search_per_chunk=args.max_search_per_chunk,
        max_detail_per_chunk=args.max_detail_per_chunk,
        max_photo_per_chunk=args.max_photo_per_chunk,
    )
    backup = run_account(
        account="backup",
        spreadsheet_id=args.spreadsheet_id,
        sheet_name=args.sheet_name,
        token=sheets_token_backup,
        api_key=maps_key_backup,
        credit_ceiling_usd=args.credit_ceiling_usd,
        rate_limit_per_min=args.rate_limit_per_min,
        max_search_per_chunk=args.max_search_per_chunk,
        max_detail_per_chunk=args.max_detail_per_chunk,
        max_photo_per_chunk=args.max_photo_per_chunk,
    )

    print(
        json.dumps(
            {
                "mode": "CREDIT_SAFE_FREE_TRIAL",
                "credit_ceiling_usd": args.credit_ceiling_usd,
                "accounts": [primary, backup],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
