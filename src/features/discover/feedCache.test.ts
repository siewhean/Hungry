import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  DISCOVER_FEED_CACHE_MAX_AGE_MS,
  clearCachedDiscoverFeed,
  readCachedDiscoverFeed,
  writeCachedDiscoverFeed,
} from "@/features/discover/feedCache";
import type { DiscoveryLocationFeed } from "@/lib/services/types";
import type { VenueSummary } from "@/types/domain";

const venue = { id: "v1", name: "Ah Seng", buildingId: "b1" } as VenueSummary;
const feed: DiscoveryLocationFeed = { venues: [venue], results: [] };

beforeEach(async () => {
  await clearCachedDiscoverFeed();
});

test("a saved feed comes back for the same area and no other", async () => {
  await writeCachedDiscoverFeed("area-a", feed, 1_000);
  assert.deepEqual(await readCachedDiscoverFeed("area-a", 2_000), feed);
  assert.equal(await readCachedDiscoverFeed("area-b", 2_000), null);
});

test("a feed older than the max age is not shown", async () => {
  await writeCachedDiscoverFeed("area-a", feed, 1_000);
  const justInside = 1_000 + DISCOVER_FEED_CACHE_MAX_AGE_MS;
  assert.deepEqual(await readCachedDiscoverFeed("area-a", justInside), feed);
  assert.equal(await readCachedDiscoverFeed("area-a", justInside + 1), null);
});

test("an offline copy or an empty feed never replaces a good saved feed", async () => {
  await writeCachedDiscoverFeed("area-a", feed, 1_000);
  await writeCachedDiscoverFeed("area-a", { ...feed, isFallback: true }, 2_000);
  await writeCachedDiscoverFeed("area-a", { venues: [], results: [] }, 3_000);
  assert.deepEqual(await readCachedDiscoverFeed("area-a", 4_000), feed);
});

test("clearing forgets the saved feed", async () => {
  await writeCachedDiscoverFeed("area-a", feed, 1_000);
  await clearCachedDiscoverFeed();
  assert.equal(await readCachedDiscoverFeed("area-a", 2_000), null);
});
