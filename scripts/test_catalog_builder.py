import os
import glob
import re
import json

md_files = glob.glob('data/crawls/pass25_firecrawl_scrapes/*.md')

def parse_md_menu(path):
    with open(path, encoding='utf-8') as f:
        content = f.read()
    lines = content.split('\n')
    current_cat = 'Main Course'
    items = []
    seen = set()
    for line in lines:
        line_s = line.strip()
        if line_s.startswith('### ') or line_s.startswith('## '):
            cat_cand = line_s.lstrip('#').strip().replace('*', '')
            if not any(skip in cat_cand.lower() for skip in ['promotions', 'faq', 'review', 'about', 'hours', 'locations']):
                current_cat = cat_cand
            continue
        if line_s.startswith('|') and line_s.endswith('|'):
            parts = [p.strip() for p in line_s[1:-1].split('|')]
            if len(parts) >= 2:
                if any(x in parts[0].lower() for x in ['item', 'dish', 'menu', 'name', '---']):
                    continue
                name = parts[0]
                name = re.sub(r'^[A-Z0-9]+\.\s*', '', name).strip()
                name = re.sub(r'\s*\([^)]*\)$', '', name).strip()
                if not name or len(name) < 2 or name.lower() in seen:
                    continue
                price_str = None
                desc = ''
                if len(parts) == 2:
                    price_str = parts[1]
                elif len(parts) >= 3:
                    for p in parts[1:]:
                        if any(c in p for c in ['S$', 'SGD', '$', 'from']) or re.search(r'\b\d+\.\d{2}\b', p):
                            price_str = p
                            break
                    for p in parts[1:]:
                        if p != price_str and len(p) > 3 and not re.search(r'^\d+$', p):
                            desc = p
                            break
                if price_str:
                    m = re.search(r'(\d+\.?\d*)', price_str.replace(',', ''))
                    if m:
                        try:
                            val = float(m.group(1))
                            if 0.8 <= val <= 180:
                                seen.add(name.lower())
                                items.append({'name': name, 'category': current_cat, 'price': val, 'desc': desc})
                        except:
                            pass
    return items

catalogs = {}
for f in md_files:
    slug = os.path.basename(f).replace('.md', '')
    items = parse_md_menu(f)
    if len(items) >= 5:
        catalogs[slug] = items

print(f'Constructed verified catalogs for {len(catalogs)} brands:')
for k in sorted(catalogs.keys())[:30]:
    prices = [x['price'] for x in catalogs[k]]
    print(f"  {k}: {len(catalogs[k])} items (range S${min(prices):.2f} - S${max(prices):.2f})")
