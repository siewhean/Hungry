#!/usr/bin/env python3
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

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

def normalize_name(name: str) -> str:
    if not name:
        return ""
    import re
    text = str(name).strip().lower()
    text = text.replace("&", " and ")
    text = re.sub(r"\([^)]*\)", " ", text)
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()

def similarity(left: str, right: str) -> float:
    left_clean = normalize_name(left)
    right_clean = normalize_name(right)
    if not left_clean or not right_clean:
        return 0.0
    if left_clean == right_clean:
        return 1.0
    if left_clean in right_clean or right_clean in left_clean:
        return 0.95
    return SequenceMatcher(a=left_clean, b=right_clean).ratio()

def query_overpass_api(lat: float, lon: float, radius: int = 150) -> list[dict]:
    # Query all nodes, ways, and relations within `radius` meters that have a name tag.
    # We don't restrict by amenity because hawker stalls might be tagged as shop or something else.
    query = f"""
    [out:json][timeout:25];
    (
      node["name"](around:{radius},{lat},{lon});
      way["name"](around:{radius},{lat},{lon});
      relation["name"](around:{radius},{lat},{lon});
    );
    out center tags;
    """
    
    url = "https://overpass-api.de/api/interpreter"
    data = query.encode("utf-8")
    req = urllib.request.Request(url, data=data, method="POST")
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            result = json.loads(raw)
            return result.get("elements", [])
    except Exception as e:
        print(f"Overpass API error for {lat},{lon}: {e}")
        return []

def main():
    load_env()
    supabase_url = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")
    
    if not supabase_url or not supabase_key:
        print("Missing Supabase credentials in .env")
        sys.exit(1)

    print("Fetching 50 restaurant venues from Supabase...")
    venues = fetch_venues_from_supabase(supabase_url, supabase_key, limit=50)
    print(f"Fetched {len(venues)} venues.")
    
    report = []
    success_count = 0
    
    # Overpass API requires us to be nice, sleep between requests
    # Limit to ~1-2 requests per second
    
    for idx, v in enumerate(venues):
        vid = v.get("id")
        name = v.get("name", "")
        b = v.get("buildings", {})
        lat = b.get("latitude")
        lon = b.get("longitude")
        bname = b.get("name", "")
        
        if not lat or not lon:
            continue
            
        print(f"[{idx+1}/50] Querying OSM for '{name}' at {lat}, {lon}...")
        elements = query_overpass_api(lat, lon, radius=100)
        
        best_match = None
        best_score = 0.0
        
        for el in elements:
            tags = el.get("tags", {})
            osm_name = tags.get("name", "")
            
            score = similarity(name, osm_name)
            if score > best_score:
                best_score = score
                best_match = tags
                
        # Accept if similarity > 0.8 or if exact substring match
        if best_match and best_score > 0.8:
            success_count += 1
            print(f"  -> MATCH FOUND: '{best_match.get('name')}' (Score: {best_score:.2f})")
            
            enriched_data = {
                "venue_id": vid,
                "original_name": name,
                "osm_name": best_match.get("name"),
                "osm_opening_hours": best_match.get("opening_hours"),
                "osm_website": best_match.get("website") or best_match.get("contact:website"),
                "osm_phone": best_match.get("phone") or best_match.get("contact:phone"),
                "osm_instagram": best_match.get("contact:instagram"),
                "osm_facebook": best_match.get("contact:facebook"),
                "osm_cuisine": best_match.get("cuisine"),
                "match_score": best_score
            }
            report.append(enriched_data)
        else:
            print(f"  -> No high-confidence match found. Best was score {best_score:.2f}")
            
        time.sleep(1.0) # Be nice to Overpass API
        
    output_file = "pilot_osm_results.json"
    with open(output_file, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    print(f"\nOSM Enrichment pilot complete. Successfully matched {success_count} out of {len(venues)} venues.")
    print(f"Results saved to {output_file}")

if __name__ == "__main__":
    main()
