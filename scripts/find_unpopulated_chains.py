import openpyxl

WB_PATH = 'outputs/01a17680-a363-77e1-bf29-8b3dd917e8b8/Hungry_Menu_and_Food_Directory_0A_filled_checked_plus_new_stalls_2026-11-04.xlsx'
wb = openpyxl.load_workbook(WB_PATH, read_only=True)
ws_fd = wb['Food Directory']
header = [str(c or '').strip() for c in next(ws_fd.iter_rows(min_row=1, max_row=1, values_only=True))]
fnb_idx = header.index('F&B Name')
lic_idx = header.index('SFA Licence')
addr_idx = header.index('Full Address')
post_idx = header.index('Postal Code')
cov_idx = header.index('Coverage Status')

fd_stalls = {}
for r_idx, r in enumerate(ws_fd.iter_rows(min_row=2, values_only=True), start=2):
    cov = str(r[cov_idx] or '')
    if '[QUARANTINED' in cov or '[DUPLICATE' in cov:
        continue
    lic = str(r[lic_idx] or '').strip()
    if lic:
        fd_stalls[lic] = (r_idx, str(r[fnb_idx] or '').strip(), str(r[addr_idx] or '').strip(), str(r[post_idx] or '').strip())

ws_mp = wb['Menu & Price']
mp_header = [str(c or '').strip() for c in next(ws_mp.iter_rows(min_row=1, max_row=1, values_only=True))]
m_lic_idx = mp_header.index('SFA Licence')
menu_lics = set(str(r[m_lic_idx] or '').strip() for r in ws_mp.iter_rows(min_row=2, values_only=True))

unpopulated_lics = set(fd_stalls.keys()) - menu_lics
print(f"Total unpopulated active licensed stalls: {len(unpopulated_lics)}")

target_chains = ["sushi express", "liho", "chatterbox", "ya kun", "domino", "jollibee", "burger king", "haidilao", "pepper lunch", "koi"]

for lic in sorted(unpopulated_lics):
    row_idx, name, addr, postal = fd_stalls[lic]
    name_l = name.lower()
    for ch in target_chains:
        if ch in name_l:
            print(f"{ch.upper():14s} | Row {row_idx:5d} | {lic:12s} | {name} | {addr} ({postal})")
