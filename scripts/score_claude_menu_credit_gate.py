#!/usr/bin/env python3
"""Score the Claude synchronous menu pilot before opening the scale queue."""

import argparse
import csv
import json
from pathlib import Path
import sys


HELD_PRICE = {"INSUFFICIENT", "NOT_APPLICABLE"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--expected", type=Path, required=True)
    parser.add_argument("--results", type=Path, required=True)
    parser.add_argument("--master-sha256", required=True)
    args = parser.parse_args()

    with args.expected.open(encoding="utf-8-sig", newline="") as source:
        expected_rows = list(csv.DictReader(source))
    expected = {row["record_id"]: row for row in expected_rows}
    if not expected or len(expected) != len(expected_rows):
        raise ValueError("Expected records must be nonempty and unique.")

    results = {}
    with args.results.open(encoding="utf-8") as source:
        for line in source:
            row = json.loads(line)
            key = row["record_id"]
            if key not in expected:
                continue
            if key in results or row["master_sha256"] != args.master_sha256:
                raise ValueError(f"Duplicate result or master hash mismatch for {key}.")
            results[key] = row

    blockers = 0
    safe_label_differences = 0
    for key, target in expected.items():
        row = results.get(key, {})
        assessment = row.get("model_assessment") or {}
        outlet = assessment.get("outlet_status")
        price = assessment.get("price_status")
        allowed_prices = set(target["expected_price_status"].split(" or "))
        if row.get("review_status") != "REVIEW_REQUIRED":
            outcome = row.get("review_status", "MISSING")
            blockers += 1
        elif outlet != target["expected_outlet_status"]:
            outcome = "OUTLET_MISMATCH"
            blockers += 1
        elif price in allowed_prices:
            outcome = "PASS"
        elif price in HELD_PRICE and allowed_prices <= HELD_PRICE:
            outcome = "SAFE_PRICE_LABEL_DIFFERENCE"
            safe_label_differences += 1
        else:
            outcome = "PRICE_MISMATCH"
            blockers += 1
        print(f"{key}: {outcome} (outlet={outlet}, price={price})")
    print(f"{len(expected)} controls; {blockers} blockers; {safe_label_differences} safe price-label differences.")
    return int(bool(blockers))


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f"Cannot score the quality gate: {error}", file=sys.stderr)
        sys.exit(1)
