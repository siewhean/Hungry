import assert from "node:assert/strict";
import test from "node:test";

import {
  clearScopedBrowseCatalogCache,
  loadScopedBrowseCatalog,
} from "@/features/search/scopedBrowseCatalog";
import type { HungryService } from "@/lib/services/types";
import type { DishDetail, VenueSummary } from "@/types/domain";

const venue: VenueSummary = {
  id: "venue-1",
  buildingId: "building-1",
  name: "Source-backed stall",
  unitNumber: "#01-01",
  floor: "L1",
  isOpen: true,
  topDishId: "dish-1",
  operatingHours: "10:00-20:00",
  deliveryLinks: [],
};

const dish: DishDetail = {
  id: "dish-1",
  venueId: venue.id,
  buildingId: venue.buildingId,
  venueName: venue.name,
  unitNumber: venue.unitNumber,
  floor: venue.floor,
  name: "Chicken rice",
  imageUrl: "https://example.com/chicken-rice.jpg",
  distanceMeters: 180,
  rating: 4.5,
  reviewCount: 10,
  price: 5.5,
  priceRange: "S$5.50",
  tasteTags: [],
  tasteVector: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
  dietaryFlags: [],
  gallery: [],
  mustOrder: false,
  availabilityFlags: [],
  reviews: [],
};

function serviceWithFeed(
  load: () => Promise<
    { venues: VenueSummary[]; results: { dish: DishDetail; score: number }[] } | undefined
  >,
): HungryService {
  return {
    discovery: { listDiscoveryFeedByLocation: load },
  } as unknown as HungryService;
}

test("scoped browse waits for the bounded service response and builds venue indexes", async () => {
  clearScopedBrowseCatalogCache();
  let resolveFeed:
    | ((feed: { venues: VenueSummary[]; results: { dish: DishDetail; score: number }[] }) => void)
    | undefined;
  const deferred = new Promise<{
    venues: VenueSummary[];
    results: { dish: DishDetail; score: number }[];
  }>((resolve) => {
    resolveFeed = resolve;
  });
  const pending = loadScopedBrowseCatalog(
    serviceWithFeed(() => deferred),
    {
      lat: 1.3,
      lng: 103.8,
    },
  );

  resolveFeed?.({ venues: [venue], results: [{ dish, score: 1 }] });
  const index = await pending;

  assert.equal(index.allDishes[0]?.id, dish.id);
  assert.equal(index.venueById.get(venue.id)?.name, venue.name);
  assert.equal(index.sortedDishesByVenueId.get(venue.id)?.[0]?.id, dish.id);
});

test("empty and failed scoped pages are not cached, while successful pages are", async () => {
  clearScopedBrowseCatalogCache();
  let calls = 0;
  const service = serviceWithFeed(async () => {
    calls += 1;
    if (calls === 1) return { venues: [], results: [] };
    return { venues: [venue], results: [{ dish, score: 1 }] };
  });
  const request = { lat: 1.3, lng: 103.8 };

  assert.equal((await loadScopedBrowseCatalog(service, request)).allDishes.length, 0);
  assert.equal((await loadScopedBrowseCatalog(service, request)).allDishes.length, 1);
  assert.equal((await loadScopedBrowseCatalog(service, request)).allDishes.length, 1);
  assert.equal(calls, 2);

  const unavailableService = serviceWithFeed(async () => undefined);
  await assert.rejects(loadScopedBrowseCatalog(unavailableService, request), /unavailable/i);
  await assert.rejects(loadScopedBrowseCatalog(unavailableService, request), /unavailable/i);
});

test("rounded location changes create a new bounded page", async () => {
  clearScopedBrowseCatalogCache();
  let calls = 0;
  const service = serviceWithFeed(async () => {
    calls += 1;
    return { venues: [venue], results: [{ dish, score: 1 }] };
  });

  await loadScopedBrowseCatalog(service, { lat: 1.3, lng: 103.8 });
  await loadScopedBrowseCatalog(service, { lat: 1.301, lng: 103.8 });

  assert.equal(calls, 2);
});

test("successful scoped pages expire so catalog truth can refresh", async () => {
  clearScopedBrowseCatalogCache();
  const realNow = Date.now;
  let now = 1_000;
  let calls = 0;
  Date.now = () => now;
  const service = serviceWithFeed(async () => {
    calls += 1;
    return { venues: [venue], results: [{ dish, score: 1 }] };
  });

  try {
    await loadScopedBrowseCatalog(service, { lat: 1.3, lng: 103.8 });
    now += 59_000;
    await loadScopedBrowseCatalog(service, { lat: 1.3, lng: 103.8 });
    assert.equal(calls, 1);

    now += 1_001;
    await loadScopedBrowseCatalog(service, { lat: 1.3, lng: 103.8 });
    assert.equal(calls, 2);
  } finally {
    Date.now = realNow;
  }
});
