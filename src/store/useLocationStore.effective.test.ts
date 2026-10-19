import assert from "node:assert/strict";
import test from "node:test";

import { getEffectiveLocation } from "./useLocationStore";

const fallback = { latitude: 1.2813, longitude: 103.8458 };

test("a manual pick wins over GPS and is not approximate", () => {
  const manual = { latitude: 1.35, longitude: 103.94 };
  assert.deepEqual(
    getEffectiveLocation({
      permission: "denied",
      currentLocation: fallback,
      manualCoordinate: manual,
    }),
    { coordinate: manual, isApproximate: false },
  );
});

test("a GPS fix is used when there is no manual pick", () => {
  const gps = { latitude: 1.3, longitude: 103.8 };
  assert.deepEqual(getEffectiveLocation({ permission: "granted", currentLocation: gps }), {
    coordinate: gps,
    isApproximate: false,
  });
});

test("without a fix or a manual pick the default coordinate is flagged approximate", () => {
  for (const permission of ["unknown", "denied"] as const) {
    assert.equal(
      getEffectiveLocation({ permission, currentLocation: fallback }).isApproximate,
      true,
    );
  }
});
