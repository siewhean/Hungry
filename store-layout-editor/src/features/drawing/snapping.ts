import type { EditorSettings, Point, StoreShape } from "../../types/layout";
import { snapPointToSharedGeometry } from "../geometry/sharedEdges";

export function snapToGrid(point: Point, gridSize: number): Point {
  return {
    x: Math.round(point.x / gridSize) * gridSize,
    y: Math.round(point.y / gridSize) * gridSize,
  };
}

export function snapAxisFromPrevious(
  previous: Point,
  next: Point,
  threshold = 8,
): Point {
  const deltaX = Math.abs(next.x - previous.x);
  const deltaY = Math.abs(next.y - previous.y);

  if (deltaX < threshold) {
    return { x: previous.x, y: next.y };
  }

  if (deltaY < threshold) {
    return { x: next.x, y: previous.y };
  }

  return next;
}

export function applySnapping(
  rawPoint: Point,
  options: {
    settings: EditorSettings;
    previousPoint?: Point;
    allShapes: StoreShape[];
    activeShapeId?: string;
  },
): Point {
  const { settings, previousPoint, allShapes, activeShapeId } = options;
  let snapped = rawPoint;

  if (settings.snapToGrid) {
    snapped = snapToGrid(snapped, settings.gridSize);
  }

  if (settings.snapAxis && previousPoint) {
    snapped = snapAxisFromPrevious(previousPoint, snapped);
  }

  if (settings.snapSharedEdges) {
    snapped = snapPointToSharedGeometry(snapped, allShapes, {
      excludeShapeId: activeShapeId,
      threshold: settings.gridSize * 0.8,
    }).point;
  }

  return snapped;
}
