import assert from "node:assert/strict";
import test from "node:test";

import { openStallFromDish, type StallNavigationLike } from "./stallNavigation";

function createNavigation(routes: { name: string; params?: object }[]) {
  const calls: string[] = [];
  const navigation: StallNavigationLike = {
    getState: () => ({ index: routes.length - 1, routes }),
    goBack: () => calls.push("goBack"),
    push: (name, params) => calls.push(`push:${name}:${params.venueId}`),
  };
  return { calls, navigation };
}

test("D8: returns to the stall directly underneath instead of stacking a duplicate", () => {
  const { calls, navigation } = createNavigation([
    { name: "MainTabs" },
    { name: "StallDetail", params: { venueId: "v1" } },
    { name: "DishDetail", params: { dishId: "d1" } },
  ]);
  openStallFromDish(navigation, "v1");
  assert.deepEqual(calls, ["goBack"]);
});

test("D8: always pushes when the stall is further back in the stack", () => {
  const { calls, navigation } = createNavigation([
    { name: "MainTabs" },
    { name: "StallDetail", params: { venueId: "v1" } },
    { name: "DishDetail", params: { dishId: "d1" } },
    { name: "DishDetail", params: { dishId: "d2" } },
  ]);
  openStallFromDish(navigation, "v1");
  assert.deepEqual(calls, ["push:StallDetail:v1"]);
});

test("D8: pushes a different stall even when a stall is directly underneath", () => {
  const { calls, navigation } = createNavigation([
    { name: "StallDetail", params: { venueId: "v2" } },
    { name: "DishDetail", params: { dishId: "d1" } },
  ]);
  openStallFromDish(navigation, "v1");
  assert.deepEqual(calls, ["push:StallDetail:v1"]);
});

test("D8: pushes from a deep-linked dish with no history", () => {
  const { calls, navigation } = createNavigation([
    { name: "DishDetail", params: { dishId: "d1" } },
  ]);
  openStallFromDish(navigation, "v1");
  assert.deepEqual(calls, ["push:StallDetail:v1"]);
});
