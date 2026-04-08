"""
scrape_sg_malls.py
Scrapes F&B tenant data from CapitaLand and Frasers malls in Singapore.

CapitaLand: Uses internal api-v1 REST endpoint (requires session cookies via requests).
Frasers:    Uses /bin/store/storeselect endpoint (requires browser session via Playwright).

Output:
  data/malls/capitaland_fnb.json
  data/malls/frasers_fnb.json
  data/malls/all_fnb.json          <- merged, normalised
"""
from __future__ import annotations
import asyncio, html, json, logging, re, time, urllib.parse
from pathlib import Path
import requests
from tenacity import retry, stop_after_attempt, wait_exponential
from playwright.async_api import async_playwright

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("malls")

OUT = Path("data/malls")
OUT.mkdir(parents=True, exist_ok=True)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
    ),
    "Accept": "application/json",
}

FNB_TAGS = {"foodandbeverage", "food", "eat", "restaurant", "cafe", "dining",
            "bakery", "dessert", "drink", "beverage"}

# ─────────────────────────────────────────────
# CAPITALAND
# ─────────────────────────────────────────────

CAPITALAND_MALLS = [
    "plazasingapura",
    "rafflesCity",           # Raffles City
    "bugisjunction",
    "bugisplus",
    "imm",
    "jcube",
    "westgate",
    "tampinesmall",
    "sengkanggrand",
    "bedokMall",
    "lotone",                # Lot One Shoppers' Mall
    "funanevenue",           # Funan
    "clarkeQuay",            # Clarke Quay
    "capitaland-grandgateway",
]


def capitaland_session(mall: str) -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    s.get(f"https://www.capitaland.com/sg/malls/{mall}/en/stores.html", timeout=20)
    return s


@retry(stop=stop_after_attempt(4), wait=wait_exponential(min=1, max=20))
def capitaland_fetch_page(s: requests.Session, mall: str, cursor: int, page_size: int = 300) -> dict:
    page_path = urllib.parse.quote(f"/content/capitaland/sg/malls/{mall}/en/stores")
    fields = (
        "jcr%3Atitle/unitnumber/malllocationnote/marketingcategory"
        "/foodTypes/storeStatus/shortdescription/entityname/pagePath/acceptsHalalCertified"
    )
    url = (
        f"https://www.capitaland.com/api-v1/sg/en/properties/{mall}"
        f"/cl%3Aentity/tenants/cl%3Arelated-page/{page_path}"
        f"/cl%3Asortby/jcr%3Atitle/asc/cl%3Aselectors/{fields}"
        f"/cl%3Apgcursor/{cursor}/{page_size}.json"
    )
    r = s.get(url, timeout=20)
    r.raise_for_status()
    return r.json()


def capitaland_is_fnb(tenant: dict) -> bool:
    cats = tenant.get("marketingcategory", []) or []
    return any("foodandbeverage" in str(c).lower() for c in cats)


def parse_capitaland_unit(raw_unit: str) -> tuple[str, str]:
    """'capitalanddatabasemanagement:sg/tenant-unit-numbers/plazasingapura/unit-b2-58' → ('#B2-58', 'B2')"""
    if not raw_unit:
        return "", ""
    slug = raw_unit.split("/")[-1]          # unit-b2-58
    slug = slug.replace("unit-", "").upper()  # B2-58
    # normalise: B2-58 → #B2-58
    m = re.match(r"([A-Z]?\d+)-(\d+[A-Z]?)", slug)
    if m:
        floor = m.group(1)
        return f"#{floor}-{m.group(2)}", floor
    return f"#{slug}", slug.split("-")[0]


def normalise_capitaland(tenant: dict, mall: str) -> dict:
    units = tenant.get("unitnumber") or []
    unit_raw = units[0] if units else ""
    unit_num, floor = parse_capitaland_unit(unit_raw)

    cats = [c.split("/")[-1] for c in (tenant.get("marketingcategory") or [])]
    food_types = tenant.get("foodTypes") or []

    return {
        "operator": "capitaland",
        "mall": mall,
        "name": tenant.get("jcr:title", ""),
        "is_fnb": capitaland_is_fnb(tenant),
        "category": cats,
        "food_types": food_types,
        "unit_number": unit_num,
        "floor_level": floor,
        "location_note": tenant.get("malllocationnote") or "",
        "store_status": tenant.get("storeStatus") or "",
        "description": tenant.get("shortdescription") or "",
        "halal": bool(tenant.get("acceptsHalalCertified")),
        "opening_hours": None,   # not available on CapitaLand
        "page_url": tenant.get("pagePath") or "",
        "entity_name": tenant.get("entityname") or "",
        "raw": tenant,
    }


def scrape_capitaland() -> list[dict]:
    results = []
    for mall in CAPITALAND_MALLS:
        log.info("[CapitaLand] %s", mall)
        try:
            s = capitaland_session(mall)
            cursor = 1
            page_size = 300
            while True:
                data = capitaland_fetch_page(s, mall, cursor, page_size)
                tenants = data.get("properties", [])
                total = data.get("totalcount", 0)
                if not tenants:
                    break
                for t in tenants:
                    n = normalise_capitaland(t, mall)
                    if n["is_fnb"]:
                        results.append(n)
                log.info("  %s cursor=%d fetched=%d total=%d fnb_so_far=%d",
                         mall, cursor, len(tenants), total, len(results))
                cursor += page_size
                if cursor > total:
                    break
                time.sleep(0.3)
        except Exception as e:
            log.error("[CapitaLand] %s failed: %s", mall, e)
        time.sleep(0.5)
    return results


# ─────────────────────────────────────────────
# FRASERS
# ─────────────────────────────────────────────

FRASERS_MALLS = [
    ("Northpoint City",     "https://www.northpointcity.com.sg"),
    ("Causeway Point",      "https://www.causewaypoint.com.sg"),
    ("Waterway Point",      "https://www.waterwaypoint.com.sg"),
    ("Century Square",      "https://www.centurysquare.com.sg"),
    ("Tampines 1",          "https://www.tampines1.com.sg"),
    ("White Sands",         "https://www.whitesands.com.sg"),
    ("Tiong Bahru Plaza",   "https://www.tiongbahruplaza.com.sg"),
    ("Hougang Mall",        "https://www.hougangmall.com.sg"),
    # Decommissioned / no storeselect endpoint:
    # ("Anchorpoint",       "https://www.anchorpoint.com.sg"),
    # ("Eastpoint Mall",    "https://www.eastpointmall.com.sg"),
    # ("The Centrepoint",   "https://www.thecentrepoint.com"),
    # ("Yew Tee Point",     "https://www.yewteepoint.com.sg"),
    # ("Bedok Point",       "https://www.bedokpoint.com.sg"),
    ("Robertson Walk",      "https://www.robertsonwalk.com.sg"),
    ("Valley Point",        "https://www.valleypoint.com.sg"),
]

FNB_CATEGORY_NAMES = {
    "food & restaurants", "food & beverage", "food and beverage",
    "restaurants", "cafes", "bakeries", "desserts", "beverages"
}


def clean_html(s: str) -> str:
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return html.unescape(s.strip())


def frasers_is_fnb(store: dict) -> bool:
    cat = (store.get("storeCategoryName") or "").lower()
    tags = (store.get("tags") or "")
    return (
        any(k in cat for k in ["food", "restaurant", "cafe", "bakery", "beverage", "dessert", "drink"])
        or any(k in tags.lower() for k in ["food", "eat", "restaurant", "cafe", "dining", "bakery"])
    )


def normalise_frasers(store: dict) -> dict:
    unit = store.get("unitNo") or ""
    # Extract floor from unitLocation: "South Wing, Basement 2" → "B2"
    loc = store.get("unitLocation") or ""
    floor = ""
    m = re.search(r"(B\d+|L\d+|Level\s*\d+|Basement\s*\d+|\d+)", loc, re.I)
    if m:
        raw = m.group(1).upper().replace("LEVEL", "L").replace("BASEMENT", "B").replace(" ", "")
        floor = raw

    # Clean unit: "North Wing, #03-34" → "#03-34"
    unit_clean = re.sub(r"^.*?,\s*", "", unit).strip()

    return {
        "operator": "frasers",
        "mall": store.get("mallName", ""),
        "name": store.get("storeName", ""),
        "is_fnb": frasers_is_fnb(store),
        "category": [store.get("storeCategoryName", "")],
        "food_types": [],
        "unit_number": unit_clean,
        "floor_level": floor,
        "location_note": loc,
        "store_status": "coming_soon" if store.get("isComingSoonStore") else "active",
        "description": clean_html(store.get("description") or ""),
        "halal": bool(store.get("isHalal")),
        "opening_hours": clean_html(store.get("openingHrs") or ""),
        "phone": store.get("phone1") or "",
        "website": store.get("website") or "",
        "facebook": store.get("facebook") or "",
        "instagram": store.get("instagram") or "",
        "page_url": store.get("pagePath") or "",
        "raw": store,
    }


async def scrape_frasers_mall(base_url: str, mall_name: str, browser) -> list[dict]:
    ctx = await browser.new_context(user_agent=HEADERS["User-Agent"])
    page = await ctx.new_page()
    stores = []

    async def capture(r):
        if "/bin/store/storeselect" in r.url and r.status == 200:
            try:
                body = await r.json()
                if isinstance(body, list):
                    stores.extend(body)
                    log.info("  [%s] /storeselect → %d stores", mall_name, len(body))
            except:
                pass

    page.on("response", capture)

    try:
        # The /eat page triggers storeselect with all stores for F&B
        for path in ["/eat", "/stores?category=eat", "/stores"]:
            try:
                await page.goto(f"{base_url}{path}", wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(3000)
                if stores:
                    break
            except Exception as e:
                log.warning("  [%s] path=%s failed: %s", mall_name, path, e)

        # If storeselect not triggered, try clicking category tabs
        if not stores:
            for label in ["EAT", "Food", "F&B", "Eat & Drink"]:
                try:
                    btn = page.locator(f"text='{label}'")
                    if await btn.count():
                        await btn.first.click()
                        await page.wait_for_timeout(2000)
                        if stores:
                            break
                except:
                    pass

        if not stores:
            log.warning("  [%s] no stores captured — trying storesearch fallback", mall_name)
            # Fallback: storesearch returns 12 featured but better than nothing
            fallback_resp = await page.evaluate("""
                async () => {
                    const r = await fetch('/bin/frasers/storesearch');
                    const text = await r.text();
                    if (text.startsWith('<')) return null;
                    return JSON.parse(text);
                }
            """)
            if fallback_resp and fallback_resp.get("stores"):
                stores.extend(fallback_resp["stores"])
                log.info("  [%s] fallback storesearch → %d stores", mall_name, len(stores))

    except Exception as e:
        log.error("  [%s] error: %s", mall_name, e)
    finally:
        await page.close()
        await ctx.close()

    return stores


async def scrape_frasers_all() -> list[dict]:
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for mall_name, base_url in FRASERS_MALLS:
            log.info("[Frasers] %s", mall_name)
            raw_stores = await scrape_frasers_mall(base_url, mall_name, browser)
            fnb = [normalise_frasers(s) for s in raw_stores if frasers_is_fnb(s)]
            log.info("  [%s] total=%d fnb=%d", mall_name, len(raw_stores), len(fnb))
            results.extend(fnb)
            await asyncio.sleep(1)
        await browser.close()
    return results


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    log.info("=== Scraping CapitaLand malls ===")
    cap_fnb = scrape_capitaland()
    (OUT / "capitaland_fnb.json").write_text(
        json.dumps(cap_fnb, indent=2, ensure_ascii=False)
    )
    log.info("CapitaLand: %d F&B tenants saved", len(cap_fnb))

    log.info("\n=== Scraping Frasers malls ===")
    fra_fnb = asyncio.run(scrape_frasers_all())
    (OUT / "frasers_fnb.json").write_text(
        json.dumps(fra_fnb, indent=2, ensure_ascii=False)
    )
    log.info("Frasers: %d F&B tenants saved", len(fra_fnb))

    # Merge + deduplicate by (mall, name)
    seen = set()
    all_fnb = []
    for t in cap_fnb + fra_fnb:
        key = (t["mall"].lower(), t["name"].lower())
        if key not in seen:
            seen.add(key)
            all_fnb.append(t)

    (OUT / "all_fnb.json").write_text(
        json.dumps(all_fnb, indent=2, ensure_ascii=False)
    )
    log.info("\n=== DONE: %d unique F&B tenants across %d CapitaLand + %d Frasers malls ===",
             len(all_fnb), len(CAPITALAND_MALLS), len(FRASERS_MALLS))


if __name__ == "__main__":
    main()
