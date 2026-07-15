import { describe, expect, it } from "vitest";

import type { EditorSettings, StoreShape } from "../../types/layout";
import {
  addPolygonPoint,
  canCommitPolygon,
  createPolygonDraft,
  finalizePolygon,
  updateLastPolygonPoint,
} from "./polygonTool";
import { rectangleIsValid, rectangleToPolygon } from "./rectangleTool";
import { applySnapping, snapAxisFromPrevious, snapToGrid } from "./snapping";

describe("rectangle drawing", () => {
  it("normalizes drag direction into a clockwise polygon", () => {
    expect(rectangleToPolygon({ x: 10, y: 20 }, { x: 2, y: 4 })).toEqual([
      { x: 2, y: 4 },
      { x: 10, y: 4 },
      { x: 10, y: 20 },
      { x: 2, y: 20 },
    ]);
    expect(rectangleIsValid({ x: 0, y: 0 }, { x: 1, y: 10 })).toBe(false);
    expect(rectangleIsValid({ x: 0, y: 0 }, { x: 2, y: 10 })).toBe(true);
  });
});

describe("polygon drawing", () => {
  it("updates drafts immutably and only commits three or more points", () => {
    const draft = addPolygonPoint(createPolygonDraft({ x: 0, y: 0 }), { x: 10, y: 0 });
    const updated = updateLastPolygonPoint(draft, { x: 10, y: 10 });
    const complete = addPolygonPoint(updated, { x: 0, y: 10 });

    expect(updated).not.toBe(draft);
    expect(draft.points[1]).toEqual({ x: 10, y: 0 });
    expect(canCommitPolygon(updated)).toBe(false);
    expect(finalizePolygon(updated)).toBeNull();
    expect(finalizePolygon(complete)).toEqual(complete.points);
  });
});

describe("drawing snapping", () => {
  it("applies grid, axis, and shared-edge snapping in a stable order", () => {
    expect(snapToGrid({ x: 13, y: 27 }, 10)).toEqual({ x: 10, y: 30 });
    expect(snapAxisFromPrevious({ x: 10, y: 10 }, { x: 14, y: 30 })).toEqual({ x: 10, y: 30 });

    const settings: EditorSettings = {
      gridSize: 10,
      snapToGrid: true,
      snapAxis: true,
      snapSharedEdges: true,
      showGrid: true,
    };
    const existing: StoreShape = {
      id: "existing",
      unitId: "",
      tenantName: "",
      category: "",
      fillColor: "#000",
      labelPosition: "centroid",
      points: [
        { x: 20, y: 20 },
        { x: 40, y: 20 },
        { x: 40, y: 40 },
        { x: 20, y: 40 },
      ],
    };

    expect(
      applySnapping({ x: 18, y: 23 }, {
        settings,
        previousPoint: { x: 20, y: 0 },
        allShapes: [existing],
      }),
    ).toEqual({ x: 20, y: 20 });
  });
});
