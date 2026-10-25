import assert from "node:assert/strict";
import test from "node:test";

import { isMapEdgeBackSwipe } from "./mapEdgeBack";

const layout = { edgeZoneWidth: 28, screenHeight: 800, sheetHeight: 260 };

test("a rightward swipe from the left edge above the sheet goes back", () => {
  assert.equal(isMapEdgeBackSwipe({ x0: 10, y0: 300, dx: 40, dy: 5 }, layout), true);
});

test("a swipe that starts on the card carousel scrolls it instead of going back", () => {
  assert.equal(isMapEdgeBackSwipe({ x0: 10, y0: 700, dx: 40, dy: 5 }, layout), false);
});

test("moves away from the edge, vertical moves and leftward moves are not back swipes", () => {
  assert.equal(isMapEdgeBackSwipe({ x0: 60, y0: 300, dx: 40, dy: 5 }, layout), false);
  assert.equal(isMapEdgeBackSwipe({ x0: 10, y0: 300, dx: 20, dy: 30 }, layout), false);
  assert.equal(isMapEdgeBackSwipe({ x0: 10, y0: 300, dx: -40, dy: 0 }, layout), false);
});
