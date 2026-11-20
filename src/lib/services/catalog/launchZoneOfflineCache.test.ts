import assert from "node:assert/strict";
import test from "node:test";

import { hungryPersistStorage } from "@/store/persistStorage";

import {
  __resetLaunchZoneCacheMemoryForTest,
  buildLaunchZonePageCacheKey,
  clearLaunchZoneOfflineCache,
  isCacheableLaunchZonePageRequest,
  LAUNCH_ZONE_CACHE_KEY,
  LAUNCH_ZONE_MAX_AGE_MS,
  LAUNCH_ZONE_OFFLINE_RELEASE_ID,
  readCachedLaunchZoneDishesPage,
  readCachedLaunchZonePlaces,
  readCachedLaunchZoneVenuesPage,
  rememberLaunchZoneDishesPage,
  rememberLaunchZonePlaces,
  rememberLaunchZoneVenuesPage,
} from "./launchZoneOfflineCache";
import type { CatalogPage, CatalogPlace, CatalogRawDishCard, CatalogRawVenueCard } from "./index";

const PLACES: CatalogPlace[] = [
  {
    id: "jurong-west-hc",
    name: "Jurong West Hawker Centre",
    buildingType: "hawker_centre",
    venueCount: 45,
  },
  {
    id: "pioneer-mall",
    name: "Pioneer Mall",
    buildingType: "mall",
    venueCount: 25,
  },
  {
    id: "blk-651",
    name: "Kimly Coffeeshop (Blk 651)",
    buildingType: "food_court",
    venueCount: 16,
  },
];

function sampleDish(index: number): CatalogRawDishCard {
  return {
    id: `dish-${index}`,
    venueId: "venue-1",
    buildingId: "jurong-west-hc",
    name: `Munchi Min Jiang Kueh #${index}`,
    venueName: "Munchi Pancakes",
    buildingName: "Jurong West Hawker Centre",
    buildingType: "hawker_centre",
    price: 1.8,
    priceBasis: "counter",
    cuisineTags: ["local"],
    dietaryFlags: ["halal"],
    sectionTags: [],
    verificationStatus: "verified",
    menuRightsStatus: "approved",
    mediaRightsStatus: "approved",
  };
}

function sampleVenue(index: number): CatalogRawVenueCard {
  return {
    id: `venue-${index}`,
    buildingId: "jurong-west-hc",
    name: `Stall #${index}`,
    buildingName: "Jurong West Hawker Centre",
    buildingType: "hawker_centre",
    unitNumber: `#01-0${index}`,
    menuCount: 5,
    qualityRating: 4.5,
    qualityReviewCount: 12,
    verificationStatus: "verified",
    menuRightsStatus: "approved",
    mediaRightsStatus: "approved",
  };
}

test("launchZoneOfflineCache caches zone places, dishes, and venues without leaking synthetic releaseId", async () => {
  clearLaunchZoneOfflineCache();
  const t0 = 1_700_000_000_000;

  assert.equal(await readCachedLaunchZonePlaces(t0), null);
  await rememberLaunchZonePlaces(PLACES, t0);
  assert.deepEqual(await readCachedLaunchZonePlaces(t0 + 1000), PLACES);

  const dishPage: CatalogPage<CatalogRawDishCard> = {
    items: [sampleDish(1), sampleDish(2)],
    nextCursor: "server-cursor-123",
    releaseId: "live-release-1",
    totals: { venues: 45, dishes: 44 },
  };
  await rememberLaunchZoneDishesPage({ buildingId: "jurong-west-hc" }, dishPage, t0);

  const cachedDishes = await readCachedLaunchZoneDishesPage(
    { buildingId: "jurong-west-hc" },
    t0 + 5000,
  );
  assert.equal(cachedDishes?.items.length, 2);
  assert.equal(
    cachedDishes?.nextCursor,
    undefined,
    "offline copy must not keep live server cursor",
  );
  assert.equal(cachedDishes?.releaseId, "", "offline copy must omit synthetic/expirable releaseId");
  assert.notEqual(cachedDishes?.releaseId, LAUNCH_ZONE_OFFLINE_RELEASE_ID);

  const venuePage: CatalogPage<CatalogRawVenueCard> = {
    items: [sampleVenue(1)],
    nextCursor: "venue-cursor-1",
    releaseId: "live-release-1",
    totals: { venues: 45, dishes: 44 },
  };
  await rememberLaunchZoneVenuesPage({ buildingId: "jurong-west-hc" }, venuePage, t0);
  const cachedVenues = await readCachedLaunchZoneVenuesPage(
    { buildingId: "jurong-west-hc" },
    t0 + 5000,
  );
  assert.equal(cachedVenues?.items.length, 1);
  assert.equal(cachedVenues?.nextCursor, undefined);
  assert.equal(cachedVenues?.releaseId, "");
});

test("launchZoneOfflineCache tracks per-entry freshness independently and distinguishes sort/limit keys", async () => {
  clearLaunchZoneOfflineCache();
  const t0 = 1_700_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  await rememberLaunchZonePlaces(PLACES, t0);

  const known = new Set(PLACES.map((p) => p.id));
  assert.equal(isCacheableLaunchZonePageRequest({ buildingId: "jurong-west-hc" }, known), true);
  assert.equal(isCacheableLaunchZonePageRequest({ buildingId: "outside-mall" }, known), false);
  assert.equal(
    isCacheableLaunchZonePageRequest({ buildingId: "jurong-west-hc", query: "laksa" }, known),
    false,
  );
  assert.equal(
    isCacheableLaunchZonePageRequest({ buildingId: "jurong-west-hc", cursor: "abc" }, known),
    false,
  );
  assert.equal(
    isCacheableLaunchZonePageRequest({ buildingId: "jurong-west-hc", openOnly: true }, known),
    false,
  );
  assert.equal(
    isCacheableLaunchZonePageRequest(
      { buildingId: "jurong-west-hc", coordinate: { latitude: 1.34, longitude: 103.7 } },
      known,
    ),
    false,
  );
  assert.equal(
    isCacheableLaunchZonePageRequest({ buildingId: "jurong-west-hc", radiusMeters: 500 }, known),
    false,
  );
  assert.equal(
    isCacheableLaunchZonePageRequest({ buildingId: "jurong-west-hc", releaseId: "r-1" }, known),
    false,
  );
  assert.equal(
    isCacheableLaunchZonePageRequest({ buildingId: "jurong-west-hc", limit: 0 }, known),
    false,
  );

  // Distinct limit and sort produce distinct normalized keys so limit: 1 never receives 2 items.
  assert.notEqual(
    buildLaunchZonePageCacheKey({ buildingId: "jurong-west-hc" }, known),
    buildLaunchZonePageCacheKey({ buildingId: "jurong-west-hc", limit: 1 }, known),
  );
  assert.notEqual(
    buildLaunchZonePageCacheKey({ buildingId: "jurong-west-hc", sort: "quality" }, known),
    buildLaunchZonePageCacheKey({ buildingId: "jurong-west-hc", sort: "price" }, known),
  );

  // Cache dish page on day 0, refresh places on day 6 -> dish page must STILL expire on day 8.
  await rememberLaunchZoneDishesPage(
    { buildingId: "jurong-west-hc" },
    { items: [sampleDish(1), sampleDish(2)], releaseId: "r1", totals: { venues: 45, dishes: 44 } },
    t0,
  );
  await rememberLaunchZoneDishesPage(
    { buildingId: "jurong-west-hc", limit: 1 },
    { items: [sampleDish(1)], releaseId: "r1", totals: { venues: 45, dishes: 44 } },
    t0,
  );
  assert.equal(
    (await readCachedLaunchZoneDishesPage({ buildingId: "jurong-west-hc", limit: 1 }, t0 + 100))
      ?.items.length,
    1,
  );

  await rememberLaunchZonePlaces(PLACES, t0 + 6 * day);
  assert.deepEqual(await readCachedLaunchZonePlaces(t0 + 8 * day), PLACES);
  assert.equal(
    await readCachedLaunchZoneDishesPage({ buildingId: "jurong-west-hc" }, t0 + 8 * day),
    null,
    "refreshing places must not extend an older dish page beyond 7 days",
  );
  assert.equal(await readCachedLaunchZonePlaces(t0 + 6 * day + LAUNCH_ZONE_MAX_AGE_MS + 1), null);
  clearLaunchZoneOfflineCache();
});

test("launchZoneOfflineCache serializes concurrent writes, shares cold hydration, and ignores stale hydration after clear", async () => {
  clearLaunchZoneOfflineCache();
  const t0 = 1_700_000_000_000;
  await rememberLaunchZonePlaces(PLACES, t0);

  // Concurrent dish + venue writes must preserve both entries without lost updates.
  await Promise.all([
    rememberLaunchZoneDishesPage(
      { buildingId: "jurong-west-hc" },
      { items: [sampleDish(1)], releaseId: "r1", totals: { venues: 45, dishes: 44 } },
      t0,
    ),
    rememberLaunchZoneVenuesPage(
      { buildingId: "jurong-west-hc" },
      { items: [sampleVenue(1)], releaseId: "r1", totals: { venues: 45, dishes: 44 } },
      t0,
    ),
  ]);
  assert.equal(
    (await readCachedLaunchZoneDishesPage({ buildingId: "jurong-west-hc" }, t0 + 10))?.items.length,
    1,
  );
  assert.equal(
    (await readCachedLaunchZoneVenuesPage({ buildingId: "jurong-west-hc" }, t0 + 10))?.items.length,
    1,
  );

  // Simulate slow async storage hydration: concurrent cold reads must wait on the same promise,
  // and clearLaunchZoneOfflineCache() mid-hydration must reject the stale read completion.
  assert.ok(hungryPersistStorage);
  const storage = hungryPersistStorage;
  const originalGetItem = storage.getItem;
  let resolveSlowRead!: (val: Awaited<ReturnType<typeof originalGetItem>>) => void;
  const persistedPayload = {
    version: 2,
    state: {
      version: 2 as const,
      placesSavedAtMs: t0,
      places: PLACES,
      dishesByKey: {},
      venuesByKey: {},
    },
  };
  let getItemCalls = 0;
  storage.getItem = ((key: string) => {
    if (key !== LAUNCH_ZONE_CACHE_KEY) return originalGetItem(key);
    getItemCalls += 1;
    return new Promise((resolve) => {
      resolveSlowRead = resolve;
    });
  }) as typeof originalGetItem;

  try {
    __resetLaunchZoneCacheMemoryForTest();
    const readA = readCachedLaunchZonePlaces(t0 + 100);
    const readB = readCachedLaunchZonePlaces(t0 + 100);
    assert.equal(getItemCalls, 1, "concurrent cold reads must share one hydration request");
    resolveSlowRead(persistedPayload);
    const [resA, resB] = await Promise.all([readA, readB]);
    assert.deepEqual(resA, PLACES);
    assert.deepEqual(resB, PLACES);

    // Now start a cold read, clear before getItem resolves, and verify stale payload is discarded.
    __resetLaunchZoneCacheMemoryForTest();
    const readBeforeClear = readCachedLaunchZonePlaces(t0 + 100);
    clearLaunchZoneOfflineCache();
    resolveSlowRead(persistedPayload);
    assert.equal(await readBeforeClear, null);
    assert.equal(await readCachedLaunchZonePlaces(t0 + 100), null);
  } finally {
    storage.getItem = originalGetItem;
    clearLaunchZoneOfflineCache();
  }
});

test("launchZoneOfflineCache trims oversized per-building lists to stay within the 150 KB budget", async () => {
  clearLaunchZoneOfflineCache();
  const t0 = 1_700_000_000_000;
  await rememberLaunchZonePlaces(PLACES, t0);

  const hugeItems = Array.from({ length: 120 }, (_, idx) => ({
    ...sampleDish(idx),
    description: "x".repeat(1400),
  }));
  await rememberLaunchZoneDishesPage(
    { buildingId: "jurong-west-hc" },
    {
      items: hugeItems,
      releaseId: "live-release-1",
      totals: { venues: 45, dishes: 120 },
    },
    t0,
  );

  const cached = await readCachedLaunchZoneDishesPage({ buildingId: "jurong-west-hc" }, t0 + 100);
  assert.equal(cached?.items.length, 20);

  // Malformed persisted payload (e.g. places: [null]) must degrade cleanly to null without throwing.
  assert.ok(hungryPersistStorage);
  hungryPersistStorage.setItem(LAUNCH_ZONE_CACHE_KEY, {
    version: 2,
    state: {
      version: 2,
      placesSavedAtMs: t0,
      places: [null],
      dishesByKey: {},
      venuesByKey: {},
    } as never,
  });
  __resetLaunchZoneCacheMemoryForTest();
  assert.equal(await readCachedLaunchZonePlaces(t0 + 100), null);
  assert.equal(
    await readCachedLaunchZoneDishesPage({ buildingId: "jurong-west-hc" }, t0 + 100),
    null,
  );
  clearLaunchZoneOfflineCache();
});
