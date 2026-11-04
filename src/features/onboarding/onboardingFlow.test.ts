import assert from "node:assert/strict";
import test from "node:test";

import { TASTE_SLIDER_ORDER } from "./tasteSliderStops";
import {
  ONBOARDING_FLOW,
  ONBOARDING_FLOW_LENGTH,
  flowPosition,
  flowProgressFraction,
  tasteFlowScreen,
  tasteFlowScreenAt,
} from "./onboardingFlow";

test("the flow has 22 screens, starts at the splash and ends at the account", () => {
  assert.equal(ONBOARDING_FLOW_LENGTH, 22);
  assert.equal(ONBOARDING_FLOW[0], "splash");
  assert.equal(ONBOARDING_FLOW.at(-1), "account");
  assert.equal(new Set(ONBOARDING_FLOW).size, 22);
});

test("the six taste sliders sit side by side in the asked order", () => {
  const start = ONBOARDING_FLOW.indexOf("taste-spicy");
  TASTE_SLIDER_ORDER.forEach((key, offset) => {
    assert.equal(ONBOARDING_FLOW[start + offset], tasteFlowScreen(key));
    assert.equal(tasteFlowScreenAt(offset), tasteFlowScreen(key));
  });
  assert.equal(tasteFlowScreenAt(-4), "taste-spicy");
  assert.equal(tasteFlowScreenAt(99), "taste-aromatic");
});

test("swipe, loading, results, meal picks and the account come in the decided order", () => {
  const tail = ONBOARDING_FLOW.slice(-5);
  assert.deepEqual(tail, ["swipe", "loading", "results", "meal-picks", "account"].slice(-5));
});

test("progress is the place in the flow, from 1 of 22 up to a full bar", () => {
  assert.deepEqual(flowPosition("splash"), { current: 1, total: 22 });
  assert.deepEqual(flowPosition("taste-spicy"), { current: 7, total: 22 });
  assert.equal(flowProgressFraction("account"), 1);
  assert.ok(flowProgressFraction("name") < flowProgressFraction("location"));
});
