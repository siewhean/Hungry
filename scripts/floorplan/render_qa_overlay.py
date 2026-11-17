#!/usr/bin/env python3
"""Render visual QA overlay for validated floorplan polygons."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List, Tuple

import cv2  # type: ignore
import numpy as np

from common import read_json


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Render floorplan QA overlay")
    parser.add_argument("--in", dest="input_path", required=True, help="Validated polygons JSON")
    parser.add_argument("--image", required=True, help="Rectified image path")
    parser.add_argument("--out", required=True, help="Overlay output png")
    return parser.parse_args()


def color_for_kind(kind: str) -> Tuple[int, int, int]:
    if kind == "tenant":
        return (74, 163, 80)  # green-ish
    if kind == "corridor":
        return (126, 126, 126)  # gray
    if kind == "facility":
        return (59, 130, 246)  # blue
    return (239, 68, 68)  # red for unknown


def draw_polygon(canvas: np.ndarray, polygon: List[List[float]], color: Tuple[int, int, int]) -> None:
    points = np.array([[[int(round(x)), int(round(y))] for x, y in polygon]], dtype=np.int32)
    cv2.polylines(canvas, points, True, color, 2)


def centroid(points: List[List[float]]) -> Tuple[int, int]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return int(sum(xs) / max(1, len(xs))), int(sum(ys) / max(1, len(ys)))


def main() -> None:
    args = parse_args()
    input_path = Path(args.input_path)
    image_path = Path(args.image)
    if not input_path.exists():
        raise RuntimeError(
            f"Validated polygons file not found: {input_path}. "
            "Run score_validate_polygons.py first."
        )
    if not image_path.exists():
        raise RuntimeError(
            f"Rectified image file not found: {image_path}. Run prepare_floorplan.py first."
        )

    payload = read_json(input_path)
    polygons = payload.get("validatedPolygons", [])
    if not isinstance(polygons, list):
        raise RuntimeError("Invalid input: validatedPolygons is not a list")

    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError(f"Unable to load source image: {args.image}")

    overlay = image.copy()
    legend_counts: Dict[str, int] = {"tenant": 0, "corridor": 0, "facility": 0, "other": 0}
    for polygon in polygons:
        points = polygon.get("polygon", [])
        if not points:
            continue
        kind = str(polygon.get("kind", "other"))
        color = color_for_kind(kind)
        draw_polygon(overlay, points, color)
        cx, cy = centroid(points)
        label = str(polygon.get("unitNumber") or polygon.get("id") or "?")
        confidence = polygon.get("confidence")
        conf_text = f"{confidence:.2f}" if isinstance(confidence, (int, float)) else "--"
        cv2.putText(
            overlay,
            f"{label} ({conf_text})",
            (cx - 24, cy),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.35,
            color,
            1,
            cv2.LINE_AA,
        )
        legend_counts[kind if kind in legend_counts else "other"] += 1

    blended = cv2.addWeighted(overlay, 0.75, image, 0.25, 0)

    legend_y = 20
    cv2.rectangle(blended, (8, 8), (320, 96), (255, 255, 255), -1)
    cv2.putText(
        blended, "Floorplan QA Overlay", (16, legend_y + 4), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1
    )
    legend_y += 24
    for label, color in [("tenant", color_for_kind("tenant")), ("corridor", color_for_kind("corridor")), ("facility", color_for_kind("facility"))]:
        cv2.rectangle(blended, (16, legend_y - 10), (30, legend_y + 2), color, -1)
        cv2.putText(
            blended,
            f"{label}: {legend_counts.get(label, 0)}",
            (36, legend_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.42,
            (0, 0, 0),
            1,
            cv2.LINE_AA,
        )
        legend_y += 20

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out_path), blended)
    print(f"Overlay written: {out_path}")


if __name__ == "__main__":
    main()
