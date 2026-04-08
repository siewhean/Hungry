"""
scrape_sitemap_malls.py
Scrapes F&B store data from mall sites that expose per-store pages via sitemap.
Targets: 313 Somerset, Parkway Parade, VivoCity

Approach:
  1. Pull store URLs from sitemap
  2. Fetch each store page concurrently (throttled)
  3. Parse unit number, floor, opening hours, category via structured text
  4. Filter to F&B only
  5. Output per-mall JSON + merged into data/malls/sitemap_malls_fnb.json
"""
from __future__ import annotations
import asyncio, html, json, logging, re
from pathlib import Path
from dataclasses import dataclass, asdict
import aiohttp
from bs4 import BeautifulSoup

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("sitemap")

OUT = Path("data/malls")
OUT.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 Chrome/124 Safari/537.36"
CONCURRENCY = 8   # concurrent page fetches per mall
TIMEOUT = aiohttp.ClientTimeout(total=20)

MALLS = [
    {
        "name": "313 Somerset",
        "sitemap": "https://www.313somerset.com.sg/sitemap.xml",
        "url_filter": lambda u: "/store-directory/" in u and u.count("/") >= 5,
        "base": "https://www.313somerset.com.sg",
        "parsers": {
            "unit": r"([A-Z]?\d{1,2}-\d{1,3}[A-Z]?)",          # L1-10
            "floor": r"[Ll]evel\s*(\d+)|[Bb]asement\s*(\d+)",
            "hours_section": "Opening Hours",
        },
        "fnb_keywords": ["food","restaurant","cafe","dining","beverage","bakery","dessert","bar","izakaya"],
    },
    {
        "name": "Parkway Parade",
        "sitemap": "https://www.parkwayparade.com.sg/sitemap.xml",
        "url_filter": lambda u: "/store-directory/" in u and u.count("/") >= 5,
        "base": "https://www.parkwayparade.com.sg",
        "parsers": {
            "unit": r"#(\d{1,2}-\d{1,3}[A-Z]?)",
            "floor": r"[Ll]evel\s*(\d+)|[Bb]asement\s*(\d+)",
            "hours_section": "Opening Hours",
        },
        "fnb_keywords": ["food","restaurant","cafe","dining","beverage","bakery","dessert","bar"],
    },
    {
        "name": "VivoCity",
        "sitemap": "https://www.vivocity.com.sg/store-sitemap.xml",
        "url_filter": lambda u: "/stores/" in u and u.count("/") >= 5,
        "base": "https://www.vivocity.com.sg",
        "parsers": {
            "unit": r"#(\d{1,2}-\d{1,3}[A-Z]?)",
            "floor": r"[Ll]evel\s*(\d+)|[Bb]asement\s*(\d+)",
            "hours_section": None,  # uses inline "Open Xam - Xpm daily"
        },
        "fnb_keywords": ["food","restaurant","cafe","dining","beverage","bakery","dessert","bar","hawker"],
    },
]


def get_sitemap_urls(xml: str, url_filter) -> list[str]:
    all_urls = re.findall(r"<loc>(https?://[^<]+)</loc>", xml)
    return [u for u in all_urls if url_filter(u)]


def parse_store_page(html_text: str, mall_cfg: dict, page_url: str) -> dict:
    soup = BeautifulSoup(html_text, "html.parser")
    text = soup.get_text(separator="\n", strip=True)
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    name = ""
    # Title tag or h1
    h1 = soup.find("h1")
    if h1:
        name = h1.get_text(strip=True)
    if not name:
        title = soup.find("title")
        if title:
            name = title.get_text(strip=True).split("|")[0].strip()

    # JSON-LD structured data (often has name, openingHours, address)
    jld_name, jld_hours, jld_address = "", "", ""
    for sd in soup.find_all("script", type="application/ld+json"):
        try:
            d = json.loads(sd.string or "")
            if isinstance(d, list): d = d[0]
            jld_name = d.get("name", "")
            jld_hours = d.get("openingHours", "")
            addr = d.get("address", {})
            if isinstance(addr, dict):
                jld_address = addr.get("streetAddress", "")
        except:
            pass

    if not name and jld_name:
        name = jld_name

    # Unit number
    p = mall_cfg["parsers"]
    unit_number = ""
    unit_m = re.search(p["unit"], text)
    if unit_m:
        raw = unit_m.group(1) if unit_m.lastindex else unit_m.group(0)
        unit_number = f"#{raw}" if not raw.startswith("#") else raw

    # Floor
    floor_level = ""
    if p.get("floor"):
        fm = re.search(p["floor"], text, re.I)
        if fm:
            if fm.group(1):
                floor_level = f"L{fm.group(1)}"
            elif fm.lastindex and fm.group(2):
                floor_level = f"B{fm.group(2)}"

    # Opening hours
    opening_hours = ""
    if jld_hours:
        opening_hours = jld_hours if isinstance(jld_hours, str) else json.dumps(jld_hours)
    else:
        # Find "Opening Hours" section in text
        hours_kw = p.get("hours_section")
        if hours_kw:
            try:
                idx = next(i for i, l in enumerate(lines) if hours_kw.lower() in l.lower())
                # Collect lines after the heading until next section
                hrs_lines = []
                for l in lines[idx+1:idx+20]:
                    if re.match(r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|\d{1,2}am|\d{1,2}pm|Closed|Daily|Weekday|Weekend)", l, re.I):
                        hrs_lines.append(l)
                    elif hrs_lines:
                        break
                opening_hours = " | ".join(hrs_lines)
            except StopIteration:
                pass
        # VivoCity inline hours
        inline = re.search(r"Open\s+[\d:apm\s\-]+(?:daily|weekday|weekend)?", text, re.I)
        if inline:
            opening_hours = inline.group(0).strip()

    # Category — look for category breadcrumb or meta
    category = ""
    cat_meta = soup.find("meta", {"name": "category"}) or soup.find("meta", {"property": "article:section"})
    if cat_meta:
        category = cat_meta.get("content", "")
    if not category:
        # Breadcrumb
        for crumb in soup.select("[class*='breadcrumb'] a, [class*='category'] a"):
            txt = crumb.get_text(strip=True)
            if txt and len(txt) < 50:
                category = txt

    # Is F&B?
    fnb_kw = mall_cfg["fnb_keywords"]
    text_lower = text.lower()
    is_fnb = any(k in text_lower for k in fnb_kw) or any(k in category.lower() for k in fnb_kw)

    return {
        "mall": mall_cfg["name"],
        "operator": mall_cfg["name"].lower().replace(" ", "_"),
        "name": name,
        "page_url": page_url,
        "unit_number": unit_number,
        "floor_level": floor_level,
        "opening_hours": opening_hours,
        "category": [category] if category else [],
        "is_fnb": is_fnb,
        "halal": bool(re.search(r"halal", text, re.I)),
        "description": "",
        "phone": "",
        "store_status": "active",
    }


async def fetch(session: aiohttp.ClientSession, url: str) -> tuple[str, str]:
    async with session.get(url) as r:
        return url, await r.text()


async def scrape_mall(mall_cfg: dict) -> list[dict]:
    name = mall_cfg["name"]
    log.info("[%s] fetching sitemap", name)

    async with aiohttp.ClientSession(headers={"User-Agent": UA}, timeout=TIMEOUT) as session:
        # Get sitemap
        _, xml = await fetch(session, mall_cfg["sitemap"])
        urls = get_sitemap_urls(xml, mall_cfg["url_filter"])
        log.info("[%s] %d store URLs from sitemap", name, len(urls))

        # Fetch all pages with semaphore throttle
        sem = asyncio.Semaphore(CONCURRENCY)
        results = []

        async def fetch_one(url):
            async with sem:
                try:
                    _, html_text = await fetch(session, url)
                    store = parse_store_page(html_text, mall_cfg, url)
                    return store
                except Exception as e:
                    log.warning("[%s] failed %s: %s", name, url[-40:], e)
                    return None

        tasks = [fetch_one(u) for u in urls]
        for i, coro in enumerate(asyncio.as_completed(tasks), 1):
            store = await coro
            if store:
                results.append(store)
            if i % 50 == 0:
                log.info("[%s] %d/%d pages done", name, i, len(urls))

        fnb = [s for s in results if s["is_fnb"]]
        log.info("[%s] total=%d fnb=%d", name, len(results), len(fnb))
        return fnb


async def main():
    all_results = []
    for mall_cfg in MALLS:
        fnb = await scrape_mall(mall_cfg)
        slug = mall_cfg["name"].lower().replace(" ", "_")
        (OUT / f"{slug}_fnb.json").write_text(json.dumps(fnb, indent=2, ensure_ascii=False))
        all_results.extend(fnb)
        log.info("Saved %s_fnb.json (%d records)", slug, len(fnb))

    # Merge into all_fnb
    existing = json.loads((OUT / "all_fnb.json").read_text())
    seen = {(t["mall"].lower(), t["name"].lower()) for t in existing}
    new_added = 0
    for t in all_results:
        key = (t["mall"].lower(), t["name"].lower())
        if key not in seen:
            seen.add(key)
            existing.append(t)
            new_added += 1

    (OUT / "all_fnb.json").write_text(json.dumps(existing, indent=2, ensure_ascii=False))
    log.info("=== DONE: added %d new records, all_fnb.json now has %d ===", new_added, len(existing))


if __name__ == "__main__":
    asyncio.run(main())
