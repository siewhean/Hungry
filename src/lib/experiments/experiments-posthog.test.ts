// Experiments wired to the real PostHog sink (the client is src/test/posthogStub.ts in tests).
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

process.env.EXPO_PUBLIC_POSTHOG_API_KEY = "phc_test";
delete process.env.EXPO_PUBLIC_DISABLE_POSTHOG;

// Required after the env is set: the sink reads the key when it loads.
const PostHogStub = (require("@/test/posthogStub") as typeof import("@/test/posthogStub")).default;
const sink = require("@/lib/analytics/posthogSink") as typeof import("@/lib/analytics/posthogSink");
const experiments = require("./experiments") as typeof import("./experiments");

afterEach(() => {
  PostHogStub.flags = undefined;
  PostHogStub.captured = [];
  experiments.setExperimentFlagSource(undefined);
});

const exposures = () => PostHogStub.captured.filter((entry) => entry.event === "$feature_flag_called");

test("peek reads the flag without sending $feature_flag_called", () => {
  PostHogStub.flags = { welcome_back_v1: "control" };
  assert.equal(sink.peekPostHogFeatureFlag("welcome_back_v1"), "control");
  assert.equal(exposures().length, 0);
});

test("flags count as loaded only after PostHog returns them", () => {
  assert.equal(sink.havePostHogFeatureFlagsLoaded(), false);
  PostHogStub.flags = {};
  assert.equal(sink.havePostHogFeatureFlagsLoaded(), true);
});

test("an exposed read sends exactly one $feature_flag_called with the variant", () => {
  PostHogStub.flags = { welcome_back_v2: "test" };
  assert.equal(experiments.getExperimentVariant("welcome_back_v2", { expose: true }), "test");
  assert.equal(experiments.getExperimentVariant("welcome_back_v2", { expose: true }), "test");
  assert.deepEqual(exposures().map((entry) => entry.properties), [
    { $feature_flag: "welcome_back_v2", $feature_flag_response: "test" },
  ]);
});

test("before flags load the fallback is shown and nothing is exposed", () => {
  assert.equal(experiments.getExperimentVariant("welcome_back_v2", { expose: true }), "control");
  assert.equal(exposures().length, 0);
});

test("flag loads notify subscribers until they unsubscribe", () => {
  let calls = 0;
  const unsubscribe = sink.onPostHogFeatureFlags(() => {
    calls += 1;
  });
  PostHogStub.loadFlags({ welcome_back_v1: "test" });
  unsubscribe();
  PostHogStub.loadFlags({ welcome_back_v1: "control" });
  assert.equal(calls, 1);
});
