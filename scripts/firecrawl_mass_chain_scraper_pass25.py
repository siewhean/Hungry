#!/usr/bin/env python3
"""
scripts/firecrawl_mass_chain_scraper_pass25.py
High-throughput Firecrawl parallel scraper targeting Singapore chain and restaurant menus.
Leverages local Docker container (12 CPUs / 7.57GB RAM) to maximize crawling productivity.
Uses standard library urllib for zero external dependencies.
"""

import os
import sys
import json
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed

FIRECRAWL_URL = "http://localhost:3002/v1/scrape"
OUTPUT_DIR = "data/crawls/pass25_firecrawl_scrapes"
os.makedirs(OUTPUT_DIR, exist_ok=True)

TARGET_SLUGS = [
    # Top unpopulated chains
    "fish-co-menu",
    "eighteen-chefs-menu",
    "stuffd-menu",
    "stuffd-menu-price",
    "pastamania-menu",
    "astons-menu",
    "andes-by-astons-menu",
    "swensens-menu",
    "encik-tan-menu",
    "din-tai-fung-menu",
    "din-tai-fung-menu-prices",
    "tim-ho-wan-menu",
    "soup-restaurant-menu",
    "boon-tong-kee-menu",
    "texas-chicken-menu",
    "popeyes-menu",
    "burger-king-menu",
    "burger-king-breakfast-menu",
    "haidilao-menu",
    "crystal-jade-menu",
    "genki-sushi-menu",
    "singapore-mcdonalds-menu-price",
    "mcdonald-breakfast-menu-singapore",
    "mcdonalds-breakfast-menu-prices",
    "big-fish-small-fish-menu",
    "grub-burger-bistro-menu",
    "alt-pizza-menu",
    "spizza-menu",
    "pizza-maru-menu",
    "canton-paradise-menu",
    "mos-burger-menu",
    "jollibee-singapore-menu",
    "sushi-tei-menu",
    "sanook-kitchen-menu",
    "wok-hey-menu",
    "saizeriya-menu",
    "dian-xiao-er-menu",
    "ajisen-ramen-menu",
    "ichiban-boshi-menu",
    "sushiro-menu",
    "five-guys-menu",
    "shake-shack-menu",
    "nandos-menu",
    "subway-menu",
    "toast-box-menu",
    "ya-kun-kaya-toast-menu",
    "starbucks-singapore-menu",
    "kfc-menu",
    "kfc-breakfast-menu",
    "pepper-lunch-menu",
    "liho-tea-menu",
    "koi-the-menu",
    "mr-bean-menu",
    "tiong-bahru-bakery-menu",
    "breadtalk-menu",
    "four-leaves-menu",
    "swee-heng-bakery-menu",
    "chutney-mary-menu"
]

def build_url_list():
    urls = []
    with open("data/crawls/sgmenuprices_all_urls.json") as f:
        all_sitemap_urls = json.load(f)
    
    seen = set()
    for slug in TARGET_SLUGS:
        matches = [u for u in all_sitemap_urls if slug in u.lower()]
        for m in matches:
            if m not in seen:
                urls.append(m)
                seen.add(m)
    
    # Also add remaining restaurant menus up to 120 targets to maximize docker usage
    for u in all_sitemap_urls:
        if "-menu" in u and u not in seen and not any(skip in u for skip in ["calories", "toy", "job", "career", "salary"]):
            urls.append(u)
            seen.add(u)
            if len(urls) >= 120:
                break
                
    return urls

def scrape_single_url(url, timeout=60):
    slug = url.strip("/").split("/")[-1]
    out_file = os.path.join(OUTPUT_DIR, f"{slug}.md")
    if os.path.exists(out_file) and os.path.getsize(out_file) > 500:
        return {"url": url, "slug": slug, "status": "cached", "bytes": os.path.getsize(out_file)}

    payload = json.dumps({
        "url": url,
        "formats": ["markdown"],
        "onlyMainContent": True,
        "waitFor": 1500
    }).encode("utf-8")
    
    req = urllib.request.Request(
        FIRECRAWL_URL,
        data=payload,
        headers={"Content-Type": "application/json"}
    )
    
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            elapsed = time.time() - t0
            if response.status == 200:
                resp_bytes = response.read()
                data = json.loads(resp_bytes.decode("utf-8"))
                md = data.get("data", {}).get("markdown", "")
                if md:
                    with open(out_file, "w", encoding="utf-8") as f:
                        f.write(md)
                    return {"url": url, "slug": slug, "status": "ok", "bytes": len(md), "elapsed": elapsed}
                else:
                    return {"url": url, "slug": slug, "status": "empty", "elapsed": elapsed}
            else:
                return {"url": url, "slug": slug, "status": f"http_{response.status}", "elapsed": elapsed}
    except urllib.error.HTTPError as e:
        return {"url": url, "slug": slug, "status": f"http_{e.code}", "elapsed": time.time() - t0}
    except Exception as e:
        return {"url": url, "slug": slug, "status": f"err_{type(e).__name__}", "elapsed": time.time() - t0}

def main():
    urls = build_url_list()
    print(f"Loaded {len(urls)} target URLs for Pass 25 high-throughput crawl.")
    print("Initiating 24-worker parallel crawl against local Firecrawl Docker...")
    
    t_start = time.time()
    results = []
    success_count = 0
    cached_count = 0
    fail_count = 0
    total_bytes = 0
    
    with ThreadPoolExecutor(max_workers=24) as executor:
        future_map = {executor.submit(scrape_single_url, u): u for u in urls}
        for future in as_completed(future_map):
            res = future.result()
            results.append(res)
            st = res.get("status")
            if st == "ok":
                success_count += 1
                b = res.get("bytes", 0)
                total_bytes += b
                print(f"[OK] {res['slug']} ({b} bytes, {res['elapsed']:.1f}s)")
            elif st == "cached":
                cached_count += 1
                total_bytes += res.get("bytes", 0)
                print(f"[CACHED] {res['slug']} ({res['bytes']} bytes)")
            else:
                fail_count += 1
                print(f"[FAIL] {res['slug']} - {st}")

    total_time = time.time() - t_start
    manifest = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_targets": len(urls),
        "success": success_count,
        "cached": cached_count,
        "failed": fail_count,
        "total_bytes": total_bytes,
        "total_time_seconds": round(total_time, 2),
        "results": results
    }
    manifest_path = "data/crawls/pass25_firecrawl_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print("\n--- CRAWL SUMMARY ---")
    print(f"Total Targets: {len(urls)}")
    print(f"Scraped OK: {success_count}")
    print(f"Cached: {cached_count}")
    print(f"Failed: {fail_count}")
    print(f"Total Bytes Harvested: {total_bytes / (1024*1024):.2f} MB")
    print(f"Total Wall Time: {total_time:.1f}s")
    print(f"Manifest: {manifest_path}")

if __name__ == "__main__":
    main()
