import pandas as pd
import json
import os

EXCEL_PATH = "data/Hungry F&B Database.xlsx"
RESULTS_PATH = "data/fallback_enrichment_results.json"
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

    updates = 0

    df['Menu'] = df['Menu'].astype(object)
    df['Dishes Image URL'] = df.get('Dishes Image URL', pd.Series(dtype=object)).astype(object)
    df['Menu Source'] = df.get('Menu Source', pd.Series(dtype=object)).astype(object)

    for item in results:
        if item and item.get('dishes'):
            idx = item['index']
            dishes = item['dishes']
            menu_str = json.dumps(dishes, ensure_ascii=False)

            img_url = ""
            for dish in dishes:
                if dish.get('image'):
                    img_url = dish['image']
                    break

            # Use iloc if index matches physical rows, or loc if the index was preserved
            # Note: filter_missing_menus.py saved the dataframe's physical index.
            df.at[idx, 'Menu'] = menu_str
            df.at[idx, 'Dishes Image URL'] = img_url
            df.at[idx, 'Menu Source'] = item.get('source', 'Fallback Scraper')
            updates += 1

    print(f"Applied {updates} menus to the database.")

    if updates > 0:
        print("Saving to Excel...")
        df.to_excel(OUTPUT_PATH, index=False, engine="xlsxwriter")
        print("Done!")

if __name__ == "__main__":
    main()
