#!/usr/bin/env python3
"""Copy the approved brand logos into Supabase Storage and write the venue -> logo CSV.

Reads logo_url_to_use (foodpanda first, else final_logo_url) from the Candidates sheet,
downloads each logo, keeps only PNG/JPEG/WebP/GIF up to 2 MB, uploads it to the public
`brand-logos` bucket, and writes:
  /tmp/brand_logo_venues.csv          venue_id,logo_url  (input for apply_brand_logos.sql)
  data/stall_logos/brand_logo_upload_report.csv   one row per brand with the outcome

Needs EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
Usage: python3 scripts/upload_brand_logos.py [--limit N]
"""
import argparse
import concurrent.futures
import csv
import hashlib
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

import openpyxl

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHEET = ROOT / "data/stall_logos/stall-logo-candidates-foodpanda-first.xlsx"
REPORT = ROOT / "data/stall_logos/brand_logo_upload_report.csv"
VENUE_CSV = pathlib.Path("/tmp/brand_logo_venues.csv")
BUCKET = "brand-logos"
EXPECTED_REF = "frluxwpqqyomiqmjzavd"
MAX_BYTES = 2 * 1024 * 1024
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Safari/605.1.15"


def load_env():
    env = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        m = re.match(r"\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$", line)
        if m:
            env[m.group(1)] = m.group(2).strip().strip("'\"")
    return env


def sniff(data):
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png", "image/png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpg", "image/jpeg"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp", "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif", "image/gif"
    return None, None


def request(url, data=None, headers=None, method=None, timeout=30):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read(MAX_BYTES + 1)


def ensure_bucket(base, key):
    body = json.dumps({
        "id": BUCKET, "name": BUCKET, "public": True, "file_size_limit": MAX_BYTES,
        "allowed_mime_types": ["image/png", "image/jpeg", "image/webp", "image/gif"],
    }).encode()
    headers = {"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": "application/json"}
    try:
        request(f"{base}/storage/v1/bucket", body, headers, "POST")
        print(f"created bucket {BUCKET}")
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")
        if e.code in (400, 409) and "exist" in text.lower():
            print(f"bucket {BUCKET} already exists")
        else:
            sys.exit(f"could not create bucket: {e.code} {text}")


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:60] or "brand"


def process(row, base, key):
    brand_key, url = row["brand_key"], row["logo_url_to_use"]
    out = {"brand_key": brand_key, "brand_name": row["brand_name"], "source": row["source"],
           "source_url": url, "status": "", "logo_url": "", "venues": len(row["venue_ids"])}
    try:
        _, data = request(url, headers={"User-Agent": UA, "Accept": "image/*"})
    except Exception as e:  # network errors are reported per brand, not fatal
        out["status"] = f"download_failed: {getattr(e, 'code', '') or e}"
        return out
    if len(data) > MAX_BYTES:
        out["status"] = "too_large"
        return out
    ext, mime = sniff(data)
    if not ext:
        out["status"] = "not_png_jpeg_webp_gif"
        return out
    path = f"{slug(brand_key)}-{hashlib.sha1(data).hexdigest()[:8]}.{ext}"
    headers = {"Authorization": f"Bearer {key}", "apikey": key, "Content-Type": mime,
               "x-upsert": "true", "Cache-Control": "max-age=31536000"}
    try:
        request(f"{base}/storage/v1/object/{BUCKET}/{path}", data, headers, "POST")
    except urllib.error.HTTPError as e:
        out["status"] = f"upload_failed: {e.code} {e.read()[:200].decode(errors='replace')}"
        return out
    out["status"] = "uploaded"
    out["logo_url"] = f"{base}/storage/v1/object/public/{BUCKET}/{path}"
    return out


def read_rows():
    ws = openpyxl.load_workbook(SHEET, read_only=True)["Candidates"]
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    idx = {name: header.index(name) for name in
           ("venue_ids_or_brand", "brand_name", "brand_key", "logo_url_to_use", "logo_url_to_use_source")}
    for r in rows:
        url = (r[idx["logo_url_to_use"]] or "").strip()
        if not url.startswith("http"):
            continue
        venue_ids = [v.strip() for v in str(r[idx["venue_ids_or_brand"]] or "").split(";") if v.strip().startswith("ven-")]
        yield {"brand_key": str(r[idx["brand_key"]]), "brand_name": r[idx["brand_name"]], "logo_url_to_use": url,
               "source": r[idx["logo_url_to_use_source"]], "venue_ids": venue_ids}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, help="only process the first N brands (test run)")
    args = ap.parse_args()

    env = load_env()
    base = env.get("EXPO_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if EXPECTED_REF not in base or not key:
        sys.exit(f"stopping: .env.local must point at {EXPECTED_REF} and have SUPABASE_SERVICE_ROLE_KEY")

    rows = list(read_rows())[: args.limit]
    print(f"{len(rows)} brands with a logo to copy")
    ensure_bucket(base, key)

    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for i, out in enumerate(pool.map(lambda r: process(r, base, key), rows), 1):
            results.append(out)
            if i % 200 == 0:
                print(f"  {i}/{len(rows)}")

    with REPORT.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(results[0].keys()))
        w.writeheader()
        w.writerows(results)

    seen = set()
    with VENUE_CSV.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["venue_id", "logo_url"])
        for row, out in zip(rows, results):
            if out["status"] != "uploaded":
                continue
            for venue_id in row["venue_ids"]:
                if venue_id not in seen:
                    seen.add(venue_id)
                    w.writerow([venue_id, out["logo_url"]])

    statuses = {}
    for out in results:
        statuses[out["status"].split(":")[0]] = statuses.get(out["status"].split(":")[0], 0) + 1
    print("brands by outcome:", statuses)
    print(f"{len(seen)} venues written to {VENUE_CSV}; report at {REPORT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
