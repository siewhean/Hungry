import type { Point, StoreShape } from "../../types/layout";
import { pointDistance } from "./bounds";

export interface SharedSnapResult {
  point: Point;
  snapped: boolean;
  targetType: "vertex" | "edge" | null;
}

function nearestPointOnSegment(point: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abLenSq = abx * abx + aby * aby;

  if (abLenSq === 0) {
    return a;
  }

  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

export function snapPointToSharedGeometry(
  point: Point,
  shapes: StoreShape[],
  options: {
    threshold: number;
    excludeShapeId?: string;
  },
): SharedSnapResult {
  const { threshold, excludeShapeId } = options;

  let bestPoint: Point = point;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestType: "vertex" | "edge" | null = null;

  for (const shape of shapes) {
    if (excludeShapeId && shape.id === excludeShapeId) {
      continue;
    }

    for (const vertex of shape.points) {
      const distance = pointDistance(point, vertex);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = vertex;
        bestType = "vertex";
      }
    }

    for (let index = 0; index < shape.points.length; index += 1) {
      const current = shape.points[index];
      const next = shape.points[(index + 1) % shape.points.length];
      const projected = nearestPointOnSegment(point, current, next);
      const distance = pointDistance(point, projected);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestPoint = projected;
        bestType = "edge";
      }
    }
  }

  if (bestDistance <= threshold) {
    return { point: bestPoint, snapped: true, targetType: bestType };
  }

  return { point, snapped: false, targetType: null };
}
