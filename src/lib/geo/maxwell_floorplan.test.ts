import assert from "node:assert/strict";
import test from "node:test";

import { STORY_GALLERY_ASSETS } from "@/lib/services/storyGalleryAssets";
import {
  buildMaxwellSkiaPolygons,
  MAXWELL_L1_BUILDING_OUTLINE,
  MAXWELL_L1_CANVAS,
  MAXWELL_L1_FLOOR_PLAN,
  MAXWELL_L1_STALLS,
} from "./maxwell_floorplan";

test("the Maxwell floor plan points at the Maxwell building and its own canvas", () => {
  assert.equal(MAXWELL_L1_FLOOR_PLAN.buildingId, "hc-maxwell");
  assert.equal(MAXWELL_L1_FLOOR_PLAN.floor, "L1");
  assert.equal(MAXWELL_L1_FLOOR_PLAN.canvasWidth, MAXWELL_L1_CANVAS.width);
  assert.equal(MAXWELL_L1_FLOOR_PLAN.canvasHeight, MAXWELL_L1_CANVAS.height);
  assert.equal(MAXWELL_L1_FLOOR_PLAN.stalls, MAXWELL_L1_STALLS);
});

test("every stall polygon is a closed shape of at least three points inside the canvas", () => {
  const inside = ([x, y]: [number, number]) =>
    x >= 0 && y >= 0 && x <= MAXWELL_L1_CANVAS.width && y <= MAXWELL_L1_CANVAS.height;
  assert.ok(MAXWELL_L1_STALLS.length > 20);
  for (const stall of MAXWELL_L1_STALLS) {
    assert.ok(stall.polygon.length >= 3, `${stall.stallId} has fewer than 3 points`);
    assert.ok(stall.polygon.every(inside), `${stall.stallId} has a point outside the canvas`);
  }
  assert.ok(MAXWELL_L1_BUILDING_OUTLINE.every(inside));
});

test("stall ids are unique so a tap maps to exactly one stall", () => {
  const ids = MAXWELL_L1_STALLS.map((stall) => stall.stallId);
  assert.equal(new Set(ids).size, ids.length);
});

test("buildMaxwellSkiaPolygons puts the background first and one SVG path per stall", () => {
  const polygons = buildMaxwellSkiaPolygons();
  assert.equal(polygons.length, MAXWELL_L1_STALLS.length + 1);
  assert.equal(polygons[0].type, "background");
  for (const polygon of polygons)
    assert.match(polygon.path, /^M/, `${polygon.id} is not an SVG path`);
});

test("polygon types follow the stall kind: tenants with a venue are stalls, the rest are not", () => {
  const polygons = buildMaxwellSkiaPolygons().slice(1);
  MAXWELL_L1_STALLS.forEach((stall, index) => {
    const kind = stall.kind ?? "tenant";
    const type = polygons[index].type;
    if (kind === "corridor") assert.equal(type, "corridor");
    else if (kind === "facility") assert.equal(type, "non-food");
    else assert.equal(type, stall.venueId ? "stall" : "unmapped");
  });
});

test("buildMaxwellSkiaPolygons stamps the building and floor it is asked for", () => {
  const polygons = buildMaxwellSkiaPolygons("hc-other", "L2");
  assert.ok(
    polygons.every((polygon) => polygon.buildingId === "hc-other" && polygon.floor === "L2"),
  );
});

test("story gallery assets have unique ids, https urls and a known media type", () => {
  assert.equal(
    new Set(STORY_GALLERY_ASSETS.map((asset) => asset.id)).size,
    STORY_GALLERY_ASSETS.length,
  );
  for (const asset of STORY_GALLERY_ASSETS) {
    assert.match(asset.url, /^https:\/\//);
    assert.ok(["image", "video"].includes(asset.type));
    assert.ok(asset.title.length > 0);
  }
});
