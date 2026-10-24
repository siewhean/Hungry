import assert from "node:assert/strict";
import test from "node:test";

import { ARC_MIN_SCALE, ARC_TURN_DEG, arcPose, arcSamples } from "./foodArc";

test("a dish at rest is at the top of the arc, upright, full size and fully visible", () => {
  assert.deepEqual(arcPose("leaving", 0, 1, 100), {
    x: 0,
    y: 0,
    rotateDeg: 0,
    opacity: 1,
    scale: 1,
  });
  assert.deepEqual(arcPose("entering", 1, 1, 100), {
    x: 0,
    y: 0,
    rotateDeg: 0,
    opacity: 1,
    scale: 1,
  });
});

test("moving up sends the old dish to the right and it ends invisible, turned and smaller", () => {
  const end = arcPose("leaving", 1, 1, 100);
  assert.equal(end.x, 100);
  assert.equal(end.y, 100);
  assert.equal(end.rotateDeg, ARC_TURN_DEG);
  assert.equal(end.opacity, 0);
  assert.equal(end.scale, ARC_MIN_SCALE);
});

test("the new dish starts on the opposite side, invisible and turned the other way", () => {
  const start = arcPose("entering", 0, 1, 100);
  assert.equal(start.x, -100);
  assert.equal(start.rotateDeg, -ARC_TURN_DEG);
  assert.equal(start.opacity, 0);
});

test("moving down mirrors the sweep", () => {
  assert.equal(arcPose("leaving", 1, -1, 100).x, -100);
  assert.equal(arcPose("entering", 0, -1, 100).x, 100);
});

test("halfway along the arc the dish is up and out, so the path is a curve, not a line", () => {
  const middle = arcPose("leaving", 0.5, 1, 100);
  assert.ok(middle.x > 60 && middle.x < 80, `x ${middle.x}`);
  assert.ok(middle.y > 20 && middle.y < 40, `y ${middle.y}`);
  assert.equal(middle.opacity, 0.5);
});

test("progress outside 0 to 1 is held at the ends", () => {
  assert.deepEqual(arcPose("leaving", -2, 1, 100), arcPose("leaving", 0, 1, 100));
  assert.deepEqual(arcPose("leaving", 9, 1, 100), arcPose("leaving", 1, 1, 100));
});

test("the samples are in step order and ready for an Animated interpolation", () => {
  const samples = arcSamples("leaving", 1, 100, 4);
  assert.deepEqual(samples.inputRange, [0, 0.25, 0.5, 0.75, 1]);
  assert.equal(samples.translateX.length, 5);
  assert.equal(samples.rotate[4], "60deg");
  assert.equal(samples.opacity[0], 1);
});
