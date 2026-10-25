import assert from "node:assert/strict";
import test from "node:test";
import { useAnalyticsConsentStore } from "@/store/useAnalyticsConsentStore";
import { getTrackedAnalyticsEvents, trackAnalyticsEvent } from "./mockAnalytics";

process.env.EXPO_PUBLIC_POSTHOG_API_KEY = "phc_consent_test";
delete process.env.EXPO_PUBLIC_DISABLE_POSTHOG;
const PostHogStub = (require("@/test/posthogStub") as typeof import("@/test/posthogStub")).default;
const sink = require("./posthogSink") as typeof import("./posthogSink");
const record = {
  event: "app_opened",
  properties: {},
  session_id: "test",
  timestamp: "2026-10-25T00:00:00Z",
};

test("no client, flags, identity or external captures before explicit consent", () => {
  assert.equal(useAnalyticsConsentStore.getState().analyticsEnabled, false);
  sink.posthogSink(record);
  sink.identifyPostHogUser("test", {});
  sink.registerPostHogProperties({ test: true });
  assert.equal(sink.getPostHogFeatureFlag("test"), undefined);
  assert.equal(PostHogStub.options.length, 0);
  assert.deepEqual(PostHogStub.captured, []);
});

test("opt-in enables explicit events; withdrawal purges queues and blocks subsequent SDK calls", async () => {
  trackAnalyticsEvent("app_opened");
  useAnalyticsConsentStore.getState().setAnalyticsEnabled(true);
  assert.deepEqual(getTrackedAnalyticsEvents(), [], "pre-consent buffer is never replayed");
  sink.posthogSink(record);
  sink.identifyPostHogUser("account-a", {});
  assert.equal(PostHogStub.distinctUserId, "account-a");
  assert.equal(PostHogStub.captured.length, 1);
  assert.equal(PostHogStub.options[0].captureAppLifecycleEvents, false);
  assert.equal(PostHogStub.options[0].enableSessionReplay, false);
  assert.equal(PostHogStub.options[0].persistence, "memory");
  await PostHogStub.latest?.fetch("https://example.invalid/test", {});
  assert.equal(PostHogStub.requests, 1);
  PostHogStub.queue = [record];
  useAnalyticsConsentStore.getState().setAnalyticsEnabled(false);
  assert.deepEqual(PostHogStub.queue, []);
  assert.equal(
    PostHogStub.distinctUserId,
    undefined,
    "withdrawal removes the prior account identity",
  );
  sink.resetPostHogUser();
  assert.equal(PostHogStub.optedOut, true);
  await PostHogStub.latest?.fetch("https://example.invalid/test", {});
  assert.equal(PostHogStub.requests, 1, "withdrawn SDK retries never reach the network");
  sink.posthogSink(record);
  sink.identifyPostHogUser("test", {});
  assert.equal(sink.getPostHogFeatureFlag("test"), undefined);
  assert.equal(PostHogStub.captured.length, 1);
  const retired = PostHogStub.latest;
  const constructionsBeforeReset = PostHogStub.options.length;
  sink.resetPostHogUser();
  assert.equal(
    PostHogStub.options.length,
    constructionsBeforeReset,
    "logout while withdrawn constructs nothing",
  );
  useAnalyticsConsentStore.getState().setAnalyticsEnabled(true);
  await retired?.fetch("https://example.invalid/test", {});
  assert.equal(PostHogStub.requests, 1, "an old SDK retry remains retired even after re-consent");
  sink.posthogSink(record);
  assert.equal(PostHogStub.distinctUserId, undefined, "new consent never reuses account A");
  sink.identifyPostHogUser("account-b", {});
  assert.equal(PostHogStub.distinctUserId, "account-b");
  useAnalyticsConsentStore.getState().setAnalyticsEnabled(false);
});

test("release builds do not retain or dispatch optional analytics before consent", () => {
  const runtime = globalThis as typeof globalThis & { __DEV__?: boolean };
  const original = runtime.__DEV__;
  runtime.__DEV__ = false;
  try {
    trackAnalyticsEvent("app_opened");
    assert.deepEqual(getTrackedAnalyticsEvents(), []);
  } finally {
    if (original === undefined) delete runtime.__DEV__;
    else runtime.__DEV__ = original;
  }
});
