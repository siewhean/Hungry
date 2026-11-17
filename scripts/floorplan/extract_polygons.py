#!/usr/bin/env python3
"""Extract candidate stall polygons from rectified floorplan images."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List, Tuple

import cv2  # type: ignore
import numpy as np

from common import clamp, dedupe_polygon, polygon_area, polygon_bbox, write_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract candidate polygons from rectified floorplan")
    parser.add_argument("--rectified", required=True, help="Path to rectified image")
    parser.add_argument("--meta", required=True, help="Path to prep metadata json")
    parser.add_argument("--out", required=True, help="Output raw polygon json")
    parser.add_argument("--min-area-ratio", type=float, default=0.0015)
    parser.add_argument("--max-area-ratio", type=float, default=0.08)
    parser.add_argument("--vertex-snap-tolerance", type=float, default=4.0)
    parser.add_argument("--profile", choices=["default", "thin-lines"], default="default")
    parser.add_argument("--block-size", type=int, default=31)
    parser.add_argument("--threshold-c", type=int, default=3)
    parser.add_argument("--line-close-kernel", type=int, default=3)
    parser.add_argument("--line-close-iters", type=int, default=2)
    parser.add_argument("--dilate-iters", type=int, default=1)
    parser.add_argument("--retr-mode", choices=["external", "tree"], default="tree")
    parser.add_argument("--min-vertices", type=int, default=4)
    parser.add_argument("--text-mask", choices=["none", "mser"], default="mser")
    parser.add_argument("--orthogonal-snap-deg", type=float, default=12.0)
    parser.add_argument("--tenant-hsv-low", default="5,30,80")
    parser.add_argument("--tenant-hsv-high", default="35,210,255")
    return parser.parse_args()


def classify_kind(area_ratio: float, bbox: Tuple[float, float, float, float], canvas: Dict[str, int]) -> str:
    _, _, max_x, max_y = bbox
    width = max(1.0, bbox[2] - bbox[0])
    height = max(1.0, bbox[3] - bbox[1])
    aspect = max(width / height, height / width)

    if area_ratio > 0.04 or aspect > 10.0:
        return "corridor"
    if max_x > canvas["width"] * 0.75 and max_y > canvas["height"] * 0.7:
        return "facility"
    return "tenant"


def contour_to_polygon(contour: np.ndarray, profile: str) -> List[Tuple[float, float]]:
    perimeter = cv2.arcLength(contour, True)
    if profile == "thin-lines":
        epsilon = clamp(perimeter * 0.004, 1.0, perimeter * 0.012)
    else:
        epsilon = clamp(perimeter * 0.008, 2.0, perimeter * 0.02)
    approx = cv2.approxPolyDP(contour, epsilon, True)
    points = [(float(p[0][0]), float(p[0][1])) for p in approx]
    return dedupe_polygon(points, min_edge_len=1.5 if profile == "thin-lines" else 2.0)


def parse_hsv(text: str) -> Tuple[int, int, int]:
    parts = [int(p.strip()) for p in text.split(",")]
    if len(parts) != 3:
        raise ValueError("HSV bounds must be H,S,V")
    return parts[0], parts[1], parts[2]


def mask_text_regions(gray: np.ndarray) -> np.ndarray:
    # MSER captures clustered high-contrast glyph regions.
    mser = cv2.MSER_create()
    mser.setMinArea(30)
    mser.setMaxArea(3000)
    regions, _ = mser.detectRegions(gray)
    mask = np.zeros(gray.shape[:2], dtype=np.uint8)
    for region in regions:
        hull = cv2.convexHull(region.reshape(-1, 1, 2))
        x, y, w, h = cv2.boundingRect(hull)
        area = float(w * h)
        if area < 60 or area > 8000:
            continue
        aspect = w / max(float(h), 1.0)
        if 0.15 <= aspect <= 8.0:
            cv2.rectangle(mask, (x, y), (x + w, y + h), 255, -1)
    mask = cv2.dilate(mask, np.ones((3, 3), np.uint8), iterations=1)
    return mask


def orthogonalize_polygon(poly: List[Tuple[float, float]], snap_deg: float) -> List[Tuple[float, float]]:
    if len(poly) < 4:
        return poly
    out: List[Tuple[float, float]] = [poly[0]]
    for i in range(1, len(poly)):
        px, py = out[-1]
        x, y = poly[i]
        dx, dy = x - px, y - py
        angle = np.degrees(np.arctan2(dy, dx))
        targets = [0.0, 90.0, 180.0, -90.0, -180.0]
        nearest = min(targets, key=lambda a: abs(a - angle))
        if abs(nearest - angle) <= snap_deg:
            length = float(np.hypot(dx, dy))
            rad = np.radians(nearest)
            x = px + length * float(np.cos(rad))
            y = py + length * float(np.sin(rad))
        out.append((x, y))
    return dedupe_polygon(out, min_edge_len=2.0)


def main() -> None:
    args = parse_args()
    rectified_path = Path(args.rectified)
    meta_path = Path(args.meta)
    out_path = Path(args.out)

    if not rectified_path.exists():
        raise RuntimeError(
            f"Rectified image not found: {rectified_path}. Run prepare_floorplan.py first."
        )
    if not meta_path.exists():
        raise RuntimeError(f"Metadata file not found: {meta_path}. Run prepare_floorplan.py first.")

    with meta_path.open("r", encoding="utf-8") as fh:
        meta = json.load(fh)

    color = cv2.imread(str(rectified_path), cv2.IMREAD_COLOR)
    if color is None:
        raise RuntimeError(f"Unable to read rectified image: {rectified_path}")
    image = cv2.cvtColor(color, cv2.COLOR_BGR2GRAY)

    if args.profile == "thin-lines":
        blurred = cv2.GaussianBlur(image, (3, 3), 0)
        block_size = 41
        c_val = 2
        close_kernel = 3
        close_iters = 3
        dilate_iters = 1
    else:
        blurred = cv2.GaussianBlur(image, (5, 5), 0)
        block_size = args.block_size
        c_val = args.threshold_c
        close_kernel = args.line_close_kernel
        close_iters = args.line_close_iters
        dilate_iters = args.dilate_iters

    threshold = cv2.adaptiveThreshold(
        blurred,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        block_size,
        c_val,
    )
    kernel = np.ones((close_kernel, close_kernel), dtype=np.uint8)
    cleaned = cv2.morphologyEx(threshold, cv2.MORPH_CLOSE, kernel, iterations=close_iters)
    if dilate_iters > 0:
        cleaned = cv2.dilate(cleaned, kernel, iterations=dilate_iters)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, np.ones((2, 2), dtype=np.uint8), iterations=1)

    # Color segmentation to isolate tenant-like fills from corridors/background.
    hsv = cv2.cvtColor(color, cv2.COLOR_BGR2HSV)
    low = np.array(parse_hsv(args.tenant_hsv_low), dtype=np.uint8)
    high = np.array(parse_hsv(args.tenant_hsv_high), dtype=np.uint8)
    tenant_mask = cv2.inRange(hsv, low, high)
    tenant_mask = cv2.morphologyEx(tenant_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
    tenant_mask = cv2.morphologyEx(tenant_mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8), iterations=1)

    # Remove text influence before contour tracing.
    if args.text_mask == "mser":
        text_mask = mask_text_regions(image)
        tenant_mask[text_mask > 0] = 0
        cleaned[text_mask > 0] = 0

    # Keep only regions supported by both structure and color.
    cleaned = cv2.bitwise_and(cleaned, tenant_mask)

    retrieval = cv2.RETR_TREE if args.retr_mode == "tree" else cv2.RETR_EXTERNAL
    contours, _ = cv2.findContours(cleaned, retrieval, cv2.CHAIN_APPROX_SIMPLE)
    canvas_w = int(meta["canvas"]["width"])
    canvas_h = int(meta["canvas"]["height"])
    canvas_area = float(canvas_w * canvas_h)

    candidates: List[Dict[str, object]] = []
    debug = {"contoursTotal": len(contours), "kept": 0, "dropped": 0}

    for idx, contour in enumerate(contours):
        x, y, w, h = cv2.boundingRect(contour)
        touches_border = x <= 1 or y <= 1 or (x + w) >= canvas_w - 1 or (y + h) >= canvas_h - 1
        bbox_area_ratio = (w * h) / canvas_area
        if touches_border and bbox_area_ratio > 0.20:
            debug["dropped"] += 1
            continue

        poly = contour_to_polygon(contour, args.profile)
        poly = orthogonalize_polygon(poly, args.orthogonal_snap_deg)
        if len(poly) < args.min_vertices:
            debug["dropped"] += 1
            continue
        area = polygon_area(poly)
        area_ratio = area / canvas_area
        if area_ratio < args.min_area_ratio or area_ratio > args.max_area_ratio:
            debug["dropped"] += 1
            continue

        bbox = polygon_bbox(poly)
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        aspect = max(width / max(height, 1.0), height / max(width, 1.0))
        if aspect > 18.0 and area_ratio < 0.002:
            debug["dropped"] += 1
            continue

        kind = classify_kind(area_ratio, bbox, {"width": canvas_w, "height": canvas_h})
        candidates.append(
            {
                "id": f"poly-{idx + 1:03d}",
                "unitNumber": "",
                "polygon": [[round(x, 2), round(y, 2)] for x, y in poly],
                "kind": kind,
                "label": None,
                "facilityType": "service" if kind == "facility" else None,
                "area": round(area, 2),
                "areaRatio": round(area_ratio, 6),
                "bbox": [round(v, 2) for v in bbox],
            }
        )
        debug["kept"] += 1

    payload = {
        "schemaVersion": "floorplan-raw-polygons.v1",
        "buildingId": meta["buildingId"],
        "floor": meta["floor"],
        "canvas": meta["canvas"],
        "inputRectifiedPath": str(rectified_path),
        "debug": debug,
        "candidates": candidates,
    }
    write_json(out_path, payload)
    print(f"Extracted candidates: {len(candidates)}")
    print(f"Raw output: {out_path}")


if __name__ == "__main__":
    main()
