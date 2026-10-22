import urllib.request
import urllib.parse
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# Query OpenStreetMap Overpass API for all McDonald's in Singapore with opening_hours
query = """
[out:json][timeout:25];
area["ISO3166-1"="SG"][admin_level=2]->.sg;
(
  node["name"~"McDonald",i](area.sg);
  way["name"~"McDonald",i](area.sg);
);
out center tags;
"""

url = "https://overpass-api.de/api/interpreter"
data = urllib.parse.urlencode({'data': query}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'User-Agent': 'HungryAppSG/1.0'})

try:
    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        elements = res.get('elements', [])
        print(f"Total McDonald's elements found in OSM: {len(elements)}")
        has_hours = 0
        for el in elements:
            tags = el.get('tags', {})
            oh = tags.get('opening_hours')
            name = tags.get('name')
            addr = tags.get('addr:street', '')
            post = tags.get('addr:postcode', '')
            if oh:
                has_hours += 1
                if has_hours <= 15:
                    print(f"  {name} | Postcode: {post} | St: {addr} | Hours: {oh}")
        print(f"Elements with opening_hours tag: {has_hours}")
except Exception as e:
    print("Error:", e)
