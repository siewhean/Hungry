import type { Point } from "../../types/layout";

export interface PolygonDraft {
  points: Point[];
}

export function createPolygonDraft(startPoint?: Point): PolygonDraft {
  return {
    points: startPoint ? [startPoint] : [],
  };
}

export function addPolygonPoint(draft: PolygonDraft, point: Point): PolygonDraft {
  return {
    points: [...draft.points, point],
  };
}

export function updateLastPolygonPoint(
  draft: PolygonDraft,
  point: Point,
): PolygonDraft {
  if (draft.points.length === 0) {
    return draft;
  }

  return {
    points: [
      ...draft.points.slice(0, draft.points.length - 1),
      point,
    ],
  };
}

export function canCommitPolygon(draft: PolygonDraft): boolean {
  return draft.points.length >= 3;
}

export function finalizePolygon(draft: PolygonDraft): Point[] | null {
  if (!canCommitPolygon(draft)) {
    return null;
  }

  return draft.points;
}
