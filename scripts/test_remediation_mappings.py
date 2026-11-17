import openpyxl, re
from collections import defaultdict, Counter

wb_path = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
wb = openpyxl.load_workbook(wb_path, read_only=True)
ws_dir = wb["Food Directory"]
ws_menu = wb["Menu & Price"]

dir_lics = set()
dir_prefixes = defaultdict(list)
dir_by_name_postal = {}
dir_rows = {}

for i, r in enumerate(ws_dir.iter_rows(values_only=True)):
    if i == 0: continue
    lic = str(r[2]).strip() if r[2] else ""
    name = str(r[0]).strip().lower() if r[0] else ""
    postal = str(r[13]).strip() if r[13] else ""
    addr = str(r[12]).strip() if r[12] else ""
    if lic:
        dir_lics.add(lic)
        prefix = re.sub(r"\d{3}$", "", lic)
        dir_prefixes[prefix].append((lic, r[0], postal, addr))
        dir_by_name_postal[(name, postal)] = lic
        dir_rows[lic] = {"name": r[0], "postal": postal, "addr": addr}

print(f"Directory loaded: {len(dir_lics)} licences.")

# 1. Test Postal Typo Fixes in Directory
postal_typo_fixes = {
    "NW20R34L000": "750133", # Canberra Plaza 133 Canberra View
    "C84311B000": "600252",  # 252 Jurong East St 24
    "NW23I32E002": "762470", # 470B Yishun St 42
    "CE21071E000": "310085", # 85 Lor 4 Toa Payoh
    "CE22A60V000": "178905", # 13 Stamford Rd Capitol Piazza
    "SE25O97L000": "550304", # 304 Serangoon Ave 2
    "SW16E16A000": "680810", # 810 CCK Ave 7
    "C82221B001": "120722",  # 722 Clementi West St 2
    "E96072N000": "462029"   # 29B Chai Chee Ave
}

# 2. Test Branch Licence Remappings for Disjoint Licences
disjoint_branch_remaps = {
    "CE22F46X000": "CE24E72B000", # Ah Er Soup Kitchener Complex (808 French Rd #01-03)
    "S84185B005": "S84185B000",   # 21 Cafe Eunos Grove (631 Bedok Reservoir Rd #01-886)
    "B86036X008": "B86036X011"    # 167 Nasi Kukus (167 Woodlands St 11 #01-07)
}

# 3. Test Prefix & Renewal Remappings
prefix_remaps = {}
for i, r in enumerate(ws_menu.iter_rows(values_only=True)):
    if i == 0: continue
    lic = str(r[1]).strip() if r[1] else ""
    if not lic or lic in dir_lics: continue
    if ";" in lic or "," in lic: continue
    
    prefix = re.sub(r"\d{3}$", "", lic)
    if prefix in dir_prefixes:
        candidates = dir_prefixes[prefix]
        m_postal = str(r[3]).strip() if r[3] else ""
        # Match by postal
        matched = None
        for c_lic, c_name, c_postal, c_addr in candidates:
            if m_postal and c_postal and m_postal == c_postal:
                matched = c_lic
                break
        if not matched and len(candidates) == 1:
            matched = candidates[0][0]
        if matched:
            prefix_remaps[lic] = matched

print(f"Prefix remaps discovered: {len(prefix_remaps)}")
for k, v in list(prefix_remaps.items())[:10]:
    print(f"   {k} -> {v}")

# 4. Test Compound Remappings
compound_remaps = {
    "CE23L42A000; CE22F27X000": "CE23L42A000", # Drips Bakery Studio (71 Seng Poh Rd)
    "NW10303C000, SE25F72A000, W02041J000": "NW10303C000", # #87 Just Thai
    "CE09L13K000, CE09L13K002": "CE09L13K000",
    "SW18F23K000, SW18F23K002": "SW18F23K000",
    "CE21L34V000, CE21L34V002": "CE21L34V000",
    "NE17544L000, NE17544L002": "NE17544L000",
    "CE19J32X000, CE19J32X002": "CE19J32X000"
}
print(f"Compound remaps configured: {len(compound_remaps)}")
