#!/usr/bin/env python3
"""
scripts/fetch_foodpanda_api_batch.py

Optimized Foodpanda Mobile Client API extractor with session persistence,
cookie jar tracking (_pxhd, __cf_bm), balanced dynamic pacing (2.6s–3.4s),
tiered cooldown backoff (75s -> 160s -> 250s), and automatic Document 2 sync.
"""

import os
import re
import sys
import ssl
import time
import json
import random
import uuid
import urllib.request
import http.cookiejar
import argparse
import subprocess
from typing import Dict, Any, List, Optional

SSL_CTX = ssl._create_unverified_context()
CACHE_FILE = "data/foodpanda_api_cache.jsonl"


class PersistentFoodpandaClient:
    """Maintains a persistent mobile device session with cookies and stable IDs."""

    def __init__(self):
        self.cj = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPSHandler(context=SSL_CTX),
            urllib.request.HTTPCookieProcessor(self.cj)
        )
        self.user_agent = "Foodpanda/24.12.0 (Linux; U; Android 14; Pixel 8 Pro)"
        self.api_key = "android"
        self.client_id = self._generate_id()
        self.session_id = self._generate_id()
        self.req_count = 0

    def _generate_id(self) -> str:
        now_ms = int(time.time() * 1000)
        return f"{now_ms}.{uuid.uuid4().hex[:16]}.{uuid.uuid4().hex[:8]}"

    def refresh_session(self):
        """Rotate session ID and clear transient cookies while preserving client identity."""
        self.session_id = self._generate_id()
        self.cj.clear()
        self.req_count = 0

    def get_headers(self) -> Dict[str, str]:
        self.req_count += 1
        # Rotate session ID naturally every 150 requests
        if self.req_count > 150:
            self.session_id = self._generate_id()
            self.req_count = 1

        return {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
            "Accept-Language": "en-SG,en;q=0.9",
            "Connection": "keep-alive",
            "perseus-client-id": self.client_id,
            "perseus-session-id": self.session_id,
            "x-fp-api-key": self.api_key
        }

    def fetch_vendor_menu(self, vendor_code: str, max_retries: int = 3, timeout: int = 12) -> Optional[Dict[str, Any]]:
        """Fetch vendor menu with tiered cooldown (Tier 1: 75s-90s, Tier 2: 160s-180s, Tier 3: 240s-270s)."""
        url = f"https://sg.fd-api.com/api/v5/vendors/{vendor_code}?include=menus"
        
        attempt = 0
        while attempt < max_retries:
            attempt += 1
            headers = self.get_headers()
            req = urllib.request.Request(url, headers=headers)
            try:
                with self.opener.open(req, timeout=timeout) as resp:
                    if resp.status == 200:
                        data = json.loads(resp.read().decode("utf-8"))
                        return data.get("data")
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    return {"status": "not_found", "items": []}
                if e.code in (429, 403):
                    # Tiered cooldown schedule:
                    if attempt == 1:
                        sleep_s = random.randint(75, 90)
                    elif attempt == 2:
                        sleep_s = random.randint(160, 180)
                    else:
                        sleep_s = random.randint(240, 270)
                        
                    print(f"\n  [Rate Limit HTTP {e.code}] Tier {attempt}/{max_retries}: Cooling down {sleep_s}s (Cookies active: {len(self.cj)})...", flush=True)
                    time.sleep(sleep_s)
                    self.refresh_session()
                    continue
                else:
                    print(f"  [HTTP Error {e.code}] on {vendor_code}: {e}", flush=True)
                    time.sleep(2)
            except Exception as e:
                print(f"  [Network Exception] on {vendor_code}: {e}", flush=True)
                time.sleep(3)

        print(f"  [SKIPPED] Vendor {vendor_code} exhausted {max_retries} cooldown tiers.", flush=True)
        return {"status": "skipped", "error": f"exhausted {max_retries} tiers"}


def extract_vendor_code(url: str) -> Optional[str]:
    """Extract vendor code from Foodpanda URL, e.g. /restaurant/t3ip/ -> t3ip"""
    if not url:
        return None
    m = re.search(r"/restaurant/([a-zA-Z0-9]+)(?:/|$)", url)
    return m.group(1) if m else None


def parse_vendor_items(vdata: Dict[str, Any], sfa_licence: str = "", stall_name: str = "") -> List[Dict[str, Any]]:
    """Extract itemized dishes enforcing Rule B pricing and schema rules."""
    items = []
    v_name = vdata.get("name") or stall_name
    menus = vdata.get("menus", [])
    
    for m in menus:
        m_title = m.get("name") or "Standard Menu"
        start_time = m.get("opening_time") or ""
        end_time = m.get("closing_time") or ""
        
        for cat in m.get("menu_categories", []):
            cat_name = (cat.get("name") or "Mains").strip()
            
            for prod in cat.get("products", []):
                p_name = (prod.get("name") or "").strip()
                if not p_name:
                    continue
                p_desc = (prod.get("description") or "").strip()
                
                # Image resolution
                p_img = ""
                images = prod.get("images") or []
                if images and isinstance(images, list):
                    first_img = images[0]
                    if isinstance(first_img, dict):
                        p_img = first_img.get("image_url") or first_img.get("url") or ""
                if not p_img and prod.get("file_path"):
                    p_img = prod["file_path"]

                variations = prod.get("product_variations", [])
                if not variations:
                    variations = [{}]
                
                for var in variations:
                    v_subname = (var.get("name") or "").strip()
                    full_dish_name = p_name
                    if v_subname and v_subname.lower() not in ("standard", "regular", "default", p_name.lower()):
                        full_dish_name = f"{p_name} ({v_subname})"
                        
                    raw_price = var.get("price")
                    raw_before = var.get("price_before_discount")
                    
                    price_val = None
                    promo_val = None
                    flag = ""
                    
                    if raw_before is not None and float(raw_before) > 0:
                        price_val = float(raw_before)
                        if raw_price is not None and float(raw_price) < price_val:
                            promo_val = float(raw_price)
                    elif raw_price is not None and float(raw_price) > 0:
                        price_val = float(raw_price)
                        
                    price_str = f"{price_val:.2f}" if price_val is not None else ""
                    promo_str = f"{promo_val:.2f}" if promo_val is not None else ""
                    
                    if price_val is None:
                        flag = "NO_PRICE_FOUND"
                    elif price_val < 1.00:
                        flag = "SUSPICIOUS_LOW_PRICE"
                    elif price_val > 100.00:
                        flag = "SUSPICIOUS_HIGH_PRICE"
                        
                    items.append({
                        "name": full_dish_name,
                        "category": cat_name,
                        "price_sgd": price_str,
                        "promotional_price_sgd": promo_str,
                        "price_review_flag": flag,
                        "description": p_desc,
                        "image_url": p_img,
                        "menu_title": m_title,
                        "start_time": start_time,
                        "end_time": end_time,
                        "sfa_licence": sfa_licence,
                        "stall_name": v_name
                    })
                    
    return items


def load_cached_licences(cache_path: str) -> set:
    """Load SFA licences that have already been extracted in the JSONL cache."""
    cached = set()
    if os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        record = json.loads(line)
                        lic = record.get("sfa_licence")
                        if lic:
                            cached.add(lic)
                    except Exception:
                        pass
    return cached


def trigger_ingest():
    """Trigger ingestion from cache into Document 2."""
    print("\n[Auto-Sync] Synchronizing cache into Document 2 (CSV & XLSX)...", flush=True)
    try:
        subprocess.run(["python3", "scripts/ingest_foodpanda_api_cache.py"], check=True)
        print("[Auto-Sync] Ingestion completed successfully.\n", flush=True)
    except Exception as e:
        print(f"[Auto-Sync WARNING] Ingestion failed: {e}\n", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Fetch Foodpanda menus via free mobile API")
    parser.add_argument("--input", default="data/foodpanda_goal_targets.csv", help="Input targets CSV")
    parser.add_argument("--cache", default=CACHE_FILE, help="JSONL cache path for incremental progress")
    parser.add_argument("--limit", type=int, default=10000, help="Maximum number of stalls to process in this run")
    parser.add_argument("--start", type=int, default=0, help="Start offset in target list")
    parser.add_argument("--licence", help="Fetch a single specific SFA licence")
    parser.add_argument("--delay-min", type=float, default=2.6, help="Minimum delay between requests")
    parser.add_argument("--delay-max", type=float, default=3.4, help="Maximum delay between requests")
    parser.add_argument("--sync-every", type=int, default=50, help="Sync cache into Document 2 every N stalls")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without modifying files")
    args = parser.parse_args()
    
    # 1. Load targets
    targets = []
    with open(args.input, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            lic = r.get("SFA Licence", "").strip()
            name = r.get("F&B Name", "").strip()
            url = r.get("Menu URL", "").strip()
            code = extract_vendor_code(url)
            if lic and code:
                targets.append({"licence": lic, "name": name, "url": url, "code": code})
                
    print(f"[API Extractor] Loaded {len(targets)} targets from {args.input}", flush=True)
    
    # 2. Filter cached
    cached_lics = load_cached_licences(args.cache)
    print(f"[API Extractor] Already cached: {len(cached_lics)} stalls in {args.cache}", flush=True)
    
    if args.licence:
        targets = [t for t in targets if t["licence"] == args.licence]
    else:
        targets = [t for t in targets if t["licence"] not in cached_lics]
        targets = targets[args.start:args.start + args.limit]
        
    print(f"[API Extractor] Processing {len(targets)} stalls in this batch (delay={args.delay_min}s–{args.delay_max}s, sync_every={args.sync_every})...\n", flush=True)
    
    client = PersistentFoodpandaClient()
    success_count = 0
    total_items = 0
    since_last_sync = 0
    
    for idx, t in enumerate(targets, 1):
        lic = t["licence"]
        name = t["name"]
        code = t["code"]
        
        t0 = time.time()
        vdata = client.fetch_vendor_menu(code)
        dt = time.time() - t0
        
        if vdata and not vdata.get("status"):
            items = parse_vendor_items(vdata, sfa_licence=lic, stall_name=name)
            success_count += 1
            total_items += len(items)
            since_last_sync += 1
            print(f"[{idx}/{len(targets)}] {name} ({lic} / {code}): {len(items)} items in {dt:.2f}s | Cookies: {len(client.cj)}", flush=True)
            
            if not args.dry_run:
                record = {
                    "sfa_licence": lic,
                    "stall_name": name,
                    "vendor_code": code,
                    "source_url": t["url"],
                    "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "item_count": len(items),
                    "items": items
                }
                with open(args.cache, "a", encoding="utf-8") as f_out:
                    f_out.write(json.dumps(record, ensure_ascii=False) + "\n")
        elif vdata and vdata.get("status") in ("not_found", "skipped"):
            status_label = vdata.get("status").upper()
            since_last_sync += 1
            print(f"[{idx}/{len(targets)}] {name} ({lic} / {code}): {status_label} in {dt:.2f}s", flush=True)
            if not args.dry_run:
                record = {
                    "sfa_licence": lic,
                    "stall_name": name,
                    "vendor_code": code,
                    "source_url": t["url"],
                    "fetched_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                    "item_count": 0,
                    "items": []
                }
                with open(args.cache, "a", encoding="utf-8") as f_out:
                    f_out.write(json.dumps(record, ensure_ascii=False) + "\n")
        else:
            print(f"[{idx}/{len(targets)}] {name} ({lic} / {code}): NO DATA in {dt:.2f}s", flush=True)
                    
        # Periodic auto-sync to Document 2
        if not args.dry_run and args.sync_every > 0 and since_last_sync >= args.sync_every:
            trigger_ingest()
            since_last_sync = 0

        # Natural human browsing pause every ~20 requests
        if idx % 20 == 0:
            pause = random.uniform(5.0, 7.5)
            print(f"  [Natural Session Pause] Pausing {pause:.1f}s after 20 requests...", flush=True)
            time.sleep(pause)
        else:
            jitter_delay = random.uniform(args.delay_min, args.delay_max)
            time.sleep(jitter_delay)
        
    # Final sync if items were extracted
    if not args.dry_run and since_last_sync > 0:
        trigger_ingest()
        
    print(f"\n[API Extractor COMPLETE] {success_count}/{len(targets)} stalls fetched, {total_items} total items.", flush=True)


if __name__ == "__main__":
    import csv
    main()
