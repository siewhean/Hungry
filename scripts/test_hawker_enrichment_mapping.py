import csv, re

def extract_stall_num(text):
    m = re.search(r"#?0?([1-3])-0?(\d+)", text)
    if m:
        return (int(m.group(1)), int(m.group(2)))
    m2 = re.search(r"KADAYANALLUR STREET 0?(\d+)", text)
    if m2:
        return (1, int(m2.group(1)))
    m3 = re.search(r"#0?(\d+)", text)
    if m3:
        return (1, int(m3.group(1)))
    return None

with open("data/Hungry_Database_Food_Only_2026-10-21.csv", mode="r", encoding="utf-8-sig") as f:
    db = list(csv.DictReader(f))

# Index db by (Postal, Unit)
by_post_unit = {}
for r in db:
    p = r["Postal Code"].strip().zfill(6)
    u = extract_stall_num(r["Full Address"])
    if p and u:
        by_post_unit[(p, u)] = r

print(f"Total indexed (Postal, Unit) combinations in DB: {len(by_post_unit)}")
