import pandas as pd
import json
import os
import requests

# Paths
EXCEL_PATH = "data/Hungry F&B Database.xlsx"

from dotenv import load_dotenv
load_dotenv('.env.local')

SUPABASE_URL = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Supabase credentials not found in .env.local")
    exit(1)

def main():
    print("Loading Excel database for Supabase sync...")
    if not os.path.exists(EXCEL_PATH):
        print(f"Error: {EXCEL_PATH} not found!")
        return

    df = pd.read_excel(EXCEL_PATH)
    # Filter rows with actual names
    df = df[df['Stall / Restaurant Name'].notna()]
    
    # We will bulk upsert
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }

    endpoint = f"{SUPABASE_URL}/rest/v1/venues"

    records = []
    for _, row in df.iterrows():
        # Clean data types
        name = str(row['Stall / Restaurant Name']).strip()
        if not name or name == 'nan':
            continue
            
        record = {
            "name": name,
            "building": str(row.get('Hawker Centre / Building', '')).strip() if pd.notna(row.get('Hawker Centre / Building')) else None,
            "address": str(row.get('Address', '')).strip() if pd.notna(row.get('Address')) else None,
            "status": str(row.get('Coverage Status', '')).strip() if pd.notna(row.get('Coverage Status')) else None,
        }
        
        if 'Latitude' in row and pd.notna(row['Latitude']):
            try:
                record['latitude'] = float(row['Latitude'])
            except:
                pass
        if 'Longitude' in row and pd.notna(row['Longitude']):
            try:
                record['longitude'] = float(row['Longitude'])
            except:
                pass
                
        records.append(record)

    batch_size = 1000
    total = len(records)
    print(f"Total records to sync: {total}")

    for i in range(0, total, batch_size):
        batch = records[i:i+batch_size]
        res = requests.post(endpoint, headers=headers, json=batch)
        if res.status_code not in (200, 201):
            print(f"Error on batch {i}: {res.status_code} {res.text}")
        else:
            print(f"Successfully synced batch {i} to {i+len(batch)}")

    print("Sync complete!")

if __name__ == "__main__":
    main()
