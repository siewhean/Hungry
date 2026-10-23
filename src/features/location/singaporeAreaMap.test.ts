import assert from "node:assert/strict";
import test from "node:test";

import { SINGAPORE_MAP_PROJECTION } from "./singaporeAreaMap.generated";
import {
  SINGAPORE_PLANNING_AREAS,
  planningAreaAt,
  planningAreasFor,
  pointInRing,
  projectCoordinate,
  ringsToPath,
} from "./singaporeAreaMap";

test("the generated map covers Singapore's planning areas in a 1000-wide viewBox", () => {
  assert.equal(SINGAPORE_MAP_PROJECTION.width, 1000);
  assert.ok(SINGAPORE_PLANNING_AREAS.length >= 50);
  assert.ok(SINGAPORE_PLANNING_AREAS.every((area) => area.rings.every((ring) => ring.length >= 6)));
  const { x, y } = projectCoordinate({ latitude: 1.3521, longitude: 103.8198 });
  assert.ok(x > 0 && x < SINGAPORE_MAP_PROJECTION.width);
  assert.ok(y > 0 && y < SINGAPORE_MAP_PROJECTION.height);
});

test("rings become closed SVG paths and points test inside their ring", () => {
  const square = [0, 0, 10, 0, 10, 10, 0, 10];
  assert.equal(ringsToPath([square]), "M0 0L10 0L10 10L0 10Z");
  assert.equal(pointInRing(5, 5, square), true);
  assert.equal(pointInRing(15, 5, square), false);
});

test("a place resolves to the planning area it sits in", () => {
  // JEM and Tampines Hub.
  assert.equal(planningAreaAt({ latitude: 1.3333, longitude: 103.7436 }), "Jurong East");
  assert.equal(planningAreaAt({ latitude: 1.3533, longitude: 103.9405 }), "Tampines");
  assert.equal(planningAreaAt({ latitude: 0, longitude: 0 }), undefined);
});

test("app areas map to the planning areas to highlight", () => {
  assert.deepEqual(planningAreasFor("Bedok"), ["Bedok"]);
  assert.ok(planningAreasFor("Central Area").includes("Downtown Core"));
  assert.deepEqual(planningAreasFor("Sentosa"), ["Southern Islands"]);
  // Not a planning-area name: falls back to the area its centre sits in.
  assert.deepEqual(planningAreasFor("Tiong Bahru", { latitude: 1.2852, longitude: 103.8268 }), [
    "Bukit Merah",
  ]);
  assert.deepEqual(planningAreasFor("Nowhere"), []);
});
