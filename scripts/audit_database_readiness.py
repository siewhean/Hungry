import openpyxl
from collections import Counter

WB_PATH = "outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx"
print(f"Loading {WB_PATH} in read-only mode...")
wb = openpyxl.load_workbook(WB_PATH, read_only=True)

# 1. Audit Food Directory
ws_fd = wb["Food Directory"]
fd_headers = [str(c or "").strip() for c in next(ws_fd.iter_rows(min_row=1, max_row=1, values_only=True))]
fnb_idx = fd_headers.index("F&B Name")
lic_idx = fd_headers.index("SFA Licence")
addr_idx = fd_headers.index("Full Address")
post_idx = fd_headers.index("Postal Code")
cuisine_idx = fd_headers.index("Cuisine")
cov_idx = fd_headers.index("Coverage Status")

fd_stalls = {}
fd_stalls_by_lic = {}
unlicensed_stalls = 0
quarantined_stalls = 0

for r_idx, r in enumerate(ws_fd.iter_rows(min_row=2, values_only=True), start=2):
    fnb = str(r[fnb_idx] or "").strip()
    lic = str(r[lic_idx] or "").strip()
    cov = str(r[cov_idx] or "")
    if "[QUARANTINED" in cov or "[DUPLICATE" in cov:
        quarantined_stalls += 1
        continue
    if not lic:
        unlicensed_stalls += 1
    else:
        fd_stalls_by_lic[lic] = {
            "row": r_idx,
            "name": fnb,
            "addr": str(r[addr_idx] or "").strip(),
            "postal": str(r[post_idx] or "").strip(),
            "cuisine": str(r[cuisine_idx] or "").strip()
        }

print(f"Total active licensed stalls in Food Directory: {len(fd_stalls_by_lic)}")
print(f"Unlicensed active stalls: {unlicensed_stalls}")
print(f"Quarantined/duplicate stalls: {quarantined_stalls}")

# 2. Audit Menu & Price
ws_mp = wb["Menu & Price"]
mp_headers = [str(c or "").strip() for c in next(ws_mp.iter_rows(min_row=1, max_row=1, values_only=True))]
vname_idx = mp_headers.index("F&B Venue Name")
m_lic_idx = mp_headers.index("SFA Licence")
dname_idx = mp_headers.index("Menu Item / Dish Name")
cat_idx = mp_headers.index("Category / Section")
p_idx = mp_headers.index("Price (SGD)")
desc_idx = mp_headers.index("Description / Notes")
img_idx = mp_headers.index("Dish Image URL")
src_idx = mp_headers.index("Menu Source URL")

menu_lics = Counter()
total_dishes = 0
unpriced_dishes = 0
missing_img = 0
missing_cat = 0
missing_src = 0
quarantined_dishes = 0

for r in ws_mp.iter_rows(min_row=2, values_only=True):
    total_dishes += 1
    lic = str(r[m_lic_idx] or "").strip()
    p = r[p_idx]
    cat = str(r[cat_idx] or "").strip()
    img = str(r[img_idx] or "").strip()
    src = str(r[src_idx] or "").strip()
    desc = str(r[desc_idx] or "")
    
    if "[QUARANTINED" in desc:
        quarantined_dishes += 1
        continue
        
    if lic:
        menu_lics[lic] += 1
    if p is None or str(p).strip() == "":
        unpriced_dishes += 1
    if not cat:
        missing_cat += 1
    if not img:
        missing_img += 1
    if not src:
        missing_src += 1

print(f"\nTotal dishes in Menu & Price: {total_dishes}")
print(f"Quarantined dishes: {quarantined_dishes}")
print(f"Active dishes: {total_dishes - quarantined_dishes}")
print(f"Distinct licensed stalls with menu in Menu & Price: {len(menu_lics)}")
print(f"Dishes missing price: {unpriced_dishes}")
print(f"Dishes missing category: {missing_cat}")
print(f"Dishes missing image URL: {missing_img}")
print(f"Dishes missing source URL: {missing_src}")

# 3. Compare Stalls in Directory vs Stalls with Menus
unpopulated_lics = set(fd_stalls_by_lic.keys()) - set(menu_lics.keys())
print(f"\nLicensed stalls in Food Directory with NO menu yet: {len(unpopulated_lics)}")

# Sample unpopulated stalls by brand / type
chain_keywords = ["mcdonald", "kfc", "subway", "toast box", "ya kun", "starbucks", "burger king", "old chang kee", "jollibee", "mos burger", "din tai fung", "pepper lunch", "genki sushi", "boon tong kee", "liho", "koi", "swensen", "tim ho wan", "mr bean", "sanook", "encik tan", "pastamania", "popeyes", "long john silver", "sushi express", "dian xiao er", "crave", "astons", "swee choon", "breadtalk", "pizza hut", "domino", "canton paradise", "crystal jade", "haidilao", "song fa", "chatterbox", "jumbo seafood"]

unpopulated_by_chain = Counter()
unpopulated_hawkers = []

for lic in unpopulated_lics:
    info = fd_stalls_by_lic[lic]
    name_l = info["name"].lower()
    matched = False
    for ck in chain_keywords:
        if ck in name_l:
            unpopulated_by_chain[ck] += 1
            matched = True
            break
    if not matched:
        unpopulated_hawkers.append((lic, info["name"], info["addr"], info["postal"]))

print("\nUnpopulated licensed stalls by major chain:")
for ch, cnt in unpopulated_by_chain.most_common(20):
    print(f"  {ch:20s}: {cnt}")

print(f"\nUnpopulated independent / hawker / local stalls: {len(unpopulated_hawkers)}")
print("Sample 10 unpopulated hawker/local stalls:")
for s in unpopulated_hawkers[:10]:
    print(f"  [{s[0]}] {s[1]} | {s[2]} ({s[3]})")
