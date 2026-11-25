import assert from "node:assert/strict";
import { act, useLayoutEffect } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { DISCOVER_FEED_LIMIT, DISCOVER_FIRST_PAGE_LIMIT } from "@/features/discover/bites";
import {
  DISCOVER_FEED_CACHE_MAX_AGE_MS,
  clearCachedDiscoverFeed,
} from "@/features/discover/feedCache";
import { getDiscoverReadArgs } from "@/features/discover/discoverReadArgs";
import { useDiscoverFeed } from "@/features/discover/useDiscoverFeed";
import { useLiveDiscoverFeed } from "@/features/discover/useLiveDiscoverFeed";
import { warmHomeFeed } from "@/features/discover/warmHomeFeed";
import {
  getServiceProvider,
  resetServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import { CatalogReadError } from "@/lib/services/catalogReads";
import type { DiscoveryLocationFeed, DiscoveryLocationFeedRequest } from "@/lib/services/types";
import { useLocationStore } from "@/store/useLocationStore";
import { useSessionStore } from "@/store/useSessionStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { VenueSummary } from "@/types/domain";

const venue = {
  id: "v1",
  name: "Ah Seng Fish Soup",
  buildingId: "b1",
  isOpen: true,
  operatingHours: "",
} as VenueSummary;
const liveFeed: DiscoveryLocationFeed = { venues: [venue], results: [] };
const emptyFeed: DiscoveryLocationFeed = { venues: [], results: [] };
const secondVenue = { ...venue, id: "v2", name: "Second Stall" };

function resultFor(stall: VenueSummary) {
  return {
    dish: { id: `dish-${stall.id}`, venueId: stall.id, dietaryFlags: ["halal"] },
    score: 1,
  } as never;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function installLiveProvider(enrich?: () => Promise<DiscoveryLocationFeed>) {
  const feed: ReturnType<typeof deferred<DiscoveryLocationFeed | undefined>>[] = [];
  const firstPage: ReturnType<typeof deferred<DiscoveryLocationFeed | undefined>>[] = [];
  const count: ReturnType<typeof deferred<number | undefined>>[] = [];
  const requests: DiscoveryLocationFeedRequest[] = [];
  const mock = getServiceProvider();
  setServiceProvider({
    ...mock,
    mode: "supabase",
    service: {
      ...mock.service,
      discovery: {
        ...mock.service.discovery,
        listDiscoveryFeedByLocation: (request) => {
          requests.push(request);
          const read = deferred<DiscoveryLocationFeed | undefined>();
          if (request.limit === DISCOVER_FIRST_PAGE_LIMIT) firstPage.push(read);
          else {
            assert.equal(request.limit, DISCOVER_FEED_LIMIT);
            feed.push(read);
          }
          return read.promise;
        },
        enrichDiscoveryFeed: enrich,
        countVenuesInArea: () => {
          const read = deferred<number | undefined>();
          count.push(read);
          return read.promise;
        },
      },
    },
  });
  return { feed, firstPage, count, requests };
}

async function mountFeed() {
  let latest: ReturnType<typeof useDiscoverFeed> | undefined;
  function Probe() {
    latest = useDiscoverFeed();
    return null;
  }
  const view = await render(<Probe />);
  return { view, feed: () => latest as ReturnType<typeof useDiscoverFeed> };
}

async function flushBackground() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(async () => {
  await enterScenario("user");
  clearCachedDiscoverFeed();
  useUIStore.setState({ isOffline: false });
  useLocationStore.setState({
    permission: "denied",
    currentLocation: { latitude: 1.2813, longitude: 103.8458 },
    manualCoordinate: undefined,
    manualLocation: undefined,
  });
});
afterEach(async () => {
  await cleanup();
  resetServiceProvider();
});

test("the first page commits before the full feed and never starts an unscoped count", async () => {
  const reads = installLiveProvider();
  const { view, feed } = await mountFeed();
  assert.equal(reads.firstPage.length, 1);
  assert.equal(reads.requests[0].deferEnrichment, true);
  assert.equal(reads.feed.length, 0);
  assert.equal(reads.count.length, 0);

  reads.firstPage[0].resolve(liveFeed);
  await view.settle();
  assert.deepEqual(feed().supabaseDiscoveryFeed, liveFeed);
  assert.equal(feed().loadedDiscoverFeedKey, feed().discoverFeedKey);
  assert.equal(feed().isDiscoverFeedPartial, true);
  await flushBackground();
  assert.equal(reads.feed.length, 1);
  assert.equal(reads.count.length, 0);

  reads.feed[0].resolve(liveFeed);
  await view.settle();
  assert.equal(feed().isDiscoverFeedPartial, false);
  assert.equal(feed().isSupabaseDiscoveryFeedLoading, false);
  assert.equal(reads.count.length, 0);
});

test("Home reuses the settled Splash page", async () => {
  const reads = installLiveProvider();
  const warming = warmHomeFeed();
  await Promise.resolve();
  reads.firstPage[0].resolve(liveFeed);
  await warming;

  const { feed } = await mountFeed();
  assert.equal(reads.firstPage.length, 1);
  assert.deepEqual(feed().supabaseDiscoveryFeed, liveFeed);
});

test("the full page refreshes the first results and removes rows it no longer authorizes", async () => {
  const enrichment = deferred<DiscoveryLocationFeed>();
  const reads = installLiveProvider(() => enrichment.promise);
  const { view, feed } = await mountFeed();
  const firstPage = { venues: [venue], results: [resultFor(venue)] };
  reads.firstPage[0].resolve({ ...firstPage, needsEnrichment: true });
  await view.settle();
  await flushBackground();
  reads.feed[0].resolve({ venues: [secondVenue], results: [resultFor(secondVenue)] });
  await view.settle();
  enrichment.resolve(firstPage);
  await view.settle();
  assert.deepEqual(
    feed().supabaseFeedVenues.map(({ id }) => id),
    [secondVenue.id],
  );
  assert.deepEqual(
    feed().supabaseFeedResults.map(({ dish }) => dish.id),
    ["dish-v2"],
  );
});

test("transient refresh errors keep prior same-area cards labeled stale; auth and empty clear them", async () => {
  const reads = installLiveProvider();
  const { view, feed } = await mountFeed();
  reads.firstPage[0].resolve({ venues: [venue], results: [resultFor(venue)] });
  await view.settle();

  await act(async () => {
    await feed().reloadDiscover();
  });
  reads.firstPage[1].reject(new CatalogReadError("too many requests", "rate-limit", 429));
  await view.settle();
  assert.equal(feed().discoverFailure, "rate-limit");
  assert.equal(feed().supabaseDiscoveryFeed?.isFallback, true);
  assert.deepEqual(feed().supabaseFeedResults[0].dish.dietaryFlags, []);
  assert.equal(feed().supabaseFeedVenues[0].availabilityUnverified, true);

  await act(async () => {
    await feed().reloadDiscover();
  });
  reads.firstPage[2].reject(new CatalogReadError("forbidden", "auth", 403));
  await view.settle();
  assert.equal(feed().discoverFailure, "auth");
  assert.equal(feed().supabaseDiscoveryFeed, null);

  await act(async () => {
    await feed().reloadDiscover();
  });
  reads.firstPage[3].resolve(emptyFeed);
  await view.settle();
  assert.deepEqual(feed().supabaseDiscoveryFeed, emptyFeed);
  assert.equal(feed().discoverLoadError, false);
});

test("an expired scoped snapshot is removed while the device stays offline", async (context) => {
  const initialTime = Date.now();
  const clock = context.mock.method(Date, "now", () => initialTime);
  const reads = installLiveProvider();
  const { view, feed } = await mountFeed();
  reads.firstPage[0].resolve(liveFeed);
  await view.settle();
  clock.mock.mockImplementation(() => initialTime + DISCOVER_FEED_CACHE_MAX_AGE_MS - 10);
  await act(async () => {
    useUIStore.setState({ isOffline: true });
  });
  assert.equal(feed().supabaseDiscoveryFeed?.isFallback, true);
  await flushBackground();
  assert.equal(feed().supabaseDiscoveryFeed, null);
  assert.equal(feed().discoverFailure, "network");
});

test("pending dietary flags are hidden and verified enrichment survives a wider-read timeout", async () => {
  const enrichment = deferred<DiscoveryLocationFeed>();
  const reads = installLiveProvider(() => enrichment.promise);
  const { view, feed } = await mountFeed();
  const verified = { ...liveFeed, results: [resultFor(venue)] };
  reads.firstPage[0].resolve({ ...verified, needsEnrichment: true });
  await view.settle();
  assert.equal(feed().supabaseFeedVenues[0].availabilityUnverified, true);
  assert.deepEqual(feed().supabaseFeedResults[0].dish.dietaryFlags, []);

  await flushBackground();
  reads.feed[0].reject(new CatalogReadError("timed out", "timeout"));
  await view.settle();
  assert.equal(feed().discoverFailure, "timeout");
  assert.equal(feed().isSupabaseDiscoveryFeedLoading, false);
  enrichment.resolve(verified);
  await view.settle();

  assert.equal(feed().supabaseFeedVenues[0].availabilityUnverified, undefined);
  assert.deepEqual(feed().supabaseFeedResults[0].dish.dietaryFlags, ["halal"]);
  assert.equal(feed().isDiscoverFeedPartial, true);
  assert.equal(reads.feed.length, 1, "a soft failure does not retry automatically");
});

test("changing buildings in the same area refreshes the wider feed without another preview", async () => {
  const reads = installLiveProvider();
  const args = getDiscoverReadArgs(useLocationStore.getState());
  let latest: ReturnType<typeof useLiveDiscoverFeed> | undefined;
  function Probe({ place }: { place: string }) {
    latest = useLiveDiscoverFeed(true, args, place, false);
    return null;
  }
  const view = await render(<Probe place="b1" />);
  reads.firstPage[0].resolve(liveFeed);
  await view.settle();
  await flushBackground();
  const buildingOnly = { ...venue, id: "only-b1" };
  reads.feed[0].resolve({ venues: [buildingOnly, venue], results: [] });
  await view.settle();
  assert.equal(latest?.state?.phase, "complete");
  assert.equal(
    latest?.state?.feed?.venues.some(({ id }) => id === buildingOnly.id),
    true,
  );

  await view.rerender(<Probe place="b2" />);
  await flushBackground();
  assert.equal(reads.firstPage.length, 1);
  assert.equal(reads.requests.at(-1)?.buildingId, "b2");
  assert.equal(latest?.isLoading, true);
  assert.deepEqual(
    latest?.state?.feed?.venues.map(({ id }) => id),
    ["v1"],
  );
  const secondBuilding = { ...secondVenue, buildingId: "b2" };
  reads.feed[1].resolve({ venues: [venue, secondBuilding], results: [] });
  await view.settle();
  assert.deepEqual(
    latest?.state?.feed?.venues.map(({ id }) => id),
    ["v2", "v1"],
  );
  assert.equal(latest?.isLoading, false);

  await view.rerender(<Probe place="b3" />);
  await flushBackground();
  reads.feed[2].reject(new CatalogReadError("timed out", "timeout"));
  await view.settle();
  assert.deepEqual(
    latest?.state?.feed?.venues.map(({ id }) => id),
    ["v1"],
  );
  assert.equal(latest?.isLoading, false);
  assert.equal(reads.firstPage.length, 1);
});

for (const failure of ["offline", "refresh"] as const) {
  test(`a ${failure} snapshot stays geographic when the current building changes`, async () => {
    const reads = installLiveProvider();
    const args = getDiscoverReadArgs(useLocationStore.getState());
    let latest: ReturnType<typeof useLiveDiscoverFeed> | undefined;
    function Probe({ place }: { place: string }) {
      latest = useLiveDiscoverFeed(true, args, place, false);
      return null;
    }
    const view = await render(<Probe place="b1" />);
    reads.firstPage[0].resolve(liveFeed);
    await view.settle();
    await flushBackground();
    const onlyFirstBuilding = { ...venue, id: "only-b1" };
    reads.feed[0].resolve({ venues: [onlyFirstBuilding, venue], results: [] });
    await view.settle();
    assert.deepEqual(
      latest?.state?.feed?.venues.map(({ id }) => id),
      ["v1", "only-b1"],
    );

    if (failure === "offline") {
      await act(async () => {
        useUIStore.setState({ isOffline: true });
      });
    } else {
      await act(async () => {
        await latest?.reload();
      });
      reads.firstPage[1].reject(new CatalogReadError("timed out", "timeout"));
    }
    await view.settle();
    await view.rerender(<Probe place="b2" />);

    assert.equal(latest?.state?.feed?.isFallback, true);
    assert.deepEqual(
      latest?.state?.feed?.venues.map(({ id }) => id),
      ["v1"],
    );
    assert.equal(reads.feed.length, 1);
  });
}

test("the previous building cannot replace the feed when another building commits", async () => {
  const reads = installLiveProvider();
  const args = getDiscoverReadArgs(useLocationStore.getState());
  let latest: ReturnType<typeof useLiveDiscoverFeed> | undefined;
  function Probe({ place }: { place: string }) {
    latest = useLiveDiscoverFeed(true, args, place, false);
    useLayoutEffect(() => {
      if (place === "b2") reads.feed[0].resolve(emptyFeed);
    }, [place]);
    return null;
  }
  const view = await render(<Probe place="b1" />);
  reads.firstPage[0].resolve(liveFeed);
  await view.settle();
  await flushBackground();
  await view.rerender(<Probe place="b2" />);
  await flushBackground();

  assert.equal(reads.firstPage.length, 1);
  assert.equal(reads.requests.at(-1)?.buildingId, "b2");
  assert.deepEqual(latest?.state?.feed, liveFeed);
  const newFeed = { venues: [secondVenue], results: [] };
  reads.feed[1].resolve(newFeed);
  await view.settle();
  assert.deepEqual(latest?.state?.feed, newFeed);
});

test("a granted permission with no GPS fix preserves the selected area for retries", async () => {
  const originalGrant = useLocationStore.getState().grantLocation;
  const manualCoordinate = { latitude: 1.354, longitude: 103.847 };
  let attempts = 0;
  useLocationStore.setState({
    manualLocation: "Bishan",
    manualCoordinate,
    grantLocation: async () => {
      attempts += 1;
      useLocationStore.setState({ permission: "granted" });
      return false;
    },
  });
  try {
    const { feed } = await mountFeed();
    await act(async () => {
      await feed().handleUseCurrentLocation();
    });
    assert.match(useUIStore.getState().toast?.message ?? "", /Couldn't get your current location/);
    assert.equal(useLocationStore.getState().manualLocation, "Bishan");
    await act(async () => {
      await feed().handleUseCurrentLocation();
    });
    assert.equal(attempts, 2);
    assert.deepEqual(useLocationStore.getState().manualCoordinate, manualCoordinate);
  } finally {
    useLocationStore.setState({ grantLocation: originalGrant });
  }
});

test("first-page failure leaves the full page idle; full-page timeout retains live cards", async () => {
  const reads = installLiveProvider();
  const { view, feed } = await mountFeed();
  reads.firstPage[0].reject(new CatalogReadError("timed out", "timeout"));
  await view.settle();
  await flushBackground();
  assert.equal(feed().discoverFailure, "timeout");
  assert.equal(feed().discoverLoadError, true);
  assert.equal(reads.feed.length, 0);
  assert.equal(reads.count.length, 0);

  await act(async () => {
    await feed().reloadDiscover();
  });
  reads.firstPage[1].resolve(liveFeed);
  await view.settle();
  await flushBackground();
  reads.feed[0].reject(new CatalogReadError("timed out", "timeout"));
  await view.settle();
  assert.deepEqual(feed().supabaseDiscoveryFeed, liveFeed);
  assert.equal(feed().isDiscoverFeedPartial, true);
  assert.equal(feed().discoverLoadError, false);
});

test("old area and old account completions cannot replace the current scoped feed", async () => {
  const reads = installLiveProvider();
  const { view, feed } = await mountFeed();
  await act(async () => {
    useLocationStore.setState({
      manualLocation: "Bishan",
      manualCoordinate: { latitude: 1.35, longitude: 103.85 },
    });
  });
  await act(async () => {
    useSessionStore.setState({ authenticatedUserId: "another-account" });
  });
  assert.equal(reads.firstPage.length, 3);
  reads.firstPage[2].resolve({ venues: [secondVenue], results: [] });
  reads.firstPage[0].resolve(liveFeed);
  reads.firstPage[1].resolve(liveFeed);
  await view.settle();
  assert.equal(feed().supabaseFeedVenues[0].id, secondVenue.id);
});
