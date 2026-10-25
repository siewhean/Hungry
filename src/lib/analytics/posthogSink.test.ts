// The PostHog sink against the stub client (src/test/posthogStub.ts in tests).
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import { useAnalyticsConsentStore } from "@/store/useAnalyticsConsentStore";

process.env.EXPO_PUBLIC_POSTHOG_API_KEY = "phc_test";
delete process.env.EXPO_PUBLIC_DISABLE_POSTHOG;

// Required after the env is set: the sink reads the key when it loads.
const PostHogStub = (require("@/test/posthogStub") as typeof import("@/test/posthogStub")).default;
const sink = require("./posthogSink") as typeof import("./posthogSink");

const calls: { method: string; args: unknown[] }[] = [];
const prototype = PostHogStub.prototype;
const original = {
  identify: prototype.identify,
  reset: prototype.reset,
  register: prototype.register,
};
prototype.identify = function (...args) {
  calls.push({ method: "identify", args });
};
prototype.reset = function () {
  calls.push({ method: "reset", args: [] });
};
prototype.register = function (...args) {
  calls.push({ method: "register", args });
  return Promise.resolve();
};

beforeEach(() => {
  useAnalyticsConsentStore.getState().setAnalyticsEnabled(true);
});

afterEach(() => {
  PostHogStub.flags = undefined;
  PostHogStub.captured = [];
  calls.length = 0;
});

test.after(() => {
  Object.assign(prototype, original);
});

test("captured events carry JSON-safe, sanitised properties plus the session and user", () => {
  sink.posthogSink({
    event: "dish_viewed",
    properties: {
      dish_id: "dish-1",
      tags: ["spicy", 2, undefined, () => undefined],
      nested: { score: 4, drop: undefined, note: "ping a@b.co" },
      skipped: undefined,
      empty: null,
    },
    session_id: "session-1",
    user_id: "user-1",
    timestamp: "2026-10-24T00:00:00.000Z",
  });
  assert.deepEqual(PostHogStub.captured, [
    {
      event: "dish_viewed",
      properties: {
        dish_id: "dish-1",
        tags: ["spicy", 2],
        nested: { score: 4, note: "ping [redacted-email]" },
        empty: null,
        session_id: "session-1",
        source_timestamp: "2026-10-24T00:00:00.000Z",
        user_id: "user-1",
      },
    },
  ]);
});

test("a guest event has no user_id", () => {
  sink.posthogSink({
    event: "app_opened",
    properties: {},
    session_id: "session-2",
    timestamp: "2026-10-24T00:00:00.000Z",
  });
  assert.equal(PostHogStub.captured[0]?.properties?.user_id, undefined);
});

test("identify sends sanitised traits and skips a blank user id", () => {
  sink.identifyPostHogUser("", { plan: "free" });
  sink.identifyPostHogUser("user-1", { plan: "free", email: "a@b.co" });
  assert.deepEqual(calls, [
    { method: "identify", args: ["user-1", { plan: "free", email: "[redacted]" }] },
  ]);
});

test("reset and register reach the client", () => {
  sink.resetPostHogUser();
  sink.registerPostHogProperties({ lifecycle_state: "active", missing: undefined });
  assert.deepEqual(calls, [
    { method: "reset", args: [] },
    { method: "register", args: [{ lifecycle_state: "active" }] },
  ]);
});

test("flag reads return booleans, variants, or undefined for an unknown flag", () => {
  PostHogStub.flags = { on_flag: true, variant_flag: "test" };
  assert.equal(sink.peekPostHogFeatureFlag("on_flag"), true);
  assert.equal(sink.peekPostHogFeatureFlag("missing_flag"), undefined);
  assert.equal(sink.getPostHogFeatureFlag("variant_flag"), "test");
  assert.equal(
    PostHogStub.captured.filter((entry) => entry.event === "$feature_flag_called").length,
    1,
    "only the exposed read records exposure",
  );
});
