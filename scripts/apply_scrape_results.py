#!/usr/bin/env python3
from __future__ import annotations

import os
import json
import urllib.parse
import urllib.request
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = ROOT / "data" / "Hungry F&B Database.xlsx"
INPUT_PATH = ROOT / "data" / "scrape_results.json"
SHEET_ID = "18R6h57sXZPuYyFkZhnvUr81mEwf4ZCynbzGPaLXr9ZM"
SHEET_TAB = "Sheet1"

def clean(value) -> str:
    return "" if value is None else str(value).strip()

def col_from_index(index: int) -> str:
    out = []
    n = index + 1
    while n:
        n, rem = divmod(n - 1, 26)
        out.append(chr(65 + rem))
    return "".join(reversed(out))

def fetch_access_token_from_refresh() -> str:
    client_id = clean(os.getenv("GOOGLE_OAUTH_CLIENT_ID"))
    client_secret = clean(os.getenv("GOOGLE_OAUTH_CLIENT_SECRET"))
    refresh_token = clean(os.getenv("GOOGLE_OAUTH_REFRESH_TOKEN"))
    if not (client_id and client_secret and refresh_token):
        return ""

    token_url = "https://oauth2.googleapis.com/token"
    body = urllib.parse.urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode("utf-8")
    req = urllib.request.Request(url=token_url, data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json.loads(resp.read().decode("utf-8", errors="replace"))
            return clean(payload.get("access_token"))
    except Exception:
        return ""

def api_request(token: str, method: str, url: str, payload: dict | None = None) -> dict:
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
    except Exception as e:
        return {}

def main():
    if not INPUT_PATH.exists():
        print("No scrape results found.")
        return

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        results = json.load(f)

    if not results:
        print("Scrape results empty.")
        return

    print("Loading Excel workbook...")
    workbook = load_workbook(EXCEL_PATH)
    worksheet = workbook[SHEET_TAB]

    header_row = next(worksheet.iter_rows(min_row=1, max_row=1, values_only=True))
    headers = [clean(v) for v in header_row]

    if "Permanently Closed" not in headers:
        # Add the header
        max_col = worksheet.max_column
        worksheet.cell(row=1, column=max_col + 1, value="Permanently Closed")
        headers.append("Permanently Closed")

    closed_idx = headers.index("Permanently Closed")
    image_idx = headers.index("Image URL") if "Image URL" in headers else -1

    update_cells = []

    for res in results:
        row_idx = res["row_index"]
        is_closed = res.get("isClosed", "No")
        image_url = res.get("imageUrl", "")

        # Write to Excel
        worksheet.cell(row=row_idx, column=closed_idx + 1, value=is_closed)
        update_cells.append({
            "range": f"{SHEET_TAB}!{col_from_index(closed_idx)}{row_idx}",
            "value": is_closed
        })

        if image_url and image_idx != -1:
            worksheet.cell(row=row_idx, column=image_idx + 1, value=image_url)
            update_cells.append({
                "range": f"{SHEET_TAB}!{col_from_index(image_idx)}{row_idx}",
                "value": image_url
            })

    print("Saving Excel file...")
    workbook.save(EXCEL_PATH)

    # Update Google Sheets
    token = clean(os.getenv("GOOGLE_SHEETS_ACCESS_TOKEN"))
    token = fetch_access_token_from_refresh() or token
    if not token:
        print("Missing GOOGLE_SHEETS_ACCESS_TOKEN, skipping Google Sheets update.")
        return

    if update_cells:
        update_payload = {
            "valueInputOption": "RAW",
            "data": [{"range": item["range"], "majorDimension": "ROWS", "values": [[item["value"]]]} for item in update_cells],
        }
        update_url = f"https://sheets.googleapis.com/v4/spreadsheets/{SHEET_ID}/values:batchUpdate"
        print("Updating Google Sheets...")
        api_request(token, "POST", update_url, update_payload)
        print("Successfully updated Google Sheets.")

if __name__ == "__main__":
    main()
