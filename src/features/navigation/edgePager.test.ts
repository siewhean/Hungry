import assert from "node:assert/strict";
import test from "node:test";

import { clampEdgeDrag, edgeDragDirection, edgeSettleIndex, shouldMountPage } from "./edgePager";

const W = 390;
const drag = (startX: number, dx: number, dy = 0, index = 1, pageCount = 4) =>
  edgeDragDirection({ startX, dx, dy, width: W, index, pageCount });

test("only a drag from a screen edge, the way the page can go, takes the touch", () => {
  assert.equal(drag(10, 60), "previous", "left edge, moving right");
  assert.equal(drag(W - 10, -60), "next", "right edge, moving left");
  assert.equal(drag(200, 80), null, "mid-screen drags belong to the page");
  assert.equal(drag(10, -60), null, "left edge moving left goes nowhere");
  assert.equal(drag(W - 10, 60), null, "right edge moving right goes nowhere");
});

test("a short or mostly vertical move is a scroll, not a drag", () => {
  assert.equal(drag(10, 8), null);
  assert.equal(drag(10, 40, 40), null);
  assert.equal(drag(10, 60, 10), "previous");
});

test("the first page has no previous page and the last has no next", () => {
  assert.equal(drag(10, 60, 0, 0), null);
  assert.equal(drag(W - 10, -60, 0, 3), null);
  assert.equal(
    edgeDragDirection({ startX: 10, dx: 60, dy: 0, width: 0, index: 1, pageCount: 4 }),
    null,
  );
});

test("the pages follow the finger by one page at most, in the way the drag began", () => {
  assert.equal(clampEdgeDrag(120, "previous", W), 120);
  assert.equal(clampEdgeDrag(-50, "previous", W), 0);
  assert.equal(clampEdgeDrag(900, "previous", W), W);
  assert.equal(clampEdgeDrag(-120, "next", W), -120);
  assert.equal(clampEdgeDrag(50, "next", W), 0);
  assert.equal(clampEdgeDrag(-900, "next", W), -W);
});

test("letting go settles on the nearer page, and a flick carries a short drag over", () => {
  const settle = (direction: "previous" | "next", dx: number, vx = 0) =>
    edgeSettleIndex({ index: 2, direction, dx, vx, width: W });
  assert.equal(settle("next", -200), 3, "more than a third of the way");
  assert.equal(settle("previous", 200), 1);
  assert.equal(settle("next", -60), 2, "a short slow drag springs back");
  assert.equal(settle("next", -60, -0.6), 3, "a short fast flick goes on");
  assert.equal(settle("next", -200, 0.6), 2, "a flick back cancels a long drag");
});

test("a page stays mounted while it is on show, once visited, or when the pages are warm", () => {
  assert.equal(
    shouldMountPage({ pageIndex: 1, focusedIndex: 1, visited: false, warm: false }),
    true,
  );
  assert.equal(
    shouldMountPage({ pageIndex: 2, focusedIndex: 1, visited: true, warm: false }),
    true,
  );
  assert.equal(
    shouldMountPage({ pageIndex: 2, focusedIndex: 1, visited: false, warm: true }),
    true,
  );
  assert.equal(
    shouldMountPage({ pageIndex: 2, focusedIndex: 1, visited: false, warm: false }),
    false,
  );
});
