import assert from "node:assert/strict";
import test from "node:test";

import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
  setAnalyticsSink,
  trackAnalyticsEvent,
} from "./index";

test("trackAnalyticsEvent stores mock-safe event records", () => {
  clearTrackedAnalyticsEvents();
  const record = trackAnalyticsEvent("search_submitted", { query_length: 5 });
  const events = getTrackedAnalyticsEvents();

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "search_submitted");
  assert.equal(events[0].properties.query_length, 5);
  assert.equal(typeof record.session_id, "string");
});

test("trackAnalyticsEvent does not throw when sink fails", () => {
  clearTrackedAnalyticsEvents();
  setAnalyticsSink(() => {
    throw new Error("sink failure");
  });

  assert.doesNotThrow(() => {
    trackAnalyticsEvent("category_chip_tapped", { category: "noodles", selected: true });
  });

  setAnalyticsSink(null);
});
