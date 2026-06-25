#!/usr/bin/env python3
import json
import os
import urllib.parse
import urllib.request
import sys
from pathlib import Path

# Add scripts directory to path to import google_places_sheet_enrich
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
        data = resp.read().decode("utf-8")
        return json.loads(data)

def main():
    load_env()
    
    supabase_url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    maps_key = os.environ.get("GOOGLE_MAPS_ENRICHMENT_API_KEY")
    
    if not supabase_url or not supabase_key:
        print("Missing Supabase credentials in .env")
        sys.exit(1)
        
    if not maps_key:
        print("Missing GOOGLE_MAPS_ENRICHMENT_API_KEY in .env")
        sys.exit(1)

    print("Fetching 50 restaurant venues with missing opening hours from Supabase...")
    venues = fetch_venues_from_supabase(supabase_url, supabase_key, limit=50)
    print(f"Fetched {len(venues)} venues.")
    
    if not venues:
        print("No venues found.")
        sys.exit(0)
        
    # Map to format expected by google_places_sheet_enrich
    rows = []
    for v in venues:
        b = v.get("buildings", {})
        row = {
            "Venue ID": v.get("id"),
            "Stall / Restaurant Name": v.get("name"),
            "Business Name Normalized": "",
            "Address": b.get("name", ""),
            "Postal Code": "",
            "Latitude": b.get("latitude"),
            "Longitude": b.get("longitude"),
            "Google Place ID": ""
        }
        rows.append(row)
        
    payload = {
        "api_key": maps_key,
        "credit_ceiling_usd": 10,  # Pilot budget
        "credit_spend_so_far_usd": 0,
        "rate_limit_per_min": 240,
        "enable_place_id_matching": True,
        "enable_place_details": True,
        "enable_photo_metadata": True,
        "max_search_text_per_run": 50,
        "max_details_per_run": 50,
        "max_photo_meta_per_run": 50,
        "start_row": 2,
        "rows": rows,
        "field_map": {},
    }
    
    print("Running Google Places enrichment...")
    result = google_places_sheet_enrich.run_passes(payload)
    
    # Process the updates back into a structured JSON report
    report = []
    updates = result.get("updates", [])
    
    # Group updates by row index
    updates_by_row = {}
    for upd in updates:
        r_idx = upd["row"] - 2
        if r_idx not in updates_by_row:
            updates_by_row[r_idx] = {}
        updates_by_row[r_idx][upd["col"]] = upd["value"]
        
    for idx, row in enumerate(rows):
        upds = updates_by_row.get(idx, {})
        if upds:
            enriched_data = {
                "venue_id": row["Venue ID"],
                "original_name": row["Stall / Restaurant Name"],
                "google_place_id": upds.get("AK"),
                "google_display_name": upds.get("AL"),
                "google_formatted_address": upds.get("AM"),
                "google_primary_type": upds.get("AP"),
                "google_rating": upds.get("AR"),
                "google_review_count": upds.get("AS"),
                "google_opening_hours": upds.get("AT"),
                "google_price_level": upds.get("AU"),
                "google_website_uri": upds.get("AV"),
                "google_photos_metadata": upds.get("AW")
            }
            report.append(enriched_data)
            
    output_file = "pilot_results.json"
    with open(output_file, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    print(f"Enrichment complete. Successfully enriched {len(report)} out of {len(venues)} venues.")
    print(f"Results saved to {output_file}")
    print(f"Estimated spend: ${result.get('estimated_spend_usd', {}).get('Total', 0):.4f}")

if __name__ == "__main__":
    main()
