import pandas as pd
import json

def main():
    print("Loading database...")
    df = pd.read_excel('data/Hungry F&B Database.xlsx', dtype=object)

    # Identify stalls where 'Menu' is NaN or empty
    missing_menus = df[df['Menu'].isna() | (df['Menu'] == '')]
    print(f"Found {len(missing_menus)} stalls missing menus.")

    output = []
    for index, row in missing_menus.iterrows():
        stall_name = str(row['Stall / Restaurant Name']) if pd.notna(row['Stall / Restaurant Name']) else ''
        building = str(row['Building Name']) if pd.notna(row['Building Name']) else ''
        address = str(row['Address']) if pd.notna(row['Address']) else ''

        output.append({
            'index': index,
            'stall_name': stall_name,
            'building': building,
            'address': address
        })

    with open('data/stalls_to_fallback.json', 'w') as f:
        json.dump(output, f, indent=4)
    print("Saved to data/stalls_to_fallback.json")

if __name__ == "__main__":
    main()
