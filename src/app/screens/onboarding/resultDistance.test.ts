import assert from "node:assert/strict";
import test from "node:test";

import { getBuildingById } from "@/lib/geo/singaporeBuildings";
import { resultDistanceLabel } from "./resultDistance";

const origin = { latitude: 1.3, longitude: 103.8 };
// About 450 m north of the origin.
const nearPin = { latitude: 1.30405, longitude: 103.8 };

test("a stall whose building is not in the demo list still gets a distance from its own pin", () => {
  assert.equal(getBuildingById("bld-prod-7001"), undefined);
  const label = resultDistanceLabel(
    origin,
    { buildingId: "bld-prod-7001", venueId: "v-1" },
    () => ({ latitude: nearPin.latitude, longitude: nearPin.longitude }),
  );
  assert.match(label ?? "", /^4[45]\dm away$/);
});

test("a pick that carries its stall pin needs no venue lookup at all", () => {
  const label = resultDistanceLabel(
    origin,
    { buildingId: "bld-prod-7001", venueId: "v-9", venuePin: nearPin },
    () => {
      throw new Error("the venue cache must not be read (it starts the catalog download)");
    },
  );
  assert.match(label ?? "", /^4[45]\dm away$/);
});

test("a distance over a kilometre is shown in km", () => {
  const label = resultDistanceLabel(
    origin,
    { buildingId: "bld-prod-7001", venueId: "v-1" },
    () => ({ latitude: 1.32, longitude: 103.8 }),
  );
  assert.match(label ?? "", /^2\.\dkm away$/);
});

test("without a stall pin the demo building is the fallback", () => {
  const building = getBuildingById("hc-maxwell");
  assert.ok(building);
  const label = resultDistanceLabel(origin, { buildingId: "hc-maxwell", venueId: "v-2" }, () => ({
    latitude: undefined,
    longitude: undefined,
  }));
  assert.match(label ?? "", /km away$/);
});

test("nothing is shown when neither the stall nor the building has a position", () => {
  assert.equal(
    resultDistanceLabel(origin, { buildingId: "bld-prod-7001", venueId: "v-3" }, () => undefined),
    undefined,
  );
  assert.equal(
    resultDistanceLabel(undefined, { buildingId: "hc-maxwell", venueId: "v-3" }, () => nearPin),
    undefined,
  );
});
