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

mcd_total = 0
mcd_none_price = 0
mcd_has_price = 0
lics_with_none = Counter()
lics_with_price = Counter()

for r in ws_mp.iter_rows(min_row=2, values_only=True):
    vname = str(r[vname_idx] or '')
    if 'mcdonald' in vname.lower():
        mcd_total += 1
        lic = str(r[lic_idx] or '')
        p = r[price_idx]
        if p is None or str(p).strip() == '':
            mcd_none_price += 1
            lics_with_none[lic] += 1
        else:
            mcd_has_price += 1
            lics_with_price[lic] += 1

print(f"McDonald's dishes total: {mcd_total}")
print(f"McDonald's dishes with valid price: {mcd_has_price}")
print(f"McDonald's dishes with None price: {mcd_none_price}")
print(f"Licences with all/some None prices: {len(lics_with_none)}")
print(f"Licences with populated prices: {len(lics_with_price)}")
