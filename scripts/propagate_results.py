#!/usr/bin/env python3
"""Propagates maps scrape results to all rows sharing the same Google Maps CID."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INPUT_PATH = ROOT / "data" / "uris_to_check.json"
OUTPUT_PATH = ROOT / "data" / "scrape_results.json"

def main():
    if not INPUT_PATH.exists():
        print(f"Input file not found at {INPUT_PATH}.")
        return
    if not OUTPUT_PATH.exists():
        print(f"Results file not found at {OUTPUT_PATH}.")
        return

    print("Loading data...")
    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        uris_data = json.load(f)
    with open(OUTPUT_PATH, "r", encoding="utf-8") as f:
        results = json.load(f)

    # Map row_index to URI
    row_to_uri = {item["row_index"]: item["uri"] for item in uris_data}

    # Map URI to its verified result
    uri_to_result = {}
    conflicts = 0

    for res in results:
        row_idx = res["row_index"]
        uri = row_to_uri.get(row_idx)
        if not uri:
            continue

        is_valid = res.get("isValid")
        if is_valid in ["Yes", "No"]:
            # If we already have a result for this URI, check for conflicts
            if uri in uri_to_result:
                prev = uri_to_result[uri]
                if prev.get("isValid") != is_valid:
                    conflicts += 1
                    # Prioritize No (safer/invalid) or Yes (if it has image)
                    if is_valid == "No":
                        uri_to_result[uri] = res
            else:
                uri_to_result[uri] = res

    print(f"Loaded {len(results)} results.")
    print(f"Found {len(uri_to_result)} unique verified CIDs (Conflicts: {conflicts}).")

    # Propagate results
    unknown_before = 0
    resolved = 0
    unknown_after = 0

    updated_results = []
    results_map = {r["row_index"]: r for r in results}

    # Rebuild results list to ensure all rows are present and updated
    for item in uris_data:
        row_idx = item["row_index"]
        uri = item["uri"]

        res = results_map.get(row_idx)
        if not res:
            res = {"row_index": row_idx}

        is_valid = res.get("isValid")

        if is_valid not in ["Yes", "No"]:
            unknown_before += 1
            if uri in uri_to_result:
                matched = uri_to_result[uri]
                res["isValid"] = matched["isValid"]
                res["isClosed"] = matched.get("isClosed", "No")
                res["imageUrl"] = matched.get("imageUrl", "")
                resolved += 1
            else:
                unknown_after += 1

        updated_results.append(res)

    print(f"Unknown rows before propagation: {unknown_before}")
    print(f"Rows resolved by propagation: {resolved}")
    print(f"Unknown rows after propagation: {unknown_after}")

    # Count remaining unique CIDs
    remaining_uris = set()
    for item in uris_data:
        row_idx = item["row_index"]
        res = results_map.get(row_idx)
        is_valid = res.get("isValid") if res else None
        if is_valid not in ["Yes", "No"]:
            remaining_uris.add(item["uri"])
    print(f"Unique CIDs remaining to be scraped: {len(remaining_uris)}")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(updated_results, f, indent=2)
    print("Successfully saved updated scrape_results.json.")

if __name__ == "__main__":
    main()
