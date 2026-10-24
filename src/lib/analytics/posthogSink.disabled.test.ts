// With PostHog switched off, every sink call is a no-op.
import assert from "node:assert/strict";
import test from "node:test";

process.env.EXPO_PUBLIC_POSTHOG_API_KEY = "phc_test";
process.env.EXPO_PUBLIC_DISABLE_POSTHOG = "1";

// Required after the env is set: the sink reads the flags when it loads.
const PostHogStub = (require("@/test/posthogStub") as typeof import("@/test/posthogStub")).default;
const sink = require("./posthogSink") as typeof import("./posthogSink");

test("a disabled sink sends nothing and reports flags as not loaded", () => {
  PostHogStub.flags = { on_flag: true };
  sink.posthogSink({
    event: "app_opened",
    properties: {},
    session_id: "session-1",
    timestamp: "2026-10-24T00:00:00.000Z",
  });
  sink.identifyPostHogUser("user-1", {});
  sink.resetPostHogUser();
  sink.registerPostHogProperties({ lifecycle_state: "active" });
  assert.deepEqual(PostHogStub.captured, []);
  assert.equal(sink.getPostHogFeatureFlag("on_flag"), undefined);
  assert.equal(sink.peekPostHogFeatureFlag("on_flag"), undefined);
  assert.equal(sink.havePostHogFeatureFlagsLoaded(), false);
  let called = false;
  const unsubscribe = sink.onPostHogFeatureFlags(() => {
    called = true;
  });
  PostHogStub.loadFlags({ on_flag: false });
  unsubscribe();
  assert.equal(called, false);
  PostHogStub.flags = undefined;
});
