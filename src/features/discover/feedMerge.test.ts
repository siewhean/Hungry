import assert from "node:assert/strict";
import test from "node:test";

import { mergeDiscoverFeeds } from "@/features/discover/feedMerge";
import type { DiscoveryLocationFeed } from "@/lib/services/types";

function feedOf(
  venueIds: string[],
  extra: Partial<DiscoveryLocationFeed> = {},
  venueBuildings: Record<string, string> = {},
) {
  return {
    venues: venueIds.map((id) => ({ id, buildingId: venueBuildings[id] })),
    results: venueIds.map((id, index) => ({
      dish: { id: `dish-${id}`, venueId: id },
      score: 1 - index / 100,
    })),
    ...extra,
  } as unknown as DiscoveryLocationFeed;
}

const idsOf = (feed: DiscoveryLocationFeed) => feed.venues.map((venue) => venue.id);
const dishVenueIdsOf = (feed: DiscoveryLocationFeed) =>
  feed.results.map((result) => result.dish.venueId);

test("the first page keeps its places and the rest of the full read follows", () => {
  const merged = mergeDiscoverFeeds(feedOf(["a", "b"]), feedOf(["c", "a", "d", "b"]));
  assert.deepEqual(idsOf(merged), ["a", "b", "c", "d"]);
  assert.deepEqual(dishVenueIdsOf(merged), ["a", "b", "c", "d"]);
});

test("a stall in both reads appears once", () => {
  const merged = mergeDiscoverFeeds(feedOf(["a"]), feedOf(["a", "b"]));
  assert.equal(new Set(idsOf(merged)).size, merged.venues.length);
  assert.equal(new Set(dishVenueIdsOf(merged)).size, merged.results.length);
});

test("the full read decides the fallback state", () => {
  const fallback = feedOf(["x"], { isFallback: true });
  assert.equal(mergeDiscoverFeeds(feedOf(["a"]), fallback), fallback);
  const live = mergeDiscoverFeeds(feedOf(["a"]), feedOf(["a", "b"]));
  assert.equal(live.isFallback, undefined);
});

test("an authoritative empty full read removes the first page", () => {
  const merged = mergeDiscoverFeeds(feedOf(["a", "b"]), feedOf([]));
  assert.deepEqual(idsOf(merged), []);
});

test("current-building stalls and dishes stay first, with preview order inside each group", () => {
  const preview = feedOf(["a", "c", "b", "d"]);
  const full = feedOf(["b", "c", "d", "a", "e"], {}, { b: "mall", c: "mall", e: "mall" });
  const merged = mergeDiscoverFeeds(preview, full, "mall");
  assert.deepEqual(idsOf(merged), ["c", "b", "e", "a", "d"]);
  assert.deepEqual(dishVenueIdsOf(merged), ["c", "b", "e", "a", "d"]);
});
