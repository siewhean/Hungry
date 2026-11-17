import sys
from pathlib import Path
import math
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
EXCEL_PATH = ROOT / "data" / "Hungry F&B Database.xlsx"

# Singapore Planning Areas
AREAS = [
    ("Jurong East", 1.3331, 103.7437),
    ("Jurong West", 1.3404, 103.7066),
    ("Pioneer", 1.3376, 103.6974),
    ("Tampines", 1.3526, 103.9448),
    ("Bedok", 1.3236, 103.9273),
    ("Woodlands", 1.4382, 103.7891),
    ("Yishun", 1.4300, 103.8350),
    ("Ang Mo Kio", 1.3691, 103.8454),
    ("Hougang", 1.3612, 103.8863),
    ("Sengkang", 1.3868, 103.8914),
    ("Punggol", 1.3984, 103.9072),
    ("Bukit Batok", 1.3490, 103.7490),
    ("Clementi", 1.3150, 103.7650),
    ("Queenstown", 1.2943, 103.7861),
    ("Toa Payoh", 1.3343, 103.8470),
    ("Bishan", 1.3526, 103.8352),
    ("Novena", 1.3200, 103.8438),
    ("Bukit Timah", 1.3294, 103.8021),
    ("Orchard", 1.3048, 103.8318),
    ("Marina Bay", 1.2808, 103.8586),
    ("Chinatown", 1.2834, 103.8441),
    ("Little India", 1.3066, 103.8518),
    ("Geylang", 1.3135, 103.8896),
    ("Kallang", 1.3111, 103.8728),
    ("Pasir Ris", 1.3721, 103.9490),
    ("Serangoon", 1.3496, 103.8729),
    ("Buona Vista", 1.3070, 103.7900),
    ("Commonwealth", 1.3027, 103.7985),
    ("Harbourfront", 1.2651, 103.8219),
    ("Changi", 1.3644, 103.9915),
    ("Lim Chu Kang", 1.4200, 103.7100)
]

def haversine_distance(lat1, lon1, lat2, lon2):
    # Radius of the Earth in km
    R = 6371.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c

def get_closest_area(lat, lon):
    if lat is None or lon is None:
        return "Chinatown" # Safe default fallback

    min_dist = float('inf')
    closest_area = "Chinatown"

    for area_name, a_lat, a_lon in AREAS:
        dist = haversine_distance(lat, lon, a_lat, a_lon)
        if dist < min_dist:
            min_dist = dist
            closest_area = area_name

    return closest_area

def main():
    print(f"Loading Excel file: {EXCEL_PATH}...")
    wb = load_workbook(EXCEL_PATH)
    ws = wb.active

    # Read headers
    headers = [cell.value for cell in ws[1]]

    # Check if "Area" column exists
    if "Area" in headers:
        area_col_idx = headers.index("Area") + 1
        print("Column 'Area' already exists. We will populate/overwrite values.")
    else:
        # Append "Area" at the end
        ws.cell(row=1, column=len(headers) + 1, value="Area")
        area_col_idx = len(headers) + 1
        headers.append("Area")
        print("Created column 'Area'.")

    lat_col_idx = headers.index("Latitude") + 1
    lon_col_idx = headers.index("Longitude") + 1

    row_count = ws.max_row
    print(f"Processing {row_count - 1} rows...")

    updated_count = 0
    for r in range(2, row_count + 1):
        lat_val = ws.cell(row=r, column=lat_col_idx).value
        lon_val = ws.cell(row=r, column=lon_col_idx).value

        try:
            lat = float(lat_val) if lat_val is not None else None
            lon = float(lon_val) if lon_val is not None else None
        except ValueError:
            lat = None
            lon = None

        closest_area = get_closest_area(lat, lon)
        ws.cell(row=r, column=area_col_idx, value=closest_area)
        updated_count += 1

    print(f"Populated nearest area for {updated_count} rows.")

    print("Saving Excel file...")
    wb.save(EXCEL_PATH)
    print("Done!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
