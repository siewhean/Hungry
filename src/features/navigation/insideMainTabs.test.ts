import assert from "node:assert/strict";
import { test } from "node:test";

import { isInsideMainTabs } from "@/features/navigation/insideMainTabs";

type Nav = Parameters<typeof isInsideMainTabs>[0];

const nav = (routeNames: string[], parent?: Nav): NonNullable<Nav> => ({
  getState: () => ({ routeNames }),
  getParent: () => parent,
});

// useIsInsideMainTabs reads the navigator from context and hands it to isInsideMainTabs.
test("a screen directly in the diner tabs is inside them", () => {
  assert.equal(isInsideMainTabs(nav(["Home", "Discover", "Review", "Profile"])), true);
});

test("a screen in the Profile stack finds the tabs through its parent", () => {
  const tabs = nav(["Home", "Discover", "Review", "Profile"]);
  assert.equal(isInsideMainTabs(nav(["ProfileHome", "Settings"], tabs)), true);
});

test("the merchant tabs count too", () => {
  assert.equal(isInsideMainTabs(nav(["Dashboard", "Menu", "Analytics", "Profile"])), true);
});

test("a pushed screen in the root stack is not inside the tabs", () => {
  assert.equal(isInsideMainTabs(nav(["MainTabs", "StallDetail", "DishDetail"])), false);
});

test("without a navigator it is not inside the tabs", () => {
  assert.equal(isInsideMainTabs(undefined), false);
});
