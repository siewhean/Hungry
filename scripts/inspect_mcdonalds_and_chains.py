import openpyxl
from collections import Counter

WB_PATH = 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx'
wb = openpyxl.load_workbook(WB_PATH, read_only=True)
ws_mp = wb['Menu & Price']
header = [str(c or '').strip() for c in next(ws_mp.iter_rows(min_row=1, max_row=1, values_only=True))]
vname_idx = header.index('F&B Venue Name')
lic_idx = header.index('SFA Licence')
dname_idx = header.index('Menu Item / Dish Name')
price_idx = header.index('Price (SGD)')
post_idx = header.index('Postal Code')

mcd_lics = Counter()
mcd_rows = 0
prices_by_lic = {}
dish_samples = {}

for r in ws_mp.iter_rows(min_row=2, values_only=True):
    vname = str(r[vname_idx] or '')
    if 'mcdonald' in vname.lower():
        mcd_rows += 1
        lic = str(r[lic_idx] or '')
        mcd_lics[lic] += 1
        p = r[price_idx]
        dname = str(r[dname_idx] or '')
        if lic not in prices_by_lic:
            prices_by_lic[lic] = []
        if p is not None:
            try:
                prices_by_lic[lic].append(float(p))
            except:
                pass
        if dname not in dish_samples:
            dish_samples[dname] = p

print(f"Total McDonald's menu rows in Menu & Price: {mcd_rows}")
print(f"Distinct McDonald's licences represented: {len(mcd_lics)}")
print("Sample dish names & prices across McDonald's:")
for d, p in list(dish_samples.items())[:10]:
    print(f"  {d}: {p}")

print("\nPrice variance across licences:")
for lic in list(mcd_lics.keys())[:8]:
    p_list = prices_by_lic.get(lic, [])
    if p_list:
        print(f"  Licence {lic}: {len(p_list)} dishes, min=${min(p_list):.2f}, max=${max(p_list):.2f}, avg=${sum(p_list)/len(p_list):.2f}")
