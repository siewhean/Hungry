#!/usr/bin/env python3
"""Map extracted floorplan unit numbers to venue IDs with unresolved reporting."""

from __future__ import annotations

import argparse
import csv
from pathlib import Path
from typing import Dict, List, Tuple

from common import normalize_unit, read_json, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Map floorplan unit numbers to venue IDs")
    parser.add_argument("--in", dest="input_path", required=True, help="Path to .hungry.json")
    parser.add_argument(
        "--mapping-csv",
        required=True,
        help="CSV path with headers: unit_number,venue_id",
    )
    parser.add_argument("--out", required=True, help="Output mapped .hungry.json")
    parser.add_argument("--report", required=True, help="Output unresolved report json")
    return parser.parse_args()


def load_mapping(path: Path) -> Dict[str, List[str]]:
    mapping: Dict[str, List[str]] = {}
    with path.open("r", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            unit = normalize_unit(str(row.get("unit_number", "")))
            venue = str(row.get("venue_id", "")).strip()
            if not unit or not venue:
                continue
            mapping.setdefault(unit, []).append(venue)
    return mapping


def resolve_unit(mapping: Dict[str, List[str]], unit_number: str) -> Tuple[str | None, str | None]:
    key = normalize_unit(unit_number)
    venues = mapping.get(key, [])
    if not venues:
        return None, "missing_unit"
    uniq = sorted(set(venues))
    if len(uniq) > 1:
        return None, "ambiguous_match"
    return uniq[0], None


def main() -> None:
    args = parse_args()
    payload = read_json(Path(args.input_path))
    mapping = load_mapping(Path(args.mapping_csv))
    stalls = payload.get("stalls", [])
    if not isinstance(stalls, list):
        raise RuntimeError("Invalid hungry payload: stalls must be a list")

    unresolved: List[Dict[str, str]] = []
    mapped_count = 0
    tenant_count = 0

    for stall in stalls:
        kind = str(stall.get("kind", "tenant"))
        if kind != "tenant":
            continue
        tenant_count += 1
        unit_number = str(stall.get("unitNumber", "")).strip()
        if not unit_number:
            unresolved.append({"id": str(stall.get("id")), "reason": "missing_unit_number"})
            continue

        venue_id, reason = resolve_unit(mapping, unit_number)
        if reason:
            unresolved.append({"id": str(stall.get("id")), "unitNumber": unit_number, "reason": reason})
            continue
        stall["venueId"] = venue_id
        mapped_count += 1

    coverage = 0.0 if tenant_count == 0 else mapped_count / tenant_count
    report = {
        "schemaVersion": "floorplan-mapping-report.v1",
        "buildingId": payload.get("buildingId"),
        "floor": payload.get("floor"),
        "tenantCount": tenant_count,
        "mappedCount": mapped_count,
        "mappingCoverage": round(coverage, 4),
        "unresolved": unresolved,
    }

    write_json(Path(args.out), payload)
    write_json(Path(args.report), report)

    print(f"Mapped tenants: {mapped_count}/{tenant_count} ({coverage * 100:.1f}%)")
    print(f"Unresolved: {len(unresolved)}")


if __name__ == "__main__":
    main()
