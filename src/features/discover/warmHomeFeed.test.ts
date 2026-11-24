// Splash warms only the preview page that Home will use.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { DISCOVER_FIRST_PAGE_LIMIT } from "@/features/discover/bites";
import {
  DISCOVER_AREA_RADIUS_METERS,
  DISCOVER_ISLAND_RADIUS_METERS,
  getDiscoverReadArgs,
} from "@/features/discover/discoverReadArgs";
import { loadDiscoverFirstPage, warmHomeFeed } from "@/features/discover/warmHomeFeed";
import {
  getServiceProvider,
  resetServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import { clearCachedDiscoverFeed } from "@/features/discover/feedCache";
import { catalogRequestScope } from "@/lib/services/supabase/catalogReads";
import type { DiscoveryLocationFeedRequest } from "@/lib/services/types";
import { useLocationStore } from "@/store/useLocationStore";

afterEach(() => {
  clearCachedDiscoverFeed();
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

test("warmHomeFeed starts one preview and Home reuses the same settled request", async () => {
  const reads = install("supabase");
  await warmHomeFeed();
  const args = getDiscoverReadArgs(useLocationStore.getState());
  await loadDiscoverFirstPage(catalogRequestScope(), args);
  assert.equal(reads.counts(), 0);
  assert.deepEqual(reads.feedRequests, [
    {
      areaName: args.areaName,
      lat: args.geoCellLatitude,
      lng: args.geoCellLongitude,
      radiusMeters: args.radiusMeters,
      limit: DISCOVER_FIRST_PAGE_LIMIT,
      deferEnrichment: true,
    },
  ]);
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
