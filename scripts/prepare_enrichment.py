import pandas as pd
import json
import os

EXCEL_PATH = "data/Hungry F&B Database.xlsx"
OUTPUT_PATH = "data/stalls_to_enrich.json"

def main():
    print("Loading Excel...")
    df = pd.read_excel(EXCEL_PATH, engine="openpyxl")
    
    stalls = []
    for idx, row in df.iterrows():
        name = str(row.get('Stall / Restaurant Name', '')).strip()
        if not name or name == 'nan':
            continue
            
        building = str(row.get('Hawker Centre / Building', '')).strip()
        if building == 'nan': building = ""
        
        address = str(row.get('Address', '')).strip()
        if address == 'nan': address = ""
        
        menu = str(row.get('Menu', '')).strip()
        
        lat = row.get('Latitude', '')
        if pd.isna(lat): lat = ""
        lng = row.get('Longitude', '')
        if pd.isna(lng): lng = ""

        if menu == 'nan' or not menu or len(menu) < 10:
            stalls.append({
                "uri": f"row-{idx}",
                "stall_name": name,
                "building": building,
                "address": address,
                "latitude": lat,
                "longitude": lng
            })

    print(f"Total stalls missing menus: {len(stalls)}")
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(stalls, f, indent=2)
    print(f"Saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
