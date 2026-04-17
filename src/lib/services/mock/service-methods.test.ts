import assert from "node:assert/strict";
import test from "node:test";

import { hungryService } from "@/lib/services/mock/mockService";

test("discovery.getBuildingDetail returns enriched building metadata", async () => {
  const detail = await hungryService.discovery.getBuildingDetail("building-maxwell");

  assert.ok(detail);
  assert.equal(detail?.id, "building-maxwell");
  assert.ok(Boolean(detail?.address));
  assert.ok((detail?.totalStalls ?? 0) > 0);
});

test("discovery.getFloorPlan returns a floor plan with polygon geometry", async () => {
  const floorPlan = await hungryService.discovery.getFloorPlan("building-maxwell", "L1");

  assert.ok(floorPlan);
  assert.equal(floorPlan?.buildingId, "building-maxwell");
  assert.equal(floorPlan?.floor, "L1");
  assert.ok((floorPlan?.stalls.length ?? 0) > 0);
  assert.ok((floorPlan?.stalls[0]?.polygon.length ?? 0) >= 3);
});
