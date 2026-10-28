import assert from "node:assert/strict";
import test from "node:test";

import { crossedStop, stopDirection, valueFromX, xFromValue } from "./sliderGeometry";

test("the thumb sits inside the track by its inset and covers 0 to 10 across the rest", () => {
  assert.equal(xFromValue(0, 300, 16), 16);
  assert.equal(xFromValue(10, 300, 16), 284);
  assert.equal(xFromValue(5, 300, 16), 150);
});

test("a finger position becomes a free value, clamped at both ends", () => {
  assert.equal(valueFromX(150, 300, 16), 5);
  assert.equal(valueFromX(-50, 300, 16), 0);
  assert.equal(valueFromX(900, 300, 16), 10);
  assert.ok(Math.abs(valueFromX(100, 300, 16) - 3.134) < 0.01);
  assert.equal(valueFromX(10, 20, 16), 0, "a track too narrow to use reads as 0");
});

test("a tick is due only when the thumb enters another stop", () => {
  assert.equal(crossedStop(1.3, 1.5), false);
  assert.equal(crossedStop(1.2, 1.3), true);
  assert.equal(crossedStop(1.3, 1.1), true);
  assert.equal(crossedStop(5, 5), false);
});

test("direction says which way the thumb moved between stops", () => {
  assert.equal(stopDirection(1, 3), 1);
  assert.equal(stopDirection(3, 2), -1);
  assert.equal(stopDirection(2, 2), 0);
});
