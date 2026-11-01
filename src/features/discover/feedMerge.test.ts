import assert from "node:assert/strict";
import test from "node:test";

import { mergeDiscoverFeeds } from "@/features/discover/feedMerge";
import type { DiscoveryLocationFeed } from "@/lib/services/types";

function feedOf(venueIds: string[], extra: Partial<DiscoveryLocationFeed> = {}) {
  return {
    venues: venueIds.map((id) => ({ id })),
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

test("a full read with nothing new returns the first page's stalls", () => {
  const merged = mergeDiscoverFeeds(feedOf(["a", "b"]), feedOf([]));
  assert.deepEqual(idsOf(merged), ["a", "b"]);
});
