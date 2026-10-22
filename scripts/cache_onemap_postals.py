import urllib.request, ssl, json, time, openpyxl, os

wb = openpyxl.load_workbook('data/Hungry F&B Database.Public Access 2026-10-19 Verified Menu Catalogue Enriched.xlsx', read_only=True)
ws = wb['Public F&B Directory']

cache_file = 'data/source_snapshots/onemap_postal_cache_20261019.json'
cache = {}
if os.path.exists(cache_file):
    try:
        with open(cache_file) as f:
            cache = json.load(f)
    except Exception:
        cache = {}

missing_postals = set()
for r in ws.iter_rows(values_only=True):
    if not r[14]: # Latitude is blank
        p = str(r[13] or '').strip().zfill(6)
        if len(p) == 6 and p.isdigit() and p != '000000' and p not in cache:
            missing_postals.add(p)

print(f"Missing postal codes needing OneMap lookup: {len(missing_postals)}")
ctx = ssl._create_unverified_context()

count = 0
for p in sorted(missing_postals):
    count += 1
    url = f'https://www.onemap.gov.sg/api/common/elastic/search?searchVal={p}&returnGeom=Y&getAddrDetails=Y&pageNum=1'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    
    success = False
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=8, context=ctx) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                if data.get('results'):
                    res = data['results'][0]
                    cache[p] = {
                        'latitude': float(res['LATITUDE']),
                        'longitude': float(res['LONGITUDE']),
                        'building': res.get('BUILDING', ''),
                        'road': res.get('ROAD_NAME', ''),
                        'source': 'Singapore Land Authority OneMap'
                    }
                    print(f"[{count}/{len(missing_postals)}] {p} -> {res.get('BUILDING', '')} ({res['LATITUDE']}, {res['LONGITUDE']})")
                else:
                    cache[p] = None
                    print(f"[{count}/{len(missing_postals)}] {p} -> No SLA results found")
                success = True
                break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 2.0 * (attempt + 1)
                time.sleep(wait)
            else:
                break
        except Exception:
            time.sleep(1.0)
    
    time.sleep(0.8) # Polite delay between requests to stay below rate limit

with open(cache_file, 'w') as f:
    json.dump(cache, f, indent=2)

print(f"Completed! Total cached postal codes: {len(cache)}")
