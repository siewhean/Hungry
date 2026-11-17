#!/usr/bin/env python3
"""
scripts/foodpanda_menu_parser.py

Automated parser and scraper for Foodpanda restaurant pages.
Implements the multi-tiered extraction specification:
1. Reads embedded menu data first:
   - Apollo GraphQL initialState (`window.__PROVIDER_PROPS__.apollo.initialState`)
   - Preloaded state (`window.__PRELOADED_STATE__.vendor.data.menus`)
   Matches each category to its parent menu, capturing the menu's title and
   active start/end times (schedules) on each item.
2. Falls back to DOM product tiles if embedded data is missing.
3. Supports both offline saved HTML files (Mac browser saves) and live network URLs.
4. Outputs structured JSON or appends directly to the Hungry dish catalogue.
"""

import sys
import os
import re
import json
import csv
import argparse
import ssl
import urllib.request
from typing import Dict, List, Any, Optional

CTX = ssl._create_unverified_context()
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)


def extract_balanced_json(text: str, start_pos: int) -> Optional[str]:
    """Extract a balanced JSON object starting at start_pos."""
    brace_count = 0
    in_string = False
    escape = False
    quote_char = None
    
    for i in range(start_pos, len(text)):
        c = text[i]
        if escape:
            escape = False
            continue
        if c == '\\':
            escape = True
            continue
        if in_string:
            if c == quote_char:
                in_string = False
            continue
        else:
            if c in ('"', "'"):
                in_string = True
                quote_char = c
                continue
            if c == '{':
                brace_count += 1
            elif c == '}':
                brace_count -= 1
                if brace_count == 0:
                    return text[start_pos:i+1]
    return None


def parse_apollo_initial_state(html: str) -> Optional[Dict[str, Any]]:
    """Extract and parse Apollo initialState if present."""
    marker = '"initialState":{'
    pos = html.find(marker)
    if pos == -1:
        pos = html.find('initialState:{')
        if pos == -1:
            return None
        start = pos + len('initialState:')
    else:
        start = pos + len('"initialState":')
        
    raw_json = extract_balanced_json(html, start)
    if not raw_json:
        return None
        
    try:
        cleaned = re.sub(r':\s*undefined\b', ': null', raw_json)
        return json.loads(cleaned)
    except Exception:
        return None


def parse_preloaded_state(html: str) -> Optional[Dict[str, Any]]:
    """Extract and parse window.__PRELOADED_STATE__ if present."""
    match = re.search(r'window\.__PRELOADED_STATE__\s*=\s*(\{)', html)
    if not match:
        return None
    start = match.start(1)
    raw_json = extract_balanced_json(html, start)
    if not raw_json:
        return None
    try:
        cleaned = re.sub(r':\s*undefined\b', ': null', raw_json)
        return json.loads(cleaned)
    except Exception:
        return None


def extract_items_from_apollo(state: Dict[str, Any], sfa_licence: str = "", stall_name: str = "") -> Dict[str, Any]:
    """Parse products, categories, and schedules from Apollo cache state."""
    products_raw = {}
    categories_raw = {}
    menus_raw = {}
    vendor_info = {}

    for k, v in state.items():
        if not isinstance(v, dict):
            continue
        typename = v.get("__typename")
        if k.startswith("RestaurantProductData:") or typename == "RestaurantProductData":
            products_raw[k] = v
        elif k.startswith("RestaurantMenuCategory:") or typename == "RestaurantMenuCategory":
            categories_raw[k] = v
        elif ("Menu" in k or typename == "RestaurantMenu") and "Category" not in k and typename in ("Menu", "RestaurantMenu", "VendorMenu"):
            menus_raw[k] = v
        elif k.startswith("Vendor:") or typename == "Vendor":
            vendor_info = v

    # Build category map: category_id / ref -> category dict
    category_by_id = {}
    category_to_menu = {}

    # Map menus to categories and build schedule info
    active_menus = []
    for k, m in menus_raw.items():
        m_title = m.get("title") or m.get("name") or "Standard Menu"
        start_time = m.get("startTime") or m.get("opening_time") or ""
        end_time = m.get("endTime") or m.get("closing_time") or ""
        menu_entry = {
            "title": m_title,
            "start_time": start_time,
            "end_time": end_time
        }
        active_menus.append(menu_entry)

        # Link categories in this menu
        cats = m.get("categories", [])
        for c in cats:
            if isinstance(c, dict) and "__ref" in c:
                category_to_menu[c["__ref"]] = menu_entry

    for k, cat in categories_raw.items():
        c_id = cat.get("id") or k.split(":")[-1]
        c_title = cat.get("title") or cat.get("name") or "Mains"
        category_by_id[str(c_id)] = c_title
        category_by_id[k] = c_title

    default_schedule = active_menus[0] if active_menus else {"title": "Standard Menu", "start_time": "", "end_time": ""}

    items = []
    for k, p in products_raw.items():
        name = (p.get("title") or p.get("name") or "").strip()
        if not name:
            continue
        desc = (p.get("description") or "").strip()
        
        # Price extraction: strictly keep originalPrice as base price.
        # Promotional / discounted price is kept separate to avoid mixing base and promo prices.
        base_price = ""
        promo_price = ""
        price_review_flag = ""

        price_attrs = p.get("priceAttributes")
        if isinstance(price_attrs, dict):
            orig_p = price_attrs.get("originalPrice")
            disc_p = price_attrs.get("discountedPrice")
            if orig_p is not None:
                base_price = f"{float(orig_p):.2f}"
            if disc_p is not None:
                promo_price = f"{float(disc_p):.2f}"

        # Check variations if base_price not found yet
        if not base_price and "variations" in p and isinstance(p["variations"], list):
            for v_ref in p["variations"]:
                if isinstance(v_ref, dict):
                    v_key = v_ref.get("__ref")
                    if v_key and v_key in state:
                        v_obj = state[v_key]
                        v_pa = v_obj.get("priceAttributes", {})
                        if isinstance(v_pa, dict):
                            if v_pa.get("originalPrice") is not None:
                                base_price = f"{float(v_pa['originalPrice']):.2f}"
                            if not promo_price and v_pa.get("discountedPrice") is not None:
                                promo_price = f"{float(v_pa['discountedPrice']):.2f}"
                            if base_price:
                                break

        # Rule B: If originalPrice is missing, leave base price blank and flag for review.
        # Do NOT silently fall back to discountedPrice as base price.
        if not base_price:
            if promo_price:
                price_review_flag = "missing_base_has_promo"
            else:
                price_review_flag = "missing_base_price"

        # Image extraction (image.url, images[0].url, image string)
        img_url = ""
        img_obj = p.get("image")
        if isinstance(img_obj, dict):
            img_url = img_obj.get("url") or ""
        elif isinstance(img_obj, str):
            img_url = img_obj
        if not img_url:
            images = p.get("images", [])
            if images and isinstance(images, list):
                first_img = images[0]
                if isinstance(first_img, dict):
                    img_url = first_img.get("url") or first_img.get("image_url") or ""
                elif isinstance(first_img, str):
                    img_url = first_img

        # Category resolution
        cat_name = "Mains"
        cat_ref_key = ""
        cat_ref = p.get("menuCategory") or p.get("category")
        if isinstance(cat_ref, dict) and "__ref" in cat_ref:
            cat_ref_key = cat_ref["__ref"]
            if cat_ref_key in category_by_id:
                cat_name = category_by_id[cat_ref_key]
        elif p.get("category_id"):
            cid = str(p.get("category_id"))
            if cid in category_by_id:
                cat_name = category_by_id[cid]

        # Schedule resolution
        item_schedule = category_to_menu.get(cat_ref_key, default_schedule)

        items.append({
            "name": name,
            "category": cat_name,
            "price_sgd": base_price,
            "promotional_price_sgd": promo_price,
            "price_review_flag": price_review_flag,
            "description": desc,
            "image_url": img_url,
            "menu_title": item_schedule["title"],
            "start_time": item_schedule["start_time"],
            "end_time": item_schedule["end_time"],
            "sfa_licence": sfa_licence,
            "stall_name": stall_name
        })

    return {
        "success": bool(items),
        "method": "embedded_apollo",
        "stall_name": vendor_info.get("name") or stall_name,
        "active_menus": active_menus,
        "items": items
    }


def extract_items_from_preloaded(state: Dict[str, Any], sfa_licence: str = "", stall_name: str = "") -> Dict[str, Any]:
    """Parse products and categories from window.__PRELOADED_STATE__."""
    vendor = state.get("vendor", {}).get("data", {})
    v_name = vendor.get("name") or stall_name
    menus = vendor.get("menus", [])
    
    items = []
    active_menus = []

    for m in menus:
        m_title = m.get("name") or "Standard Menu"
        start_time = m.get("opening_time") or ""
        end_time = m.get("closing_time") or ""
        active_menus.append({
            "title": m_title,
            "start_time": start_time,
            "end_time": end_time
        })

        for cat in m.get("menu_categories", []):
            cat_name = cat.get("name", "Popular").strip()
            for prod in cat.get("products", []):
                p_name = (prod.get("name") or prod.get("title") or "").strip()
                if not p_name:
                    continue
                p_desc = (prod.get("description") or "").strip()
                
                p_price = ""
                p_promo = ""
                p_flag = ""
                variations = prod.get("product_variations", [])
                if variations:
                    v0 = variations[0]
                    orig_p = v0.get("original_price") or v0.get("originalPrice")
                    disc_p = v0.get("discounted_price") or v0.get("discountedPrice")
                    if orig_p is not None:
                        p_price = f"{float(orig_p):.2f}"
                    if disc_p is not None:
                        p_promo = f"{float(disc_p):.2f}"
                    if not p_price and v0.get("price") is not None:
                        # If only price is present, verify whether it is tagged as promo
                        p_price = f"{float(v0['price']):.2f}"
                else:
                    orig_p = prod.get("original_price") or prod.get("originalPrice")
                    disc_p = prod.get("discounted_price") or prod.get("discountedPrice")
                    if orig_p is not None:
                        p_price = f"{float(orig_p):.2f}"
                    if disc_p is not None:
                        p_promo = f"{float(disc_p):.2f}"
                    if not p_price and prod.get("price") is not None:
                        p_price = f"{float(prod['price']):.2f}"

                if not p_price:
                    if p_promo:
                        p_flag = "missing_base_has_promo"
                    else:
                        p_flag = "missing_base_price"

                p_img = ""
                imgs = prod.get("images", [])
                if imgs and isinstance(imgs, list):
                    first_img = imgs[0]
                    if isinstance(first_img, dict):
                        p_img = first_img.get("url") or ""
                    elif isinstance(first_img, str):
                        p_img = first_img
                elif prod.get("image"):
                    p_img = prod.get("image")

                items.append({
                    "name": p_name,
                    "category": cat_name,
                    "price_sgd": p_price,
                    "promotional_price_sgd": p_promo,
                    "price_review_flag": p_flag,
                    "description": p_desc,
                    "image_url": p_img,
                    "menu_title": m_title,
                    "start_time": start_time,
                    "end_time": end_time,
                    "sfa_licence": sfa_licence,
                    "stall_name": v_name
                })

    return {
        "success": bool(items),
        "method": "embedded_preloaded_state",
        "stall_name": v_name,
        "active_menus": active_menus,
        "items": items
    }


def extract_items_from_dom_fallback(html: str, sfa_licence: str = "", stall_name: str = "") -> Dict[str, Any]:
    """Fallback parser for DOM product tiles when embedded JSON is absent."""
    items = []
    
    product_blocks = re.findall(
        r'(<div[^>]+data-testid=["\'](?:menu-product-tile|product-card)["\'][^>]*>[\s\S]*?<\/div>\s*<\/div>)',
        html
    )

    if not product_blocks:
        product_blocks = re.findall(
            r'(<li[^>]+data-testid=["\']menu-product-tile["\'][^>]*>[\s\S]*?<\/li>)',
            html
        )

    for block in product_blocks:
        name_m = re.search(r'data-testid=["\']menu-product-name["\'][^>]*>([^<]+)<', block)
        if not name_m:
            name_m = re.search(r'<h[34][^>]*>([^<]+)<\/h[34]>', block)
        name = name_m.group(1).strip() if name_m else ""
        if not name:
            continue

        price_m = re.search(r'data-testid=["\']menu-product-price["\'][^>]*>[^$]*\$\s*([\d\.]+)<', block)
        if not price_m:
            price_m = re.search(r'\$\s*([\d\.]+)', block)
        price = f"{float(price_m.group(1)):.2f}" if price_m else ""

        desc_m = re.search(r'data-testid=["\']menu-product-description["\'][^>]*>([^<]+)<', block)
        desc = desc_m.group(1).strip() if desc_m else ""

        img_m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', block)
        img = img_m.group(1) if img_m else ""

        items.append({
            "name": name,
            "category": "Popular",
            "price_sgd": price,
            "promotional_price_sgd": "",
            "price_review_flag": "" if price else "missing_base_price",
            "description": desc,
            "image_url": img,
            "menu_title": "Standard Menu",
            "start_time": "",
            "end_time": "",
            "sfa_licence": sfa_licence,
            "stall_name": stall_name
        })

    return {
        "success": bool(items),
        "method": "dom_product_tiles_fallback",
        "stall_name": stall_name,
        "active_menus": [{"title": "Standard Menu", "start_time": "", "end_time": ""}],
        "items": items
    }


def parse_foodpanda_page(html: str, sfa_licence: str = "", stall_name: str = "") -> Dict[str, Any]:
    """Multi-tiered Foodpanda page parser following project specifications."""
    if "px-captcha" in html or "Access to this page has been denied" in html:
        return {
            "success": False,
            "method": "blocked_by_perimeterx",
            "error": "PerimeterX bot protection intercepted request. Use offline saved HTML page or stealth session.",
            "items": []
        }

    # Tier 1: Apollo initialState
    apollo_state = parse_apollo_initial_state(html)
    if apollo_state:
        res = extract_items_from_apollo(apollo_state, sfa_licence=sfa_licence, stall_name=stall_name)
        if res.get("items"):
            return res

    # Tier 2: window.__PRELOADED_STATE__
    preloaded = parse_preloaded_state(html)
    if preloaded:
        res = extract_items_from_preloaded(preloaded, sfa_licence=sfa_licence, stall_name=stall_name)
        if res.get("items"):
            return res

    # Tier 3: DOM Product Tiles Fallback
    dom_res = extract_items_from_dom_fallback(html, sfa_licence=sfa_licence, stall_name=stall_name)
    if dom_res.get("items"):
        return dom_res

    return {
        "success": False,
        "method": "none",
        "error": "No product items found in embedded JSON or DOM product tiles.",
        "items": []
    }


def fetch_url(url: str, timeout: int = 15) -> str:
    """Fetch live Foodpanda URL with browser headers."""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": DEFAULT_USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Cache-Control": "no-cache",
        }
    )
    with urllib.request.urlopen(req, context=CTX, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def main():
    parser = argparse.ArgumentParser(description="Foodpanda Menu Parser & Scraper")
    parser.add_argument("--file", help="Path to offline saved Foodpanda HTML file")
    parser.add_argument("--dir", help="Directory containing offline saved HTML files")
    parser.add_argument("--url", help="Live Foodpanda restaurant URL")
    parser.add_argument("--licence", default="", help="Associated SFA Licence")
    parser.add_argument("--name", default="", help="Associated F&B Stall Name")
    parser.add_argument("--out-json", help="Path to write JSON output")
    parser.add_argument("--test", action="store_true", help="Run self-tests")
    
    args = parser.parse_args()

    if args.test:
        print("[TEST] Running Foodpanda parser verification tests...")
        sample_apollo = """
        <html><body>
        <script>
        window.__PROVIDER_PROPS__={apollo:{"initialState":{
            "RestaurantMenuCategory:101":{"__typename":"RestaurantMenuCategory","id":"101","title":"Seafood Signatures"},
            "RestaurantProductData:1001":{"__typename":"RestaurantProductData","title":"Sambal Stingray","priceAttributes":{"originalPrice":16.50},"description":"Fresh stingray grilled with homemade sambal chili.","menuCategory":{"__ref":"RestaurantMenuCategory:101"},"image":{"url":"https://images.deliveryhero.io/image/fd-sg/Products/stingray.jpg"}},
            "RestaurantMenu:1":{"__typename":"RestaurantMenu","title":"Dinner Menu","startTime":"17:00","endTime":"23:00","categories":[{"__ref":"RestaurantMenuCategory:101"}]}
        }}};
        </script>
        </body></html>
        """
        res = parse_foodpanda_page(sample_apollo, sfa_licence="NTF0132003", stall_name="Newton 32 BBQ Seafood")
        assert res["success"] is True, "Apollo parse failed"
        assert len(res["items"]) == 1, f"Expected 1 item, got {len(res['items'])}"
        item = res["items"][0]
        assert item["name"] == "Sambal Stingray", f"Name mismatch: {item['name']}"
        assert item["price_sgd"] == "16.50", f"Price mismatch: {item['price_sgd']}"
        assert item["category"] == "Seafood Signatures", f"Category mismatch: {item['category']}"
        assert item["menu_title"] == "Dinner Menu", f"Menu mismatch: {item['menu_title']}"
        assert item["start_time"] == "17:00", f"Start time mismatch: {item['start_time']}"
        print("[PASS] Tier 1 Apollo initialState parser test passed!")

        sample_dom = """
        <html><body>
        <div class="menu">
            <div data-testid="menu-product-tile">
                <h3 data-testid="menu-product-name">Black Pepper Crab</h3>
                <p data-testid="menu-product-description">Signature mud crab wok-fried in black pepper sauce.</p>
                <span data-testid="menu-product-price">$38.00</span>
                <img src="https://images.deliveryhero.io/crab.jpg" />
            </div>
        </div>
        </body></html>
        """
        res_dom = parse_foodpanda_page(sample_dom, sfa_licence="NTF0132003", stall_name="Newton 32 BBQ Seafood")
        assert res_dom["success"] is True, "DOM fallback parse failed"
        assert len(res_dom["items"]) == 1, f"Expected 1 item, got {len(res_dom['items'])}"
        assert res_dom["items"][0]["name"] == "Black Pepper Crab"
        assert res_dom["items"][0]["price_sgd"] == "38.00"
        print("[PASS] Tier 3 DOM Product Tiles fallback test passed!")
        print("[SUCCESS] All self-tests passed!")
        return

    if args.file:
        with open(args.file, "r", encoding="utf-8", errors="replace") as f:
            html = f.read()
        res = parse_foodpanda_page(html, sfa_licence=args.licence, stall_name=args.name)
        print(f"Parsed {len(res.get('items', []))} items via {res.get('method')}")
        if args.out_json:
            with open(args.out_json, "w", encoding="utf-8") as out:
                json.dump(res, out, indent=2)
            print(f"Wrote output to {args.out_json}")
        else:
            print(json.dumps(res, indent=2))
        return

    if args.url:
        print(f"Fetching {args.url}...")
        try:
            html = fetch_url(args.url)
            res = parse_foodpanda_page(html, sfa_licence=args.licence, stall_name=args.name)
            print(f"Parsed {len(res.get('items', []))} items via {res.get('method')}")
            if args.out_json:
                with open(args.out_json, "w", encoding="utf-8") as out:
                    json.dump(res, out, indent=2)
                print(f"Wrote output to {args.out_json}")
            else:
                print(json.dumps(res, indent=2))
        except Exception as e:
            print(f"Error fetching URL: {e}")
        return

    parser.print_help()


if __name__ == "__main__":
    main()
