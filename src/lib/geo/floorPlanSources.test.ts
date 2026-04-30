import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptFloorPlanSourceToFloorPlan,
  floorPlanSourceRegistry,
} from "@/lib/geo/floorPlanSources";
import { getFloorPlan } from "@/lib/geo/floorPlans";

test("adaptFloorPlanSourceToFloorPlan maps canonical source fields to FloorPlan", () => {
  const source = floorPlanSourceRegistry["hc-maxwell:L1"];
  const adapted = adaptFloorPlanSourceToFloorPlan(source, "building-maxwell");

  assert.equal(adapted.buildingId, "building-maxwell");
  assert.equal(adapted.floor, "L1");
  assert.equal(adapted.canvasWidth, source.canvas.width);
  assert.equal(adapted.canvasHeight, source.canvas.height);
  assert.ok(adapted.stalls.length > 0);
  assert.equal(adapted.stalls[0]?.kind, source.stalls[0]?.kind);
});

test("getFloorPlan prefers canonical source for direct key", () => {
  const plan = getFloorPlan("hc-maxwell", "L1");
  assert.equal(plan.canvasWidth, 980);
  assert.equal(plan.canvasHeight, 640);
  assert.ok(plan.stalls.some((stall) => stall.kind === "corridor"));
  assert.ok(plan.stalls.some((stall) => stall.venueId === "venue-tian-tian"));
});

test("getFloorPlan resolves canonical source through alias", () => {
  const plan = getFloorPlan("building-maxwell", "L1");
  assert.equal(plan.buildingId, "building-maxwell");
  assert.equal(plan.floor, "L1");
  assert.equal(plan.canvasWidth, 980);
});

test("getFloorPlan falls back to generated plan for unknown building/floor", () => {
  const plan = getFloorPlan("unknown-building", "L9", 3, 6);
  assert.equal(plan.buildingId, "unknown-building");
  assert.equal(plan.floor, "L9");
  assert.equal(plan.stalls.length, 6);
});
