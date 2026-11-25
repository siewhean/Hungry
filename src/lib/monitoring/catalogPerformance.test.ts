import assert from "node:assert/strict";
import test from "node:test";

import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
  setAnalyticsEnabled,
} from "@/lib/analytics";
import {
  consumeCatalogTap,
  markCatalogAppStart,
  markCatalogTap,
  recordCatalogPaint,
  recordCatalogRpc,
} from "./catalogPerformance";

test("a tap belongs to the matching detail route, can be consumed once and expires", (context) => {
  const clock = context.mock.method(Date, "now", () => 1000);
  markCatalogTap("dish", "fixture-dish");
  assert.equal(consumeCatalogTap("stall", "fixture-dish"), undefined);
  assert.equal(consumeCatalogTap("dish", "different-dish"), undefined);
  assert.equal(consumeCatalogTap("dish", "fixture-dish"), 1000);
  assert.equal(consumeCatalogTap("dish", "fixture-dish"), undefined);
  markCatalogTap("stall", "fixture-stall");
  clock.mock.mockImplementation(() => 6001);
  assert.equal(consumeCatalogTap("stall", "fixture-stall"), undefined);
});

test("catalog metrics distinguish startup, route paint and failure durations without resource IDs", (context) => {
  clearTrackedAnalyticsEvents();
  const clock = context.mock.method(Date, "now", () => 1000);
  markCatalogAppStart();
  clock.mock.mockImplementation(() => 1350);
  recordCatalogPaint("home", "actionable", 1200);
  recordCatalogPaint("stall", "actionable", 1300, "success", "tap");
  recordCatalogRpc("dish", "get_dish_detail", 1250, "timeout");
  assert.deepEqual(
    getTrackedAnalyticsEvents().map(({ event, properties }) => [
      event,
      properties.milestone,
      properties.timing_origin,
      properties.outcome,
      properties.duration_ms,
    ]),
    [
      ["catalog_performance", "actionable", "mount", "success", 150],
      ["catalog_performance", "js_start_to_actionable", "js-start", "success", 350],
      ["catalog_performance", "actionable", "tap", "success", 50],
      ["catalog_performance", "get_dish_detail", "request", "timeout", 100],
    ],
  );
  assert.ok(
    getTrackedAnalyticsEvents().every(
      ({ properties }) => !("dish_id" in properties) && !("venue_id" in properties),
    ),
  );
});

test("catalog performance events obey analytics consent", () => {
  setAnalyticsEnabled(false);
  try {
    recordCatalogRpc("dish", "get_dish_detail", Date.now(), "timeout");
    assert.deepEqual(getTrackedAnalyticsEvents(), []);
  } finally {
    setAnalyticsEnabled(true);
  }
});
