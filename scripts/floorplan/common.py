#!/usr/bin/env python3
"""Shared helpers for floorplan CV extraction scripts."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Sequence, Tuple

Point = Tuple[float, float]
Polygon = List[Point]


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def read_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    ensure_parent(path)
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=True)
        fh.write("\n")


def polygon_area(points: Sequence[Point]) -> float:
    if len(points) < 3:
        return 0.0
    total = 0.0
    for idx, (x1, y1) in enumerate(points):
        x2, y2 = points[(idx + 1) % len(points)]
        total += x1 * y2 - x2 * y1
    return abs(total) * 0.5


def polygon_bbox(points: Sequence[Point]) -> Tuple[float, float, float, float]:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def dedupe_polygon(points: Sequence[Point], min_edge_len: float = 1.0) -> Polygon:
    if not points:
        return []
    deduped: Polygon = []
    for pt in points:
        if not deduped:
            deduped.append((float(pt[0]), float(pt[1])))
            continue
        prev = deduped[-1]
        dx = pt[0] - prev[0]
        dy = pt[1] - prev[1]
        if (dx * dx + dy * dy) ** 0.5 >= min_edge_len:
            deduped.append((float(pt[0]), float(pt[1])))
    if len(deduped) > 2:
        first = deduped[0]
        last = deduped[-1]
        dx = first[0] - last[0]
        dy = first[1] - last[1]
        if (dx * dx + dy * dy) ** 0.5 < min_edge_len:
            deduped.pop()
    return deduped


def clamp(value: float, lower: float, upper: float) -> float:
    return max(lower, min(upper, value))


def normalize_unit(unit: str) -> str:
    return unit.strip().upper().replace(" ", "")


def iter_alias_candidates(building_id: str, aliases: Dict[str, List[str]]) -> Iterable[str]:
    yield building_id
    for alias in aliases.get(building_id, []):
        yield alias
