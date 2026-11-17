#!/usr/bin/env python3
"""Prepare floorplan source assets for polygon extraction.

Steps:
1. Load PDF/image.
2. Preprocess for line clarity.
3. Rectify perspective (auto quad detection or manual control points).
4. Emit rectified image + prep image + metadata.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List, Sequence, Tuple

import cv2  # type: ignore
import numpy as np

from common import ensure_parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prepare floorplan for extraction")
    parser.add_argument("--input", required=True, help="Input floorplan (.pdf/.png/.jpg)")
    parser.add_argument("--building-id", required=True)
    parser.add_argument("--floor", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--canvas-width", type=int, default=1000)
    parser.add_argument("--canvas-height", type=int, default=700)
    parser.add_argument("--control-points", help="Optional JSON file with 4 points [[x,y],...]")
    parser.add_argument(
        "--pdf-page",
        type=int,
        default=0,
        help="0-based page index for PDF input (default: 0)",
    )
    return parser.parse_args()


def load_pdf_page(path: Path, page_index: int) -> np.ndarray:
    try:
        import fitz  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "PDF input requires PyMuPDF (fitz). Install with: pip install pymupdf"
        ) from exc
    doc = fitz.open(path)
    if doc.page_count == 0:
        raise RuntimeError("PDF has no pages")
    if page_index < 0 or page_index >= doc.page_count:
        raise RuntimeError(
            f"PDF page index out of range: {page_index}. Valid range: 0..{doc.page_count - 1}"
        )
    page = doc.load_page(page_index)
    pix = page.get_pixmap(dpi=300, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    if pix.n == 4:
        img = cv2.cvtColor(img, cv2.COLOR_BGRA2BGR)
    elif pix.n == 3:
        img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    return img


def load_image(path: Path, pdf_page: int) -> np.ndarray:
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return load_pdf_page(path, pdf_page)
    img = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if img is None:
        raise RuntimeError(f"Unable to read input image: {path}")
    return img


def preprocess(gray: np.ndarray) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    denoised = cv2.bilateralFilter(enhanced, d=7, sigmaColor=50, sigmaSpace=50)
    thresholded = cv2.adaptiveThreshold(
        denoised,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        35,
        8,
    )
    kernel = np.ones((3, 3), dtype=np.uint8)
    closed = cv2.morphologyEx(thresholded, cv2.MORPH_CLOSE, kernel, iterations=1)
    opened = cv2.morphologyEx(closed, cv2.MORPH_OPEN, kernel, iterations=1)
    return opened


def order_quad(quad: Sequence[Tuple[float, float]]) -> np.ndarray:
    points = np.array(quad, dtype=np.float32)
    s = points.sum(axis=1)
    diff = np.diff(points, axis=1).reshape(-1)
    top_left = points[np.argmin(s)]
    bottom_right = points[np.argmax(s)]
    top_right = points[np.argmin(diff)]
    bottom_left = points[np.argmax(diff)]
    return np.array([top_left, top_right, bottom_right, bottom_left], dtype=np.float32)


def detect_quad(prep: np.ndarray) -> np.ndarray | None:
    edges = cv2.Canny(prep, 60, 180)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    contours = sorted(contours, key=cv2.contourArea, reverse=True)
    for contour in contours[:10]:
        perimeter = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * perimeter, True)
        if len(approx) == 4 and cv2.contourArea(approx) > 0:
            raw = [(float(p[0][0]), float(p[0][1])) for p in approx]
            return order_quad(raw)
    return None


def load_control_points(path: Path) -> np.ndarray:
    with path.open("r", encoding="utf-8") as fh:
        points = json.load(fh)
    if not isinstance(points, list) or len(points) != 4:
        raise RuntimeError("Control points must be a JSON list with 4 [x, y] points.")
    parsed = [(float(pt[0]), float(pt[1])) for pt in points]
    return order_quad(parsed)


def main() -> None:
    args = parse_args()
    input_path = Path(args.input)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    image = load_image(input_path, args.pdf_page)
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    prep = preprocess(gray)

    quad = None
    control_points_source = None
    if args.control_points:
        control_path = Path(args.control_points)
        quad = load_control_points(control_path)
        control_points_source = str(control_path)
    else:
        quad = detect_quad(prep)

    if quad is None:
        # Safe fallback: use full-image bounds as the source quad so pipeline can continue.
        # This avoids hard-failing users who do not have manual control points prepared yet.
        h, w = image.shape[:2]
        quad = order_quad(
            [
                (0.0, 0.0),
                (float(w - 1), 0.0),
                (float(w - 1), float(h - 1)),
                (0.0, float(h - 1)),
            ]
        )
        control_points_source = "auto_fallback_full_image"

    target = np.array(
        [
            [0, 0],
            [args.canvas_width - 1, 0],
            [args.canvas_width - 1, args.canvas_height - 1],
            [0, args.canvas_height - 1],
        ],
        dtype=np.float32,
    )
    transform = cv2.getPerspectiveTransform(quad, target)
    rectified = cv2.warpPerspective(image, transform, (args.canvas_width, args.canvas_height))
    rectified_gray = cv2.cvtColor(rectified, cv2.COLOR_BGR2GRAY)
    rectified_prep = preprocess(rectified_gray)

    prefix = f"{args.floor}"
    rectified_path = out_dir / f"{prefix}.rectified.png"
    prep_path = out_dir / f"{prefix}.prep.png"
    meta_path = out_dir / f"{prefix}.meta.json"
    ensure_parent(rectified_path)

    cv2.imwrite(str(rectified_path), rectified)
    cv2.imwrite(str(prep_path), rectified_prep)

    meta = {
        "schemaVersion": "floorplan-prep.v1",
        "buildingId": args.building_id,
        "floor": args.floor,
        "inputPath": str(input_path),
        "outputRectifiedPath": str(rectified_path),
        "outputPrepPath": str(prep_path),
        "canvas": {"width": args.canvas_width, "height": args.canvas_height},
        "pdfPage": args.pdf_page if input_path.suffix.lower() == ".pdf" else None,
        "controlPointsSource": control_points_source,
        "sourceQuadrilateral": quad.tolist(),
        "transformMatrix": transform.tolist(),
    }
    with meta_path.open("w", encoding="utf-8") as fh:
        json.dump(meta, fh, indent=2)
        fh.write("\n")

    print(f"Prepared floorplan: {rectified_path}")
    print(f"Metadata: {meta_path}")


if __name__ == "__main__":
    main()
