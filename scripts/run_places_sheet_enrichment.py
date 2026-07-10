#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import urllib.parse
import urllib.request
from typing import Any

from google_places_sheet_enrich import haversine_m, run_passes


SHEET_ID = "18R6h57sXZPuYyFkZhnvUr81mEwf4ZCynbzGPaLXr9ZM"
SHEET_NAME = "Sheet1"


def clean(v: Any) -> str:
    return "" if v is None else str(v).strip()


def col_to_index(col: str) -> int:
    value = 0
    for c in col:
        value = value * 26 + (ord(c) - 64)
    return value - 1


def api_request(token: str, method: str, url: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
    data = None
    req = urllib.request.Request(url=url, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        req.add_header("Content-Type", "application/json; charset=utf-8")
    with urllib.request.urlopen(req, data=data, timeout=90) as resp:
        raw = resp.read().decode("utf-8", errors="replace")
        return json.loads(raw) if raw else {}


def fetch_sheet(token: str) -> tuple[list[str], list[list[str]]]:
    encoded = urllib.parse.quote(f"{SHEET_NAME}!A1:ZZ")
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values/{encoded}"
    values = api_request(token, "GET", url).get("values") or []
    header = [clean(v) for v in values[0]]
    rows = [[clean(c) for c in r] for r in values[1:]]
    return header, rows


def refresh_token() -> str:
    client_id = clean(os.getenv("GOOGLE_OAUTH_CLIENT_ID"))
    client_secret = clean(os.getenv("GOOGLE_OAUTH_CLIENT_SECRET"))
    refresh = clean(os.getenv("GOOGLE_OAUTH_REFRESH_TOKEN"))
    if not (client_id and client_secret and refresh):
        return clean(os.getenv("GOOGLE_SHEETS_ACCESS_TOKEN"))
    body = urllib.parse.urlencode(
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")
    req = urllib.request.Request("https://oauth2.googleapis.com/token", data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8", errors="replace"))
    return clean(payload.get("access_token"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--start-row", type=int, default=2)
    parser.add_argument("--max-search-text", type=int, default=500)
    parser.add_argument("--max-get-place", type=int, default=120)
    parser.add_argument("--max-photo-meta", type=int, default=80)
    parser.add_argument("--disable-details", action="store_true")
    parser.add_argument("--disable-photo-meta", action="store_true")
    args = parser.parse_args()

    sheets_token = refresh_token()
    maps_key = clean(os.getenv("GOOGLE_MAPS_ENRICHMENT_API_KEY"))
    if not sheets_token:
        raise SystemExit("Missing sheets auth token")
    if not maps_key:
        raise SystemExit("Missing GOOGLE_MAPS_ENRICHMENT_API_KEY")

    header, sheet_rows = fetch_sheet(sheets_token)
    rows: list[dict[str, Any]] = []
    for row in sheet_rows:
        row_map = {name: (row[idx] if idx < len(row) else "") for idx, name in enumerate(header)}
        rows.append(row_map)

    payload = {
        "api_key": maps_key,
        "credit_ceiling_usd": 250,
        "credit_spend_so_far_usd": 0,
        "rate_limit_per_min": 240,
        "enable_place_id_matching": True,
        "enable_place_details": not args.disable_details,
        "enable_photo_metadata": not args.disable_photo_meta,
        "max_search_text_per_run": args.max_search_text,
        "max_details_per_run": args.max_get_place,
        "max_photo_meta_per_run": args.max_photo_meta,
        "start_row": args.start_row,
        "rows": rows,
        "field_map": {},
    }
    result = run_passes(payload)

    header_idx = {name: idx for idx, name in enumerate(header)}
    letter_idx = {letter: col_to_index(letter) for letter in ["AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ"]}
    ar_az_counts = {k: 0 for k in ["AR", "AS", "AT", "AU", "AV", "AW", "AX", "AY", "AZ"]}
    flagged_geo_rows: list[dict[str, Any]] = []
    write_data: list[dict[str, Any]] = []

    for upd in result.get("updates", []):
        row_num = int(upd["row"])
        col = clean(upd["col"])
        value = upd.get("value")
        row_idx = row_num - 2
        if row_idx < 0 or row_idx >= len(sheet_rows):
            continue
        col_idx = letter_idx.get(col)
        if col_idx is None:
            continue
        current = sheet_rows[row_idx][col_idx] if col_idx < len(sheet_rows[row_idx]) else ""
        if clean(current):
            continue

        if col in {"AN", "AO", "AP"}:
            lat_idx = header_idx.get("Latitude")
            lng_idx = header_idx.get("Longitude")
            existing_lat = clean(sheet_rows[row_idx][lat_idx]) if lat_idx is not None and lat_idx < len(sheet_rows[row_idx]) else ""
            existing_lng = clean(sheet_rows[row_idx][lng_idx]) if lng_idx is not None and lng_idx < len(sheet_rows[row_idx]) else ""
            if existing_lat and existing_lng:
                try:
                    e_lat = float(existing_lat)
                    e_lng = float(existing_lng)
                    g_lat = float(upd.get("value")) if col == "AN" else float(next((u["value"] for u in result["updates"] if int(u["row"]) == row_num and clean(u["col"]) == "AN"), e_lat))
                    g_lng = float(upd.get("value")) if col == "AO" else float(next((u["value"] for u in result["updates"] if int(u["row"]) == row_num and clean(u["col"]) == "AO"), e_lng))
                    dist = haversine_m(e_lat, e_lng, g_lat, g_lng)
                except Exception:
                    dist = 0.0
                if dist < 120:
                    continue
                flagged_geo_rows.append({"row": row_num, "distance_m": round(dist, 2)})

        if col in ar_az_counts:
            ar_az_counts[col] += 1
        write_data.append({"range": f"{SHEET_NAME}!{col}{row_num}", "majorDimension": "ROWS", "values": [[value]]})

    if write_data:
        api_request(
            sheets_token,
            "POST",
            f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values:batchUpdate",
            {"valueInputOption": "RAW", "data": write_data},
        )

    result["applied_updates"] = len(write_data)
    result["ar_az_fill_counts"] = ar_az_counts
    result["flagged_geo_difference_rows"] = flagged_geo_rows
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
