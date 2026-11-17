import type { GeometryWarning, Point, StoreShape } from "../../types/layout";

function orientation(a: Point, b: Point, c: Point): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < 1e-6) {
    return 0;
  }
  return value > 0 ? 1 : 2;
}

function onSegment(a: Point, b: Point, c: Point): boolean {
  return (
    b.x <= Math.max(a.x, c.x) &&
    b.x >= Math.min(a.x, c.x) &&
    b.y <= Math.max(a.y, c.y) &&
    b.y >= Math.min(a.y, c.y)
  );
}

function segmentsIntersect(
  p1: Point,
  q1: Point,
  p2: Point,
  q2: Point,
): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);

  if (o1 !== o2 && o3 !== o4) {
    return true;
  }

  if (o1 === 0 && onSegment(p1, p2, q1)) {
    return true;
  }
  if (o2 === 0 && onSegment(p1, q2, q1)) {
    return true;
  }
  if (o3 === 0 && onSegment(p2, p1, q2)) {
    return true;
  }
  if (o4 === 0 && onSegment(p2, q1, q2)) {
    return true;
  }

  return false;
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

export function hasSelfIntersection(points: Point[]): boolean {
  if (points.length < 4) {
    return false;
  }

  for (let i = 0; i < points.length; i += 1) {
    const a1 = points[i];
    const a2 = points[(i + 1) % points.length];

    for (let j = i + 1; j < points.length; j += 1) {
      const areAdjacent =
        i === j ||
        (i + 1) % points.length === j ||
        i === (j + 1) % points.length;
      if (areAdjacent) {
        continue;
      }

      const b1 = points[j];
      const b2 = points[(j + 1) % points.length];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return false;
}

export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];

    for (let j = 0; j < b.length; j += 1) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        return true;
      }
    }
  }

  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

export function validateShapes(shapes: StoreShape[]): GeometryWarning[] {
  const warnings: GeometryWarning[] = [];

  for (const shape of shapes) {
    if (hasSelfIntersection(shape.points)) {
      warnings.push({
        id: `self-${shape.id}`,
        shapeId: shape.id,
        type: "self_intersection",
        message: `${shape.unitId || shape.id} has a self-intersecting polygon.`,
      });
    }
  }

  for (let i = 0; i < shapes.length; i += 1) {
    for (let j = i + 1; j < shapes.length; j += 1) {
      const shapeA = shapes[i];
      const shapeB = shapes[j];
      if (polygonsOverlap(shapeA.points, shapeB.points)) {
        warnings.push({
          id: `overlap-${shapeA.id}-${shapeB.id}`,
          shapeId: shapeA.id,
          type: "overlap",
          message: `${shapeA.unitId || shapeA.id} overlaps ${shapeB.unitId || shapeB.id}.`,
        });
      }
    }
  }

  return warnings;
}
