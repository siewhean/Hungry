import assert from "node:assert/strict";
import test from "node:test";

import { distanceFromDiner, formatDistanceLabel } from "./distanceLabel";

test("a distance under a kilometre is whole metres with a space before the unit", () => {
  assert.equal(formatDistanceLabel(210), "210 m");
  assert.equal(formatDistanceLabel(9.6), "10 m");
});

test("a kilometre or more is one decimal", () => {
  assert.equal(formatDistanceLabel(1000), "1.0 km");
  assert.equal(formatDistanceLabel(1250), "1.3 km");
});

test("away adds the word for a line that stands on its own", () => {
  assert.equal(formatDistanceLabel(210, { away: true }), "210 m away");
  assert.equal(formatDistanceLabel(2400, { away: true }), "2.4 km away");
});

test("a missing, zero or invalid distance has no label", () => {
  assert.equal(formatDistanceLabel(undefined), undefined);
  assert.equal(formatDistanceLabel(0), undefined);
  assert.equal(formatDistanceLabel(Number.NaN), undefined);
  assert.equal(formatDistanceLabel(-5), undefined);
});

test("distance from the diner is worked out from the place's own coordinates", () => {
  const diner = { latitude: 1.2813, longitude: 103.8458 };
  // About 1.1 km north; the read's own distanceMeters (from the map centre) is ignored.
  const distance = distanceFromDiner({ latitude: 1.2913, longitude: 103.8458 }, diner);
  assert.ok(distance !== undefined && distance > 1000 && distance < 1200, String(distance));
});

test("no distance when the diner's location is unknown or the place has no coordinates", () => {
  assert.equal(distanceFromDiner({ latitude: 1.29, longitude: 103.84 }, undefined), undefined);
  assert.equal(distanceFromDiner({}, { latitude: 1.28, longitude: 103.84 }), undefined);
  assert.equal(
    distanceFromDiner(
      { latitude: Number.NaN, longitude: 103.84 },
      { latitude: 1.28, longitude: 103.84 },
    ),
    undefined,
  );
});
