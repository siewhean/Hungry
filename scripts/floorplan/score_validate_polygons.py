#!/usr/bin/env python3
"""Validate extracted floorplan polygons and score confidence."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import cv2  # type: ignore
import numpy as np

from common import clamp, polygon_area, read_json, write_json

Point = Tuple[float, float]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score and validate extracted polygons")
    parser.add_argument("--in", dest="input_path", required=True, help="Raw polygon JSON")
    parser.add_argument("--out", required=True, help="Validated polygon JSON")
    parser.add_argument("--report", required=True, help="Validation report JSON")
    parser.add_argument("--overlap-hard-fail", type=float, default=0.05)
    parser.add_argument(
        "--profile",
        choices=["default", "floorplan_pdf"],
        default="default",
        help="Validation profile. floorplan_pdf relaxes confidence thresholds for thin-line PDFs.",
    )
    parser.add_argument("--auto-accept-threshold", type=float, default=0.80)
    parser.add_argument("--manual-review-threshold", type=float, default=0.60)
    parser.add_argument("--min-area-ratio-hard-reject", type=float, default=0.00022)
    parser.add_argument("--max-area-ratio-hard-reject", type=float, default=0.12)
    return parser.parse_args()


def orientation(a: Point, b: Point, c: Point) -> int:
    value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1])
    if abs(value) < 1e-9:
        return 0
    return 1 if value > 0 else 2


def on_segment(a: Point, b: Point, c: Point) -> bool:
    return min(a[0], c[0]) <= b[0] <= max(a[0], c[0]) and min(a[1], c[1]) <= b[1] <= max(
        a[1], c[1]
    )


def intersects(p1: Point, q1: Point, p2: Point, q2: Point) -> bool:
    o1 = orientation(p1, q1, p2)
    o2 = orientation(p1, q1, q2)
    o3 = orientation(p2, q2, p1)
    o4 = orientation(p2, q2, q1)

    if o1 != o2 and o3 != o4:
        return True
    if o1 == 0 and on_segment(p1, p2, q1):
        return True
    if o2 == 0 and on_segment(p1, q2, q1):
        return True
    if o3 == 0 and on_segment(p2, p1, q2):
        return True
    if o4 == 0 and on_segment(p2, q1, q2):
        return True
    return False


def is_self_intersecting(points: Sequence[Point]) -> bool:
    if len(points) < 4:
        return False
    edges = []
    for i in range(len(points)):
        edges.append((points[i], points[(i + 1) % len(points)]))
    for i, (a1, a2) in enumerate(edges):
        for j, (b1, b2) in enumerate(edges):
            if abs(i - j) <= 1:
                continue
            if i == 0 and j == len(edges) - 1:
                continue
            if j == 0 and i == len(edges) - 1:
                continue
            if intersects(a1, a2, b1, b2):
                return True
    return False


def to_np_poly(points: Sequence[Point]) -> np.ndarray:
    return np.array([[[int(round(x)), int(round(y))] for x, y in points]], dtype=np.int32)


def overlap_ratio(
    points_a: Sequence[Point], points_b: Sequence[Point], canvas_w: int, canvas_h: int
) -> float:
    mask_a = np.zeros((canvas_h, canvas_w), dtype=np.uint8)
    mask_b = np.zeros((canvas_h, canvas_w), dtype=np.uint8)
    cv2.fillPoly(mask_a, to_np_poly(points_a), 255)
    cv2.fillPoly(mask_b, to_np_poly(points_b), 255)
    intersection = cv2.bitwise_and(mask_a, mask_b)
    area_intersection = float(cv2.countNonZero(intersection))
    if area_intersection <= 0:
        return 0.0
    area_a = float(cv2.countNonZero(mask_a))
    area_b = float(cv2.countNonZero(mask_b))
    return area_intersection / max(1.0, min(area_a, area_b))


def confidence_score(candidate: Dict[str, object], profile: str = "default") -> float:
    area_ratio = float(candidate.get("areaRatio", 0.0))
    kind = str(candidate.get("kind", "tenant"))
    has_label = bool(candidate.get("unitNumber"))

    if profile == "floorplan_pdf":
        if area_ratio < 0.00022:
            area_prior = 0.10
        elif area_ratio < 0.00045:
            area_prior = 0.45
        elif area_ratio <= 0.006:
            area_prior = 0.95
        elif area_ratio <= 0.020:
            area_prior = 0.80
        elif area_ratio <= 0.045:
            area_prior = 0.55
        else:
            area_prior = 0.20

        enclosure = 0.88 if area_ratio >= 0.00045 else 0.55
        boundary_clarity = 0.72
        orthogonality = 0.70 if kind == "tenant" else 0.78
        label_match = 0.52 if has_label else 0.38
        score = (
            0.26 * enclosure
            + 0.18 * boundary_clarity
            + 0.34 * area_prior
            + 0.10 * orthogonality
            + 0.12 * label_match
        )
    else:
        enclosure = 0.8 if area_ratio > 0.002 else 0.45
        boundary_clarity = 0.78
        area_prior = 1.0 - min(abs(area_ratio - 0.01) / 0.01, 1.0)
        orthogonality = 0.82 if kind != "tenant" else 0.7
        label_match = 0.5 if has_label else 0.35
        score = (
            0.30 * enclosure
            + 0.20 * boundary_clarity
            + 0.20 * area_prior
            + 0.15 * orthogonality
            + 0.15 * label_match
        )
    return clamp(score, 0.0, 1.0)


def main() -> None:
    args = parse_args()
    input_path = Path(args.input_path)
    if not input_path.exists():
        raise RuntimeError(
            f"Raw polygon file not found: {input_path}. Run extract_polygons.py first."
        )
    payload = read_json(input_path)
    candidates = payload.get("candidates", [])
    if not isinstance(candidates, list):
        raise RuntimeError("Invalid input: candidates must be a list")

    canvas_w = int(payload["canvas"]["width"])
    canvas_h = int(payload["canvas"]["height"])

    validated: List[Dict[str, object]] = []
    unresolved: List[Dict[str, object]] = []
    hard_fail_overlap = 0

    auto_accept_threshold = args.auto_accept_threshold
    manual_review_threshold = args.manual_review_threshold
    if args.profile == "floorplan_pdf":
        auto_accept_threshold = min(auto_accept_threshold, 0.74)
        manual_review_threshold = min(manual_review_threshold, 0.52)

    for candidate in candidates:
        polygon = candidate.get("polygon", [])
        points = [(float(p[0]), float(p[1])) for p in polygon]
        reasons: List[str] = []
        if len(points) < 3:
            reasons.append("too_few_vertices")
        if polygon_area(points) <= 0:
            reasons.append("degenerate_area")
        if is_self_intersecting(points):
            reasons.append("self_intersection")
        if any(x < 0 or y < 0 or x > canvas_w or y > canvas_h for x, y in points):
            reasons.append("out_of_bounds")

        area_ratio = float(candidate.get("areaRatio", 0.0))
        if area_ratio < args.min_area_ratio_hard_reject:
            reasons.append("area_too_small")
        if area_ratio > args.max_area_ratio_hard_reject:
            reasons.append("area_too_large")

        score = confidence_score(candidate, args.profile)
        candidate["confidence"] = round(score, 4)
        if score >= auto_accept_threshold:
            candidate["reviewState"] = "auto_accept"
        elif score >= manual_review_threshold:
            candidate["reviewState"] = "manual_review"
        else:
            candidate["reviewState"] = "reject"
            reasons.append("low_confidence")

        if reasons:
            unresolved.append({"id": candidate.get("id"), "reasons": reasons, "confidence": score})
            continue
        validated.append(candidate)

    # tenant overlap guardrail
    overlap_reject_ids = set()
    for i, left in enumerate(validated):
        if left.get("kind") != "tenant":
            continue
        left_points = [(float(p[0]), float(p[1])) for p in left.get("polygon", [])]
        for right in validated[i + 1 :]:
            if right.get("kind") != "tenant":
                continue
            right_points = [(float(p[0]), float(p[1])) for p in right.get("polygon", [])]
            overlap = overlap_ratio(left_points, right_points, canvas_w, canvas_h)
            if overlap > args.overlap_hard_fail:
                hard_fail_overlap += 1
                left_area = float(left.get("area", 0.0))
                right_area = float(right.get("area", 0.0))
                reject_id = left.get("id") if left_area <= right_area else right.get("id")
                overlap_reject_ids.add(str(reject_id))
                unresolved.append(
                    {
                        "id": f"{left.get('id')}::{right.get('id')}",
                        "reasons": ["overlap_hard_fail"],
                        "overlapRatio": round(overlap, 6),
                    }
                )

    if overlap_reject_ids:
        validated = [c for c in validated if str(c.get("id")) not in overlap_reject_ids]

    result = {
        "schemaVersion": "floorplan-validated.v1",
        "buildingId": payload["buildingId"],
        "floor": payload["floor"],
        "canvas": payload["canvas"],
        "validatedPolygons": validated,
    }
    report = {
        "schemaVersion": "floorplan-validation-report.v1",
        "buildingId": payload["buildingId"],
        "floor": payload["floor"],
        "inputCandidateCount": len(candidates),
        "validatedCount": len(validated),
        "unresolvedCount": len(unresolved),
        "hardFailOverlapPairs": hard_fail_overlap,
        "profile": args.profile,
        "thresholds": {
            "autoAccept": auto_accept_threshold,
            "manualReview": manual_review_threshold,
        },
        "unresolved": unresolved,
    }
    write_json(Path(args.out), result)
    write_json(Path(args.report), report)
    print(f"Validated polygons: {len(validated)}")
    print(f"Unresolved polygons: {len(unresolved)}")


if __name__ == "__main__":
    main()
