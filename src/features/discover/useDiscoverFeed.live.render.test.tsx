// Home's live feed read (Supabase mode): the page draws when the feed lands without waiting for the
// area count, makes one feed read per load, and a feed saved on the phone draws before the live
// read lands. Run with `node scripts/test-render.mjs src/features/discover/useDiscoverFeed.live.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { clearCachedDiscoverFeed } from "@/features/discover/feedCache";
import { useDiscoverFeed } from "@/features/discover/useDiscoverFeed";
import {
  getServiceProvider,
  resetServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import type { DiscoveryLocationFeed } from "@/lib/services/types";
import { cleanup, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import { useLocationStore } from "@/store/useLocationStore";
import type { VenueSummary } from "@/types/domain";

const venue = {
  id: "v1",
  name: "Ah Seng Fish Soup",
  buildingId: "b1",
  isOpen: true,
  operatingHours: "",
} as VenueSummary;
const liveFeed: DiscoveryLocationFeed = { venues: [venue], results: [] };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

type Reads = {
  feed: ReturnType<typeof deferred<DiscoveryLocationFeed | undefined>>[];
  count: ReturnType<typeof deferred<number | undefined>>[];
};

function installLiveProvider(): Reads {
  const reads: Reads = { feed: [], count: [] };
  const mock = getServiceProvider();
  setServiceProvider({
    ...mock,
    mode: "supabase",
    service: {
      ...mock.service,
      discovery: {
        ...mock.service.discovery,
        listDiscoveryFeedByLocation: () => {
          const read = deferred<DiscoveryLocationFeed | undefined>();
          reads.feed.push(read);
          return read.promise;
        },
        countVenuesInArea: () => {
          const read = deferred<number | undefined>();
          reads.count.push(read);
          return read.promise;
        },
      },
    },
  });
  return reads;
}

async function mountFeed(onMounted?: () => void) {
  let latest: ReturnType<typeof useDiscoverFeed> | undefined;
  function Probe() {
    latest = useDiscoverFeed();
    return null;
  }
  const view = await render(<Probe />);
  onMounted?.();
  await view.settle();
  return { view, feed: () => latest as ReturnType<typeof useDiscoverFeed> };
}

beforeEach(async () => {
  await enterScenario("user");
  await clearCachedDiscoverFeed();
});
afterEach(async () => {
  await cleanup();
  resetServiceProvider();
});

test("the feed draws as soon as it lands; the area count fills in after, and the load ends with it", async () => {
  const reads = installLiveProvider();
  const { view, feed } = await mountFeed();
  assert.equal(reads.feed.length, 1, "one feed read per load");
  assert.equal(feed().supabaseDiscoveryFeed, null, "nothing yet");

  reads.feed[0].resolve(liveFeed);
  await view.settle();
  assert.deepEqual(
    feed().supabaseDiscoveryFeed,
    liveFeed,
    "the feed is on screen before the count",
  );
  assert.equal(feed().loadedDiscoverFeedKey, feed().discoverFeedKey, "so no skeleton");
  assert.equal(feed().isSupabaseDiscoveryFeedLoading, true, "the count line is still loading");
  assert.equal(feed().supabaseDiscoverAreaCount, null);

  reads.count[0].resolve(42);
  await view.settle();
  assert.equal(feed().supabaseDiscoverAreaCount, 42);
  assert.equal(feed().isSupabaseDiscoveryFeedLoading, false);
});

test("a failed count keeps the feed; a failed feed reports the error", async () => {
  const reads = installLiveProvider();
  const { view, feed } = await mountFeed();
  reads.count[0].reject(new Error("count down"));
  reads.feed[0].resolve(liveFeed);
  await view.settle();
  assert.deepEqual(feed().supabaseDiscoveryFeed, liveFeed);
  assert.equal(feed().supabaseDiscoverAreaCount, null);
  assert.equal(feed().discoverLoadError, false);
  assert.equal(feed().isSupabaseDiscoveryFeedLoading, false);
  await view.unmount();

  const failing = installLiveProvider();
  const second = await mountFeed();
  failing.feed[0].reject(new Error("feed down"));
  failing.count[0].resolve(3);
  await second.view.settle();
  assert.equal(second.feed().discoverLoadError, true);
});

test("a feed saved by the last visit draws before the live read lands, then the live feed replaces it", async () => {
  const first = installLiveProvider();
  const { view, feed } = await mountFeed();
  first.feed[0].resolve(liveFeed);
  first.count[0].resolve(1);
  await view.settle();
  const key = feed().discoverFeedKey;
  await view.unmount();

  const second = installLiveProvider();
  const next = await mountFeed();
  assert.equal(second.feed.length, 1, "the live read still runs");
  assert.equal(next.feed().discoverFeedKey, key);
  assert.deepEqual(next.feed().supabaseDiscoveryFeed, liveFeed, "the saved feed is already up");
  assert.equal(next.feed().loadedDiscoverFeedKey, key, "so Home shows cards, not a skeleton");

  const freshVenue = { ...venue, id: "v2", name: "Newer Stall" } as VenueSummary;
  second.feed[0].resolve({ venues: [freshVenue], results: [] });
  await next.view.settle();
  assert.equal(next.feed().supabaseDiscoveryFeed?.venues[0].id, "v2", "the live feed wins");
});

test("with location on, the feed read starts beside the place lookup and is reused when no place is found", async () => {
  useLocationStore.setState({
    permission: "granted",
    currentLocation: { latitude: 1.3048, longitude: 103.8318 },
    manualCoordinate: undefined,
    manualLocation: undefined,
  });
  const reads = installLiveProvider();
  let readsWhileLookingUp = -1;
  const { view, feed } = await mountFeed(() => {
    readsWhileLookingUp = reads.feed.length;
  });
  assert.equal(readsWhileLookingUp, 1, "the read is already out while the place lookup is");
  // Wherever the lookup ends, the whole load is one feed read and one count read.
  assert.equal(reads.feed.length, 1, "no second feed read after the lookup ends");
  assert.equal(reads.count.length, 1);

  reads.feed[0].resolve(liveFeed);
  reads.count[0].resolve(5);
  await view.settle();
  assert.deepEqual(feed().supabaseDiscoveryFeed, liveFeed);
  assert.equal(feed().isSupabaseDiscoveryFeedLoading, false);
});
