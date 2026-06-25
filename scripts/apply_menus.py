import pandas as pd
import json
import os

EXCEL_PATH = "data/Hungry F&B Database.xlsx"
RESULTS_PATH = "data/menu_enrichment_results.json"
OUTPUT_PATH = "data/Hungry F&B Database.xlsx"

def main():
    if not os.path.exists(RESULTS_PATH):
        print(f"Results not found at {RESULTS_PATH}")
        return

    print("Loading Excel database...")
    df = pd.read_excel(EXCEL_PATH, engine="openpyxl")
    
    print("Loading enrichment results...")
    with open(RESULTS_PATH, 'r') as f:
        results = json.load(f)

    # Build map
    updates = 0
    res_map = {item['uri']: item for item in results}

    df['Menu'] = df['Menu'].astype(object)
    df['Dishes Image URL'] = df.get('Dishes Image URL', pd.Series(dtype=object)).astype(object)
    df['Menu Source'] = df.get('Menu Source', pd.Series(dtype=object)).astype(object)

    for idx, row in df.iterrows():
        uri = f"row-{idx}"
        res = res_map.get(uri)
        if res and res.get('dishes'):
            # Format the dishes into JSON strings
            dishes = res['dishes']
            menu_str = json.dumps(dishes, ensure_ascii=False)
            
            # Find an image URL if available
            img_url = ""
            for dish in dishes:
                if dish.get('imageUrl'):
                    img_url = dish['imageUrl']
                    break
            
            df.at[idx, 'Menu'] = menu_str
            df.at[idx, 'Dishes Image URL'] = img_url
            df.at[idx, 'Menu Source'] = res.get('source', 'GrabFood Scraper')
            updates += 1

    print(f"Applied {updates} menus to the database.")
    
    if updates > 0:
        print("Saving to Excel...")
        df.to_excel(OUTPUT_PATH, index=False, engine="xlsxwriter")
        print("Done!")

if __name__ == "__main__":
    main()
