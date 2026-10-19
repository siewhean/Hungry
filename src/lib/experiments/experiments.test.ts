import assert from "node:assert/strict";
import test from "node:test";

import { EXPERIMENTS, getExperimentVariant, resolveExperimentVariant } from "./experiments";

test("flag values map to known variants, with the fallback otherwise", () => {
  assert.equal(resolveExperimentVariant("welcome_back_v1", "control"), "control");
  assert.equal(resolveExperimentVariant("welcome_back_v1", "test"), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v1", true), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v1", false), "control");
  assert.equal(resolveExperimentVariant("welcome_back_v1", "unknown"), "test");
  assert.equal(resolveExperimentVariant("welcome_back_v1", undefined), "test");
});

test("without PostHog every experiment uses its fallback", () => {
  for (const key of Object.keys(EXPERIMENTS) as (keyof typeof EXPERIMENTS)[]) {
    assert.equal(getExperimentVariant(key), EXPERIMENTS[key].fallback);
  }
});
