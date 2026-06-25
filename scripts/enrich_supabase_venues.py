#!/usr/bin/env python3
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import google_places_sheet_enrich

def load_env():
    env_path = Path(".env.local")
    if not env_path.exists():
        env_path = Path(".env.development")
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

def fetch_venues_from_supabase(url: str, key: str, limit: int = 50) -> list[dict]:
    # Fetch venues joined with buildings where building_type = 'restaurant' and operating_hours is empty
    endpoint = f"{url}/rest/v1/venues?select=id,name,unit_number,buildings!inner(name,latitude,longitude)&buildings.building_type=eq.restaurant&operating_hours=eq.&limit={limit}"
    req = urllib.request.Request(endpoint, method="GET")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def insert_import_run(url: str, key: str, total_rows: int) -> str:
    endpoint = f"{url}/rest/v1/import_runs"
    payload = {
        "source_slug": "google_places",
        "source_type": "google_places",
        "total_rows": total_rows,
        "status": "completed"
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(endpoint, data=data, method="POST")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    req.add_header("Prefer", "return=representation")
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read().decode("utf-8"))
        return result[0]["id"]

def insert_observations(url: str, key: str, observations: list[dict]):
    if not observations:
        return
    endpoint = f"{url}/rest/v1/staging_google_places_observations"
    data = json.dumps(observations).encode("utf-8")
    req = urllib.request.Request(endpoint, data=data, method="POST")
    req.add_header("apikey", key)
    req.add_header("Authorization", f"Bearer {key}")
    req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req) as resp:
        resp.read()

import argparse

def main():
    parser = argparse.ArgumentParser(description="Enrich Supabase venues using Google Places API")
    parser.add_argument("--limit", type=int, default=3800, help="Max number of venues to fetch (default: 3800)")
    args = parser.parse_args()

    load_env()
    supabase_url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    maps_key = os.environ.get("GOOGLE_MAPS_ENRICHMENT_API_KEY")
    
    if not supabase_url or not supabase_key or not maps_key:
        print("Missing credentials.")
        sys.exit(1)

    print(f"Fetching venues from Supabase (limit {args.limit})...")
    # Safe limit: enriching ~3800 venues per month within $190 budget
    venues = fetch_venues_from_supabase(supabase_url, supabase_key, limit=args.limit)
    print(f"Fetched {len(venues)} venues.")
    if not venues:
        return
        
    rows = []
    for v in venues:
        b = v.get("buildings", {})
        rows.append({
            "Venue ID": v.get("id"),
            "Stall / Restaurant Name": v.get("name"),
            "Business Name Normalized": "",
            "Address": b.get("name", ""),
            "Postal Code": "",
            "Latitude": b.get("latitude"),
            "Longitude": b.get("longitude"),
            "Google Place ID": ""
        })
        
    payload = {
        "api_key": maps_key,
        "credit_ceiling_usd": 190.00,  # Hard limit to guarantee free-tier safety
        "credit_spend_so_far_usd": 0,
        "rate_limit_per_min": 240,
        "enable_place_id_matching": True,
        "enable_place_details": True,
        "enable_photo_metadata": True,
        "max_search_text_per_run": 3800,
        "max_details_per_run": 3800,
        "max_photo_meta_per_run": 3800,
        "start_row": 2,
        "rows": rows,
        "field_map": {},
    }
    
    print("Running Google Places enrichment...")
    result = google_places_sheet_enrich.run_passes(payload)
    
    updates = result.get("updates", [])
    updates_by_row = {}
    for upd in updates:
        r_idx = upd["row"] - 2
        if r_idx not in updates_by_row:
            updates_by_row[r_idx] = {}
        updates_by_row[r_idx][upd["col"]] = upd["value"]
        
    observations = []
    run_id = None
    
    for idx, row in enumerate(rows):
        upds = updates_by_row.get(idx, {})
        if upds and "AK" in upds:  # Place ID present
            if not run_id:
                # Create run_id lazily only if we have successful matches
                run_id = insert_import_run(supabase_url, supabase_key, len(venues))
                
            parsed = {
                "displayName": upds.get("AL"),
                "formattedAddress": upds.get("AM"),
                "primaryType": upds.get("AP"),
                "rating": upds.get("AR"),
                "userRatingCount": upds.get("AS"),
                "regularOpeningHours": upds.get("AT"),
                "priceLevel": upds.get("AU"),
                "websiteUri": upds.get("AV"),
                "photos": upds.get("AW")
            }
            observations.append({
                "import_run_id": run_id,
                "candidate_venue_id": row["Venue ID"],
                "google_place_id": upds.get("AK"),
                "parsed_payload": parsed,
                "raw_payload": parsed,
                "validation_status": "valid"
            })
            
    if observations:
        print(f"Staging {len(observations)} observations into Supabase...")
        # Chunk inserts to avoid large payload limits
        chunk_size = 50
        for i in range(0, len(observations), chunk_size):
            insert_observations(supabase_url, supabase_key, observations[i:i+chunk_size])
            
    print(f"Enrichment complete. Successfully staged {len(observations)} out of {len(venues)} venues.")
    print(f"Estimated spend: ${result.get('estimated_spend_usd', {}).get('Total', 0):.4f}")

if __name__ == "__main__":
    main()
