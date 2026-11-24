import assert from "node:assert/strict";
import { act } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { DISCOVER_FEED_LIMIT, DISCOVER_FIRST_PAGE_LIMIT } from "@/features/discover/bites";
import {
  DISCOVER_FEED_CACHE_MAX_AGE_MS,
  clearCachedDiscoverFeed,
} from "@/features/discover/feedCache";
import { useDiscoverFeed } from "@/features/discover/useDiscoverFeed";
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
  const reads = installLiveProvider();
  const { view, feed } = await mountFeed();
  reads.firstPage[0].resolve({ venues: [venue], results: [resultFor(venue)] });
  await view.settle();
  await flushBackground();
  reads.feed[0].resolve({ venues: [secondVenue], results: [resultFor(secondVenue)] });
  await view.settle();
  assert.deepEqual(
    feed().supabaseFeedVenues.map(({ id }) => id),
    [secondVenue.id],
  );
  assert.equal(feed().supabaseFeedResults.length, 1);
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

test("first-page enrichment can verify the existing cards while the wider feed is pending", async () => {
  const enrichment = deferred<DiscoveryLocationFeed>();
  const reads = installLiveProvider(() => enrichment.promise);
  const { view, feed } = await mountFeed();
  reads.firstPage[0].resolve({ ...liveFeed, needsEnrichment: true });
  await view.settle();
  assert.equal(feed().supabaseFeedVenues[0].availabilityUnverified, true);
  await flushBackground();
  enrichment.resolve(liveFeed);
  await view.settle();
  assert.equal(feed().supabaseFeedVenues[0].availabilityUnverified, undefined);
  assert.equal(feed().isDiscoverFeedPartial, true);
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
