#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = REPO_ROOT / "data" / "singapore_food_businesses_canonical.csv"
HAWKER_PATH = REPO_ROOT / "data" / "hawker_centres.json"
ENV_FILES = [
    REPO_ROOT / ".env.local",
    REPO_ROOT / ".env",
    REPO_ROOT / ".env.development",
    REPO_ROOT / ".env.production",
]

DEFAULT_LAT = 1.3521
DEFAULT_LON = 103.8198


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_supabase_config() -> tuple[str, str]:
    env_values: dict[str, str] = {}
    for env_file in ENV_FILES:
        for key, value in parse_env_file(env_file).items():
            if value:
                env_values[key] = value

    supabase_url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL") or env_values.get("EXPO_PUBLIC_SUPABASE_URL")
    service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or env_values.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_role_key:
        raise RuntimeError(
            "Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment/.env files."
        )
    return supabase_url.rstrip("/"), service_role_key


def slugify(value: str) -> str:
    lowered = value.lower()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    lowered = re.sub(r"-+", "-", lowered).strip("-")
    return lowered or "unknown"


def sanitize_id(value: str, prefix: str) -> str:
    raw = slugify(value)
    result = f"{prefix}-{raw}"
    return result[:120]


def parse_float(value: str | None, default: float | None = None) -> float | None:
    if value is None:
        return default
    v = str(value).strip()
    if not v:
        return default
    try:
        return float(v)
    except ValueError:
        return default


def pick_hygiene(value: str | None) -> str:
    if not value:
        return "A"
    grade = value.strip().upper()
    return grade if grade in {"A", "B", "C", "D"} else "A"


def infer_floor(unit_no: str) -> str:
    if not unit_no:
        return "L1"
    match = re.search(r"#?0*([0-9]{1,2})-", unit_no)
    if match:
        return f"L{int(match.group(1))}"
    return "L1"


def postgrest_upsert(
    base_url: str,
    service_role_key: str,
    table: str,
    rows: list[dict[str, Any]],
    on_conflict: str,
) -> None:
    if not rows:
        return
    query = urllib.parse.urlencode({"on_conflict": on_conflict})
    url = f"{base_url}/rest/v1/{table}?{query}"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("apikey", service_role_key)
    req.add_header("Authorization", f"Bearer {service_role_key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "resolution=merge-duplicates,return=minimal")

    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            if response.status not in (200, 201, 204):
                raise RuntimeError(f"Unexpected response status {response.status} for table {table}")
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Upsert failed for table {table}: {exc.code} {details}") from exc


def chunked(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def build_hawker_buildings(hawkers: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, str]]:
    rows: list[dict[str, Any]] = []
    id_map: dict[str, str] = {}

    for hawker in hawkers:
        external_id = str(hawker.get("external_id", "")).strip()
        if not external_id:
            continue

        name = str(hawker.get("name", "")).strip()
        address = str(hawker.get("address") or "").strip()
        postal_code = str(hawker.get("postal_code") or "").strip()
        latitude = parse_float(str(hawker.get("latitude") or ""), DEFAULT_LAT)
        longitude = parse_float(str(hawker.get("longitude") or ""), DEFAULT_LON)

        building_id = f"rw-hc-{external_id}"
        id_map[external_id] = building_id

        rows.append(
            {
                "id": building_id,
                "slug": building_id,
                "name": name,
                "building_type": "hawker_centre",
                "latitude": latitude,
                "longitude": longitude,
                "floors": ["L1"],
                "venue_count": int(hawker.get("num_cooked_food_stalls") or 0),
                "is_closed_today": False,
                "hero_dish_id": None,
            }
        )

    return rows, id_map


def build_business_buildings_and_venues(
    csv_rows: list[dict[str, str]], max_business_rows: int
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    building_stats: dict[str, dict[str, Any]] = {}
    venues: list[dict[str, Any]] = []

    processed = 0
    for row in csv_rows:
        if processed >= max_business_rows:
            break

        business_id = (row.get("Business ID") or "").strip()
        stall_name = (row.get("Stall / Restaurant Name") or "").strip()
        if not business_id or not stall_name:
            continue

        building_name = (row.get("Building Name") or row.get("Hawker Centre / Building") or "").strip()
        address = (row.get("Address") or "").strip()
        postal_code = (row.get("Postal Code") or "").strip()
        location_key = (row.get("Location Key") or "").strip()

        building_identity = building_name or location_key or address or business_id
        building_suffix = postal_code if postal_code else business_id[-6:]
        building_id = sanitize_id(f"{building_identity}-{building_suffix}", "rw-bld")

        lat = parse_float(row.get("Latitude"), DEFAULT_LAT)
        lon = parse_float(row.get("Longitude"), DEFAULT_LON)

        if building_id not in building_stats:
            building_type = "food_court" if "food court" in (row.get("Stall Type") or "").lower() else "restaurant"
            building_stats[building_id] = {
                "id": building_id,
                "slug": building_id,
                "name": building_name or f"Location {building_suffix}",
                "building_type": building_type,
                "latitude": lat,
                "longitude": lon,
                "floors": ["L1"],
                "venue_count": 0,
                "is_closed_today": False,
                "hero_dish_id": None,
            }

        building_stats[building_id]["venue_count"] += 1

        unit_no = (row.get("Unit No.") or "").strip()
        opening_hours = (row.get("Opening Hours") or "").strip()

        venues.append(
            {
                "id": business_id,
                "building_id": building_id,
                "name": stall_name,
                "unit_number": unit_no,
                "floor": infer_floor(unit_no),
                "hygiene_grade": pick_hygiene(row.get("NEA Hygiene Grade")),
                "is_open": True,
                "top_dish_id": None,
                "operating_hours": opening_hours,
                "closure_notice": None,
                "live_crowd": None,
            }
        )
        processed += 1

    buildings = list(building_stats.values())
    return buildings, venues


def estimate_payload_bytes(rows: list[dict[str, Any]]) -> int:
    return len(json.dumps(rows, ensure_ascii=False).encode("utf-8"))


def run_import(batch_size: int, max_business_rows: int, sleep_ms: int, dry_run: bool) -> None:
    supabase_url, service_role_key = load_supabase_config()

    with HAWKER_PATH.open("r", encoding="utf-8") as fp:
        hawkers = json.load(fp)

    with CSV_PATH.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        csv_rows = list(reader)

    hawker_buildings, _ = build_hawker_buildings(hawkers)
    business_buildings, business_venues = build_business_buildings_and_venues(csv_rows, max_business_rows)

    all_buildings = {row["id"]: row for row in hawker_buildings}
    for row in business_buildings:
        all_buildings[row["id"]] = row
    building_rows = list(all_buildings.values())

    payload_bytes = estimate_payload_bytes(building_rows) + estimate_payload_bytes(business_venues)
    approx_mb = payload_bytes / (1024 * 1024)

    print(
        json.dumps(
            {
                "dry_run": dry_run,
                "hawker_rows": len(hawker_buildings),
                "business_venues_rows": len(business_venues),
                "building_rows": len(building_rows),
                "approx_payload_mb": round(approx_mb, 2),
                "free_tier_guardrail": "Lean fields only; no menu/raw blobs; payload capped via --max-business-rows.",
            },
            indent=2,
        )
    )

    if dry_run:
        return

    b_batches = chunked(building_rows, batch_size)
    v_batches = chunked(business_venues, batch_size)

    print(f"Upserting buildings in {len(b_batches)} batches...")
    for idx, batch in enumerate(b_batches, start=1):
        postgrest_upsert(supabase_url, service_role_key, "buildings", batch, "id")
        print(f"  buildings batch {idx}/{len(b_batches)} ok")
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000)

    print(f"Upserting venues in {len(v_batches)} batches...")
    for idx, batch in enumerate(v_batches, start=1):
        postgrest_upsert(supabase_url, service_role_key, "venues", batch, "id")
        print(f"  venues batch {idx}/{len(v_batches)} ok")
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000)

    print("Import completed.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Import real-world Singapore food data to Supabase.")
    parser.add_argument("--batch-size", type=int, default=500, help="Rows per REST upsert batch.")
    parser.add_argument(
        "--max-business-rows",
        type=int,
        default=32253,
        help="Safety cap for business rows to keep free-tier headroom.",
    )
    parser.add_argument("--sleep-ms", type=int, default=60, help="Pause between batches in ms.")
    parser.add_argument("--dry-run", action="store_true", help="Print counts and payload estimates only.")

    args = parser.parse_args()

    if args.max_business_rows <= 0:
        raise SystemExit("--max-business-rows must be > 0")

    # Keep headroom for future app/user data by default.
    if args.max_business_rows > 35000:
        raise SystemExit("Refusing max-business-rows > 35000 to preserve free-tier headroom.")

    run_import(
        batch_size=max(50, args.batch_size),
        max_business_rows=args.max_business_rows,
        sleep_ms=max(0, args.sleep_ms),
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # pragma: no cover
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
