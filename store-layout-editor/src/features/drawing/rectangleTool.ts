import type { Point } from "../../types/layout";

export function rectangleToPolygon(start: Point, end: Point): Point[] {
  const minX = Math.min(start.x, end.x);
  const maxX = Math.max(start.x, end.x);
  const minY = Math.min(start.y, end.y);
  const maxY = Math.max(start.y, end.y);

  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

export function rectangleIsValid(start: Point, end: Point): boolean {
  return Math.abs(start.x - end.x) > 1 && Math.abs(start.y - end.y) > 1;
}
