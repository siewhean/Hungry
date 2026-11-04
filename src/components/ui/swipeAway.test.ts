import assert from "node:assert/strict";
import test from "node:test";

import { swipeAwayDirection } from "./swipeAway";

const drag = (dx: number, dy: number, vx = 0, vy = 0) => ({ dx, dy, vx, vy });

test("a long drag up, left or right sends the banner that way", () => {
  assert.equal(swipeAwayDirection(drag(0, -50)), "up");
  assert.equal(swipeAwayDirection(drag(-90, 0)), "left");
  assert.equal(swipeAwayDirection(drag(90, 5)), "right");
});

test("a quick flick counts after a short drag", () => {
  assert.equal(swipeAwayDirection(drag(-25, 0, -0.8, 0)), "left");
  assert.equal(swipeAwayDirection(drag(0, -25, 0, -0.9)), "up");
});

test("a short slow drag, or one pulled downwards, springs back", () => {
  assert.equal(swipeAwayDirection(drag(20, -10)), null);
  assert.equal(swipeAwayDirection(drag(0, 120, 0, 1)), null);
  assert.equal(swipeAwayDirection(drag(-10, 0, -0.9, 0)), null);
});

test("when both ways qualify, the longer move wins", () => {
  assert.equal(swipeAwayDirection(drag(-100, -50)), "left");
  assert.equal(swipeAwayDirection(drag(30, -80)), "up");
});
