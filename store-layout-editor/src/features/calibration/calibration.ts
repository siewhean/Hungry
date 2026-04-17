import type { Point } from "../../types/layout";

function sum(point: Point): number {
  return point.x + point.y;
}

function diff(point: Point): number {
  return point.x - point.y;
}

export function orderCalibrationCorners(points: Point[]): Point[] {
  if (points.length !== 4) {
    return points;
  }

  const sortedBySum = [...points].sort((a, b) => sum(a) - sum(b));
  const sortedByDiff = [...points].sort((a, b) => diff(a) - diff(b));

  const topLeft = sortedBySum[0];
  const bottomRight = sortedBySum[3];
  const topRight = sortedByDiff[0];
  const bottomLeft = sortedByDiff[3];

  return [topLeft, topRight, bottomRight, bottomLeft];
}

export function calibrationReady(points: Point[]): boolean {
  return points.length === 4;
}
