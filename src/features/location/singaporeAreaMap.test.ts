import assert from "node:assert/strict";
import test from "node:test";

import { SINGAPORE_MAP_PROJECTION } from "./singaporeAreaMap.generated";
import {
  FULL_MAP_VIEW,
  MAP_MAX_ZOOM,
  MAP_PLACE_DOTS_ZOOM,
  SINGAPORE_PLANNING_AREAS,
  clampMapView,
  mapViewArea,
  mapUnitsPerPoint,
  mapViewBox,
  planningAreaAt,
  planningAreasFor,
  pointInRing,
  projectCoordinate,
  ringsToPath,
  unprojectPoint,
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

test("map points and coordinates round-trip, and views stay inside the map", () => {
  const jem = { latitude: 1.3333, longitude: 103.7436 };
  const { x, y } = projectCoordinate(jem);
  const back = unprojectPoint(x, y);
  assert.ok(Math.abs(back.latitude - jem.latitude) < 1e-9);
  assert.ok(Math.abs(back.longitude - jem.longitude) < 1e-9);

  assert.deepEqual(clampMapView({ centerX: -500, centerY: 9999, zoom: 0.2 }), FULL_MAP_VIEW);
  const zoomed = clampMapView({ centerX: 0, centerY: 0, zoom: 20 });
  assert.equal(zoomed.zoom, MAP_MAX_ZOOM);
  assert.equal(zoomed.centerX, SINGAPORE_MAP_PROJECTION.width / MAP_MAX_ZOOM / 2);
  assert.equal(mapViewBox(FULL_MAP_VIEW), `0 0 1000 ${SINGAPORE_MAP_PROJECTION.height}`);
  assert.ok(MAP_PLACE_DOTS_ZOOM > 1);
  // A box taller than the map keeps the whole width in view and shows sea above and below.
  assert.equal(mapUnitsPerPoint(FULL_MAP_VIEW, { width: 500, height: 800 }), 2);
  const [, minY, viewWidth, viewHeight] = mapViewBox(FULL_MAP_VIEW, { width: 500, height: 800 })
    .split(" ")
    .map(Number);
  assert.equal(viewWidth, 1000);
  assert.equal(viewHeight, 1600);
  assert.ok(minY < 0);
});

test("a view's area shrinks as the map zooms in", () => {
  const whole = mapViewArea(FULL_MAP_VIEW);
  const close = mapViewArea({ ...FULL_MAP_VIEW, zoom: 4 });
  assert.ok(whole.radiusMeters > 20_000);
  assert.ok(Math.abs(close.radiusMeters - whole.radiusMeters / 4) < 2);
  assert.ok(Math.abs(close.center.latitude - whole.center.latitude) < 1e-9);
});
