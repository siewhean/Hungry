// What Splash starts before Home opens: the same three reads Home makes, waiting only for the
// nearest stalls, and the request the shared read is keyed on.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";

import { DISCOVER_FEED_LIMIT, DISCOVER_FIRST_PAGE_LIMIT } from "@/features/discover/bites";
import {
  DISCOVER_AREA_RADIUS_METERS,
  DISCOVER_ISLAND_RADIUS_METERS,
  getDiscoverReadArgs,
} from "@/features/discover/discoverReadArgs";
import { warmHomeFeed } from "@/features/discover/warmHomeFeed";
import {
  getServiceProvider,
  resetServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import type { DiscoveryLocationFeedRequest } from "@/lib/services/types";
import { useLocationStore } from "@/store/useLocationStore";

afterEach(() => {
  resetServiceProvider();
});

function install(mode: "supabase" | "mock", options: { failFirstPage?: boolean } = {}) {
  const feedRequests: DiscoveryLocationFeedRequest[] = [];
  let counts = 0;
  const mock = getServiceProvider();
  setServiceProvider({
    ...mock,
    mode,
    service: {
      ...mock.service,
      discovery: {
        ...mock.service.discovery,
        listDiscoveryFeedByLocation: async (request) => {
          feedRequests.push(request);
          if (options.failFirstPage && request.limit === DISCOVER_FIRST_PAGE_LIMIT) {
            throw new Error("network down");
          }
          return { venues: [], results: [] };
        },
        countVenuesInArea: async () => {
          counts += 1;
          return 3;
        },
      },
    },
  });
  return { feedRequests, counts: () => counts };
}

test("warmHomeFeed starts the count, the first page and the full feed for the diner's place", async () => {
  const reads = install("supabase");
  await warmHomeFeed();
  assert.equal(reads.counts(), 1);
  assert.deepEqual(
    reads.feedRequests.map((request) => request.limit).sort(),
    [DISCOVER_FIRST_PAGE_LIMIT, DISCOVER_FEED_LIMIT].sort(),
  );
  const args = getDiscoverReadArgs(useLocationStore.getState());
  for (const request of reads.feedRequests) {
    assert.equal(request.lat, args.geoCellLatitude);
    assert.equal(request.lng, args.geoCellLongitude);
    assert.equal(request.radiusMeters, args.radiusMeters);
    assert.equal(request.buildingId, undefined);
  }
});

test("warmHomeFeed settles even when the first read fails", async () => {
  install("supabase", { failFirstPage: true });
  await assert.doesNotReject(warmHomeFeed());
});

test("warmHomeFeed reads nothing outside the live data source", async () => {
  const reads = install("mock");
  await warmHomeFeed();
  assert.equal(reads.counts(), 0);
  assert.equal(reads.feedRequests.length, 0);
});

test("getDiscoverReadArgs: no fix reads the island, a manual pick reads its area, a fix rounds to a grid cell", () => {
  const base = useLocationStore.getState();
  const island = getDiscoverReadArgs({
    ...base,
    permission: "denied",
    manualLocation: undefined,
    manualCoordinate: undefined,
  });
  assert.equal(island.needsAreaChoice, true);
  assert.equal(island.radiusMeters, DISCOVER_ISLAND_RADIUS_METERS);

  const picked = getDiscoverReadArgs({
    ...base,
    permission: "denied",
    manualLocation: "Bishan",
    manualCoordinate: { latitude: 1.3526, longitude: 103.8352 },
  });
  assert.equal(picked.needsAreaChoice, false);
  assert.equal(picked.areaName, "Bishan");
  assert.equal(picked.radiusMeters, DISCOVER_AREA_RADIUS_METERS);

  const fix = getDiscoverReadArgs({
    ...base,
    permission: "granted",
    currentLocation: { latitude: 1.30011, longitude: 103.80049 },
    manualLocation: undefined,
    manualCoordinate: undefined,
  });
  assert.equal(fix.geoCellLatitude, 1.3);
  assert.equal(fix.geoCellLongitude, 103.8);
});

test("Splash's read stays the same request as Home's read", () => {
  const hook = readFileSync("src/features/discover/useDiscoverFeed.ts", "utf8");
  assert.match(hook, /const DISCOVER_AREA_RADIUS_METERS = 3000/);
  assert.match(hook, /const DISCOVER_ISLAND_RADIUS_METERS = 30_000/);
  assert.match(hook, /const DISCOVER_GEOCELL_STEPS_PER_DEGREE = 500/);
  assert.match(
    hook,
    /areaName: discoverAreaRequest,\s*lat: discoverGeoCellLatitude,\s*lng: discoverGeoCellLongitude,\s*radiusMeters: discoverRadiusMeters,\s*buildingId: currentPlaceId,/,
  );
  const helper = readFileSync("src/features/discover/discoverReadArgs.ts", "utf8");
  assert.match(helper, /DISCOVER_AREA_RADIUS_METERS = 3000/);
  assert.match(helper, /DISCOVER_ISLAND_RADIUS_METERS = 30_000/);
  assert.match(helper, /DISCOVER_GEOCELL_STEPS_PER_DEGREE = 500/);
});
