// SET4-4: "Share usage analytics". While it is off nothing is tracked or sent; back on, it is.

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
  isAnalyticsEnabled,
  setAnalyticsSink,
  trackAnalyticsEvent,
  type AnalyticsEventRecord,
} from "./index";
import { applyAnalyticsPreference } from "./preference";
import { isUsageBreadcrumb } from "./privacy";

afterEach(() => {
  applyAnalyticsPreference(true);
  setAnalyticsSink(null);
  clearTrackedAnalyticsEvents();
});

test("with analytics off, trackAnalyticsEvent sends nothing and keeps nothing", () => {
  const sent: AnalyticsEventRecord[] = [];
  setAnalyticsSink((event) => sent.push(event));
  trackAnalyticsEvent("search_submitted", { query_length: 3 });
  assert.equal(sent.length, 1, "on by default");

  applyAnalyticsPreference(false);
  assert.equal(isAnalyticsEnabled(), false);
  trackAnalyticsEvent("search_submitted", { query_length: 4 });
  assert.equal(sent.length, 1, "nothing sent while off");
  assert.deepEqual(getTrackedAnalyticsEvents(), [], "nothing buffered while off");
});

test("turning analytics back on sends again", () => {
  const sent: string[] = [];
  setAnalyticsSink((event) => sent.push(event.event));
  applyAnalyticsPreference(false);
  trackAnalyticsEvent("search_submitted");
  applyAnalyticsPreference(true);
  trackAnalyticsEvent("dish_viewed");
  assert.deepEqual(sent, ["dish_viewed"]);
});

test("opting out drops events buffered before a sink attached, so they are never replayed", () => {
  trackAnalyticsEvent("app_launched");
  assert.equal(getTrackedAnalyticsEvents().length, 1);
  applyAnalyticsPreference(false);

  const replayed: string[] = [];
  setAnalyticsSink((event) => replayed.push(event.event), { replayBufferedEvents: true });
  assert.deepEqual(replayed, []);
});

test("navigation and tap breadcrumbs count as usage, network and console ones do not", () => {
  assert.equal(isUsageBreadcrumb({ category: "navigation" }), true);
  assert.equal(isUsageBreadcrumb({ category: "ui.tap" }), true);
  assert.equal(isUsageBreadcrumb({ category: "touch" }), true);
  assert.equal(isUsageBreadcrumb({ category: "http" }), false);
  assert.equal(isUsageBreadcrumb({ category: "console" }), false);
  assert.equal(isUsageBreadcrumb({}), false);
});
