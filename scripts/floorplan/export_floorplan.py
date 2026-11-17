#!/usr/bin/env python3
"""Export validated floorplan polygons to Hungry JSON and GeoJSON."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List

from common import read_json, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export floorplan polygons")
    parser.add_argument("--in", dest="input_path", required=True)
    parser.add_argument("--out-geojson", required=True)
    parser.add_argument("--out-hungry", required=True)
    parser.add_argument("--source-type", default="cv_extracted")
    parser.add_argument("--source-confidence", type=float, default=0.75)
    parser.add_argument("--verified", action="store_true")
    return parser.parse_args()


def ensure_closed(points: List[List[float]]) -> List[List[float]]:
    if not points:
        return points
    if points[0] != points[-1]:
        return [*points, points[0]]
    return points


def infer_outline(candidates: List[Dict[str, object]]) -> List[List[float]]:
    if not candidates:
        return []
    min_x = min(min(float(p[0]) for p in c["polygon"]) for c in candidates)
    min_y = min(min(float(p[1]) for p in c["polygon"]) for c in candidates)
    max_x = max(max(float(p[0]) for p in c["polygon"]) for c in candidates)
    max_y = max(max(float(p[1]) for p in c["polygon"]) for c in candidates)
    return [[min_x, min_y], [max_x, min_y], [max_x, max_y], [min_x, max_y]]


def main() -> None:
    args = parse_args()
    input_path = Path(args.input_path)
    if not input_path.exists():
        raise RuntimeError(
            f"Validated polygon file not found: {input_path}. Run score_validate_polygons.py first."
        )
    payload = read_json(input_path)
    validated = payload.get("validatedPolygons", [])
    if not isinstance(validated, list):
        raise RuntimeError("Invalid validated payload")

    building_id = str(payload["buildingId"])
    floor = str(payload["floor"])
    canvas = payload["canvas"]

    stalls = []
    features = []
    for idx, polygon in enumerate(validated):
        points = [[float(p[0]), float(p[1])] for p in polygon.get("polygon", [])]
        stall_id = str(polygon.get("id") or f"poly-{idx + 1:03d}")
        unit_number = str(polygon.get("unitNumber") or "")
        kind = str(polygon.get("kind") or "tenant")
        label = polygon.get("label")
        facility_type = polygon.get("facilityType")
        status_default = "non_food" if kind in {"corridor", "facility"} else "open"

        stalls.append(
            {
                "id": stall_id,
                "unitNumber": unit_number,
                "polygon": points,
                "kind": kind,
                "facilityType": facility_type,
                "label": label,
                "statusDefault": status_default,
                "confidence": polygon.get("confidence"),
                "reviewState": polygon.get("reviewState"),
            }
        )

        features.append(
            {
                "type": "Feature",
                "properties": {
                    "id": stall_id,
                    "unitNumber": unit_number,
                    "kind": kind,
                    "facilityType": facility_type,
                    "label": label,
                    "statusDefault": status_default,
                    "confidence": polygon.get("confidence"),
                    "reviewState": polygon.get("reviewState"),
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [ensure_closed(points)],
                },
            }
        )

    outline = infer_outline(stalls) if stalls else []
    hungry_payload = {
        "schemaVersion": "floorplan-source.v1",
        "buildingId": building_id,
        "floor": floor,
        "canvas": {"width": int(canvas["width"]), "height": int(canvas["height"])},
        "buildingOutline": {"polygon": outline, "label": f"{building_id} {floor} envelope"},
        "stalls": stalls,
        "meta": {
            "sourceType": args.source_type,
            "sourceConfidence": float(args.source_confidence),
            "verified": bool(args.verified),
            "updatedAt": "2026-04-29T00:00:00.000Z",
        },
    }
    geojson_payload = {
        "type": "FeatureCollection",
        "metadata": {
            "schemaVersion": "floorplan-source.v1",
            "buildingId": building_id,
            "floor": floor,
            "canvas": {"width": int(canvas["width"]), "height": int(canvas["height"])},
            "sourceType": args.source_type,
            "sourceConfidence": float(args.source_confidence),
            "verified": bool(args.verified),
            "updatedAt": "2026-04-29T00:00:00.000Z",
        },
        "features": features,
    }

    write_json(Path(args.out_hungry), hungry_payload)
    write_json(Path(args.out_geojson), geojson_payload)
    print(f"Hungry JSON written: {args.out_hungry}")
    print(f"GeoJSON written: {args.out_geojson}")


if __name__ == "__main__":
    main()
