// The PostHog sink against the stub client (src/test/posthogStub.ts in tests).
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

process.env.EXPO_PUBLIC_POSTHOG_API_KEY = "phc_test";
delete process.env.EXPO_PUBLIC_DISABLE_POSTHOG;

// Required after the env is set: the sink reads the key when it loads.
const PostHogStub = (require("@/test/posthogStub") as typeof import("@/test/posthogStub")).default;
const sink = require("./posthogSink") as typeof import("./posthogSink");
const { getAnalyticsEnvironment, isInternalBuild } =
  require("./trafficTag") as typeof import("./trafficTag");

/** What the sink registers beside `environment` on this run's build. */
const internalTag = () => (isInternalBuild() ? { is_internal: true } : {});

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

test("reset and register reach the client, and reset puts the traffic tags back", () => {
  sink.resetPostHogUser();
  sink.registerPostHogProperties({ lifecycle_state: "active", missing: undefined });
  assert.deepEqual(calls, [
    { method: "reset", args: [] },
    { method: "register", args: [{ environment: getAnalyticsEnvironment(), ...internalTag() }] },
    { method: "register", args: [{ lifecycle_state: "active" }] },
  ]);
});

test("a production build tags its events production and leaves is_internal unset", () => {
  delete process.env.EXPO_PUBLIC_INTERNAL_BUILD;
  sink.resetPostHogUser();
  const traffic = calls.find((call) => call.method === "register")?.args[0] as Record<
    string,
    unknown
  >;
  assert.equal(traffic.environment, getAnalyticsEnvironment());
  if (getAnalyticsEnvironment() === "production") {
    // Unset, not false: a false here would wipe a mark that Developer tools saved earlier.
    assert.equal("is_internal" in traffic, false);
  }
});

test("a build made for the team tags its events and its people internal", () => {
  process.env.EXPO_PUBLIC_INTERNAL_BUILD = "1";
  try {
    sink.resetPostHogUser();
    sink.identifyPostHogUser("user-2", { plan: "free" });
    assert.deepEqual(calls, [
      { method: "reset", args: [] },
      { method: "register", args: [{ environment: getAnalyticsEnvironment(), is_internal: true }] },
      { method: "identify", args: ["user-2", { plan: "free", is_internal: true }] },
    ]);
  } finally {
    delete process.env.EXPO_PUBLIC_INTERNAL_BUILD;
  }
});

test("marking a phone as the team's tags later events and people, and unmarking says false", () => {
  sink.setPostHogInternalDevice(true);
  sink.identifyPostHogUser("user-3", { plan: "free" });
  sink.setPostHogInternalDevice(false);
  sink.identifyPostHogUser("user-3", { plan: "free" });
  const expectedOff = isInternalBuild();
  assert.deepEqual(calls, [
    { method: "register", args: [{ is_internal: true }] },
    { method: "identify", args: ["user-3", { plan: "free", is_internal: true }] },
    { method: "register", args: [{ is_internal: expectedOff }] },
    {
      method: "identify",
      args: ["user-3", { plan: "free", ...(expectedOff ? { is_internal: true } : {}) }],
    },
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

test("a failing register is reported, not thrown", async () => {
  const failing = () => Promise.reject(new Error("storage full"));
  const previous = prototype.register;
  prototype.register = failing;
  try {
    assert.doesNotThrow(() => {
      sink.setPostHogInternalDevice(true);
      sink.resetPostHogUser();
    });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    prototype.register = previous;
  }
});

test("opting out and back in reaches the client, and a failure is reported, not thrown", async () => {
  const seen: string[] = [];
  const { optOut, optIn } = prototype;
  prototype.optOut = () => {
    seen.push("out");
    return Promise.resolve();
  };
  prototype.optIn = () => {
    seen.push("in");
    return Promise.reject(new Error("storage full"));
  };
  try {
    sink.setPostHogOptOut(true);
    sink.setPostHogOptOut(false);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(seen, ["out", "in"]);
  } finally {
    prototype.optOut = optOut;
    prototype.optIn = optIn;
  }
});

test("the SDK's own app properties carry the tags, so Application Installed is tagged too", () => {
  sink.registerPostHogProperties({});
  const withTags = PostHogStub.lastOptions?.customAppProperties?.({ $app_name: "Hungry" });
  assert.equal(withTags?.$app_name, "Hungry");
  assert.equal(withTags?.environment, getAnalyticsEnvironment());
  // The SDK caches this result, so it holds only the build mark, never a phone or account mark.
  sink.setPostHogInternalDevice(true);
  assert.equal(
    PostHogStub.lastOptions?.customAppProperties?.({})?.is_internal,
    isInternalBuild() ? true : undefined,
  );
  sink.setPostHogInternalDevice(false);
});

test("an account's team mark that arrives after sign-in marks the person and later events", () => {
  sink.resetPostHogUser();
  PostHogStub.personProperties = [];
  sink.markPostHogAccountInternal("late-user");
  assert.deepEqual(PostHogStub.personProperties, [], "nobody is identified yet");

  sink.identifyPostHogUser("late-user", { plan: "free" });
  PostHogStub.personProperties = [];
  sink.markPostHogAccountInternal("someone-else");
  assert.deepEqual(PostHogStub.personProperties, [], "another account's profile is ignored");

  sink.markPostHogAccountInternal("late-user");
  assert.deepEqual(PostHogStub.personProperties, [{ is_internal: true }]);
  sink.markPostHogAccountInternal("late-user");
  assert.equal(PostHogStub.personProperties.length, 1, "marked once");

  sink.setPostHogInternalDevice(false);
  assert.deepEqual(PostHogStub.personProperties.at(-1), { is_internal: true });
  sink.resetPostHogUser();
});

test("switching the phone off clears a person trait it set, but a team account stays internal", () => {
  sink.resetPostHogUser();
  sink.setPostHogInternalDevice(false);
  PostHogStub.personProperties = [];
  sink.setPostHogInternalDevice(true);
  assert.deepEqual(PostHogStub.personProperties, [], "nobody signed in: no person to mark");

  sink.identifyPostHogUser("user-4", { plan: "free" });
  sink.setPostHogInternalDevice(false);
  assert.deepEqual(PostHogStub.personProperties.at(-1), { is_internal: isInternalBuild() });

  sink.identifyPostHogUser("user-5", { plan: "free", is_internal: true });
  sink.setPostHogInternalDevice(false);
  assert.deepEqual(PostHogStub.personProperties.at(-1), { is_internal: true });

  sink.resetPostHogUser();
  PostHogStub.personProperties = [];
  sink.setPostHogInternalDevice(false);
  assert.deepEqual(PostHogStub.personProperties, [], "signed out again: no person to mark");
  sink.setPostHogInternalDevice(false);
});
