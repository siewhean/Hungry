import { describe, expect, it } from "vitest";

import type { StoreShape } from "../../types/layout";
import { clampPointToBounds, getPolygonBounds, pointDistance } from "./bounds";
import { snapPointToSharedGeometry } from "./sharedEdges";
import { hasSelfIntersection, polygonsOverlap, validateShapes } from "./validation";

function makeShape(id: string, points: StoreShape["points"]): StoreShape {
  return {
    id,
    unitId: id,
    tenantName: "",
    category: "",
    fillColor: "#000000",
    labelPosition: "centroid",
    points,
  };
}

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe("geometry utilities", () => {
  it("clamps coordinates and calculates bounds and distance", () => {
    expect(clampPointToBounds({ x: -5, y: 120 }, 100, 80)).toEqual({ x: 0, y: 80 });
    expect(getPolygonBounds(square)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 10,
      maxY: 10,
      width: 10,
      height: 10,
    });
    expect(pointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("snaps to the nearest shared vertex or edge within the threshold", () => {
    const shape = makeShape("existing", square);

    expect(snapPointToSharedGeometry({ x: -0.5, y: -0.5 }, [shape], { threshold: 1 })).toEqual({
      point: { x: 0, y: 0 },
      snapped: true,
      targetType: "vertex",
    });
    expect(snapPointToSharedGeometry({ x: 5, y: 1 }, [shape], { threshold: 2 })).toEqual({
      point: { x: 5, y: 0 },
      snapped: true,
      targetType: "edge",
    });
    expect(snapPointToSharedGeometry({ x: 20, y: 20 }, [shape], { threshold: 2 }).snapped).toBe(false);
  });
});

describe("geometry validation", () => {
  it("detects self-intersection, overlap, and valid separated stores", () => {
    const bowTie = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    ];
    const overlapping = square.map((point) => ({ x: point.x + 5, y: point.y + 5 }));
    const separated = square.map((point) => ({ x: point.x + 20, y: point.y + 20 }));
    const adjacent = square.map((point) => ({ x: point.x + 10, y: point.y }));
    const cornerTouching = square.map((point) => ({ x: point.x + 10, y: point.y + 10 }));

    expect(hasSelfIntersection(bowTie)).toBe(true);
    expect(polygonsOverlap(square, overlapping)).toBe(true);
    expect(polygonsOverlap(square, separated)).toBe(false);
    expect(polygonsOverlap(square, adjacent)).toBe(false);
    expect(polygonsOverlap(square, cornerTouching)).toBe(false);
    expect(polygonsOverlap(square, square)).toBe(true);
    expect(validateShapes([makeShape("left", square), makeShape("right", adjacent)])).toEqual([]);
    expect(validateShapes([makeShape("bow", bowTie)])).toEqual([
      expect.objectContaining({ shapeId: "bow", type: "self_intersection" }),
    ]);
  });
});
