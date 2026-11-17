import assert from "node:assert/strict";
import test from "node:test";
import { createRateLimitedExecutor, mergeCheckpointProgress, runWorkerPool } from "./enrichment-concurrency.mjs";
import { PLATFORM_ADAPTERS, extractMenuItemsFromStructuredData } from "./platform-scrapers.mjs";
import { collectStructuredVenueCandidates, PLATFORM_RESOLVERS } from "./platform-resolvers.mjs";

test("registers all four delivery platform adapters and direct resolvers", () => {
  assert.deepEqual(Object.keys(PLATFORM_ADAPTERS).sort(), ["deliveroo", "foodpanda", "grabfood", "oddle"]);
  assert.deepEqual(Object.keys(PLATFORM_RESOLVERS).sort(), ["deliveroo", "foodpanda", "grabfood", "oddle"]);
});

test("extracts menu records from Grab- and Foodpanda-like structured data", () => {
  const items = extractMenuItemsFromStructuredData({
    grab: { name: "Laksa", priceInMinorUnit: 680, images: ["https://huawei-food-cms.grab.com/laksa.jpg"] },
    panda: {
      product_name: "Chicken Rice",
      productVariations: [{ price: 5.5 }],
      images: [{ imagePath: "https://images.deliveryhero.io/chicken.jpg" }],
    },
  });
  assert.equal(items.length, 2);
  assert.equal(items.find((item) => item.name === "Laksa")?.price, "6.80");
  assert.equal(items.find((item) => item.name === "Chicken Rice")?.price, "5.5");
});

test("Oddle adapter rejects unrelated official URLs", () => {
  assert.equal(PLATFORM_ADAPTERS.oddle.routeIsValid("https://merchant.example.com/menu"), false);
  assert.equal(PLATFORM_ADAPTERS.oddle.routeIsValid("https://eats.oddle.me/menus/example"), true);
});

test("review-only platform adapters use menu-specific selectors and disable inserts", () => {
  for (const platform of ["foodpanda", "deliveroo"]) {
    const adapter = PLATFORM_ADAPTERS[platform];
    assert.equal(adapter.allowInserts, false);
    assert.doesNotMatch(adapter.containerSelectors, /(?:^|,\s*)(?:article|li)(?:,|$)/);
  }
});

test("collects only platform menu URLs from nested search state", () => {
  const candidates = collectStructuredVenueCandidates({
    results: [
      { name: "Soup Spoon", url: "/restaurant/abc/soup-spoon" },
      { name: "Noise", url: "/groceries/noise" },
    ],
  }, {
    baseUrl: "https://www.foodpanda.sg/restaurants/new",
    matchesUrl: PLATFORM_RESOLVERS.foodpanda.matchesUrl,
  });
  assert.equal(candidates.length, 1);
  assert.match(candidates[0].url, /\/restaurant\/abc\/soup-spoon/);
});

test("worker pool stays within the requested bounded concurrency", async () => {
  let active = 0;
  let peak = 0;
  const results = await runWorkerPool([1, 2, 3, 4, 5], 3, async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });
  assert.equal(peak, 3);
  assert.deepEqual(results, [2, 4, 6, 8, 10]);
});

test("write limiter serializes operations", async () => {
  let active = 0;
  let peak = 0;
  const schedule = createRateLimitedExecutor({ minIntervalMs: 0 });
  await Promise.all([1, 2, 3].map((value) => schedule(async () => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 3));
    active -= 1;
    return value;
  })));
  assert.equal(peak, 1);
});

test("checkpoint progress remains monotonic when workers finish out of order", () => {
  const state = { lastProcessedIndex: -1, completedVenueIds: new Set() };
  mergeCheckpointProgress(state, { index: 4, venue: { id: "venue-b", name: "B" }, success: 3, completed: true });
  const progress = mergeCheckpointProgress(state, { index: 1, venue: { id: "venue-a", name: "A" }, success: 2, completed: true });
  assert.equal(progress.last_processed_index, 4);
  assert.deepEqual(progress.completed_venue_ids.sort(), ["venue-a", "venue-b"]);
});
