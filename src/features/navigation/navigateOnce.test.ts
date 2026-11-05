import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { NAVIGATE_ONCE_WINDOW_MS, navigateOnce, resetNavigateOnce } from "./navigateOnce";

describe("navigateOnce", () => {
  beforeEach(resetNavigateOnce);

  const recorder = () => {
    const calls: unknown[][] = [];
    return { calls, navigate: (...args: unknown[]) => calls.push(args) };
  };

  it("opens the screen on the first tap and ignores a hurried second tap", () => {
    const nav = recorder();
    assert.equal(navigateOnce(nav, "WheelStack", { screen: "WheelHome" }, 1000), true);
    assert.equal(navigateOnce(nav, "WheelStack", { screen: "WheelHome" }, 1200), false);
    assert.deepEqual(nav.calls, [["WheelStack", { screen: "WheelHome" }]]);
  });

  it("does not hold back a different screen or different params", () => {
    const nav = recorder();
    navigateOnce(nav, "WheelStack", { screen: "WheelHome" }, 1000);
    assert.equal(navigateOnce(nav, "FoodStyles", undefined, 1100), true);
    assert.equal(navigateOnce(nav, "FoodStyles", { id: "a" }, 1150), true);
    assert.equal(nav.calls.length, 3);
  });

  it("opens the same screen again once the window has passed", () => {
    const nav = recorder();
    navigateOnce(nav, "WheelStack", undefined, 1000);
    assert.equal(navigateOnce(nav, "WheelStack", undefined, 1000 + NAVIGATE_ONCE_WINDOW_MS), true);
    assert.equal(nav.calls.length, 2);
  });
});
