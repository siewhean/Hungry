import pandas as pd
import json
import os
from pathlib import Path

# Paths
EXCEL_PATH = "data/Hungry F&B Database.xlsx"
MALLS_JSON = "data/malls/all_fnb.json"
OSM_JSON = "data/osm/singapore_fnb_osm.json"
HAWKERS_JSON = "data/hawker_centres.json"
SUPABASE_JSON = "data/supabase_venues.json"

def main():
    print("Loading existing Excel database...")
    if os.path.exists(EXCEL_PATH):
        df_master = pd.read_excel(EXCEL_PATH)
    else:
        print(f"Error: {EXCEL_PATH} not found!")
        return

    # Create a set for deduplication by Name
    existing_names = set(df_master['Stall / Restaurant Name'].dropna().str.lower().str.strip())
    
    new_rows = []

    # 1. Load Supabase
    if os.path.exists(SUPABASE_JSON):
        with open(SUPABASE_JSON, 'r') as f:
            supabase_data = json.load(f)
            for item in supabase_data:
                name = item.get('name', '')
                if not name:
                    continue
                if name.lower().strip() not in existing_names:
                    new_rows.append({
                        'Stall / Restaurant Name': name,
                        'Source Type': 'Supabase',
                        'Address': item.get('address', ''),
                        'Coverage Status': 'Active'
                    })
                    existing_names.add(name.lower().strip())
        print(f"Added new records from Supabase. Current new rows: {len(new_rows)}")

    # 2. Load Malls
    if os.path.exists(MALLS_JSON):
        with open(MALLS_JSON, 'r') as f:
            malls_data = json.load(f)
            for item in malls_data:
                name = item.get('stall_name', '')
                if not name:
                    continue
                if name.lower().strip() not in existing_names:
                    new_rows.append({
                        'Stall / Restaurant Name': name,
                        'Source Type': 'Mall Scraper',
                        'Hawker Centre / Building': item.get('building', ''),
                        'Coverage Status': 'Active'
                    })
                    existing_names.add(name.lower().strip())
        print(f"Added new records from Malls. Current new rows: {len(new_rows)}")

    # 3. Load OSM
    if os.path.exists(OSM_JSON):
        with open(OSM_JSON, 'r') as f:
            osm_data = json.load(f)
            for item in osm_data:
                name = item.get('name', '')
                if not name:
                    continue
                if name.lower().strip() not in existing_names:
                    address = f"{item.get('housenumber', '')} {item.get('street', '')}".strip()
                    new_rows.append({
                        'Stall / Restaurant Name': name,
                        'Source Type': 'OSM',
                        'Address': address,
                        'Latitude': item.get('latitude', ''),
                        'Longitude': item.get('longitude', ''),
                        'Coverage Status': 'Active'
                    })
                    existing_names.add(name.lower().strip())
        print(f"Added new records from OSM. Current new rows: {len(new_rows)}")

    # 4. Load Hawkers
    if os.path.exists(HAWKERS_JSON):
        with open(HAWKERS_JSON, 'r') as f:
            hawkers_data = json.load(f)
            for item in hawkers_data:
                name = item.get('name', '')
                if not name:
                    continue
                if name.lower().strip() not in existing_names:
                    new_rows.append({
                        'Stall / Restaurant Name': name,
                        'Source Type': 'Data.gov.sg',
                        'Hawker Centre / Building': name,
                        'Address': item.get('address', ''),
                        'Coverage Status': 'Active'
                    })
                    existing_names.add(name.lower().strip())
        print(f"Added new records from Hawkers. Current new rows: {len(new_rows)}")

    if new_rows:
        df_new = pd.DataFrame(new_rows)
        df_combined = pd.concat([df_master, df_new], ignore_index=True)
        print(f"Total rows before: {len(df_master)}, after: {len(df_combined)}")
        print("Saving to Excel...")
        df_combined.to_excel(EXCEL_PATH, index=False, engine='xlsxwriter')
        print("Success!")
    else:
        print("No new unique records found to add.")

if __name__ == "__main__":
    main()
