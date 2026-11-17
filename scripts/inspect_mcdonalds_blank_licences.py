import openpyxl

WB_PATH = 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx'
wb = openpyxl.load_workbook(WB_PATH, read_only=True)
ws_mp = wb['Menu & Price']
header = [str(c or '').strip() for c in next(ws_mp.iter_rows(min_row=1, max_row=1, values_only=True))]
vname_idx = header.index('F&B Venue Name')
lic_idx = header.index('SFA Licence')
price_idx = header.index('Price (SGD)')
dname_idx = header.index('Menu Item / Dish Name')
addr_idx = header.index('Address')
post_idx = header.index('Postal Code')

print("=== Blank Licence McDonald's rows ===")
for r in ws_mp.iter_rows(min_row=2, values_only=True):
    vname = str(r[vname_idx] or '')
    if 'mcdonald' in vname.lower():
        lic = str(r[lic_idx] or '').strip()
        if not lic:
            print(f"Venue: {vname} | Addr: {r[addr_idx]} | Postal: {r[post_idx]} | Dish: {r[dname_idx]} | Price: {r[price_idx]}")
