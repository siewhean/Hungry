import assert from "node:assert/strict";
import test from "node:test";

import { tabBarBottomPadding } from "./tabBarMetrics";

test("the tab bar sits closer to the edge than the full home-indicator inset", () => {
  // An iPhone with a home indicator reports 34; the bar keeps 22 of it.
  assert.equal(tabBarBottomPadding(34, 8), 22);
});

test("a phone with no inset keeps the minimum padding", () => {
  assert.equal(tabBarBottomPadding(0, 8), 8);
  assert.equal(tabBarBottomPadding(10, 8), 8);
});
