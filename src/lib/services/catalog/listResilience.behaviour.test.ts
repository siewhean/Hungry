// A stall list that loaded once is shown again when a later read of it fails, identical reads
// share one request, and a read that never answers gives up instead of spinning for good.

import assert from "node:assert/strict";
import test, { before, beforeEach, mock } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

let service: typeof import("./index").catalogRawService;
let CatalogNetworkError: typeof import("./index").CatalogNetworkError;

before(async () => {
  const { setConfiguredDataSource } = await import("@/lib/services/supabase/client");
  setConfiguredDataSource("supabase");
  const catalog = await import("./index");
  service = catalog.catalogRawService;
  CatalogNetworkError = catalog.CatalogNetworkError;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.rpc = {};
  service.clearCache();
});

const RELEASE = "9b1c3c56-6b7e-4c1c-9b7a-2f1f0a2b3c4d";
const emptyPage = (nextCursor: string | null = null) => ({
  data: {
    items: [],
    next_cursor: nextCursor,
    release_id: RELEASE,
    match_count: 0,
    totals: { venues: 0, dishes: 0 },
  },
  error: null,
});
const serverTimeout = () => ({
  data: null,
  error: { message: "canceling statement due to statement timeout", code: "57014" },
});

test("a failed re-read of a list that loaded before shows the earlier copy", async () => {
  fake.rpc.catalog_raw_venues_page = () => emptyPage();
  const first = await service.listVenues({ lat: 1.3, lng: 103.8 } as never);
  // Jump the clock so the 60 s cache has expired; only the saved copy is left.
  mock.timers.enable({ apis: ["Date"], now: Date.now() + 120_000 });
  try {
    fake.rpc.catalog_raw_venues_page = serverTimeout;
    const again = await service.listVenues({ lat: 1.3, lng: 103.8 } as never);
    assert.equal(again.releaseId, first.releaseId);
  } finally {
    mock.timers.reset();
  }
});

test("a first-ever read that fails still throws", async () => {
  fake.rpc.catalog_raw_venues_page = serverTimeout;
  await assert.rejects(() => service.listVenues({ lat: 1.3, lng: 103.8 } as never));
});

test("a later page (cursor) is never answered from an earlier copy", async () => {
  fake.rpc.catalog_raw_venues_page = () => emptyPage("next");
  await service.listVenues({ lat: 1.3, lng: 103.8, cursor: "c1" } as never);
  mock.timers.enable({ apis: ["Date"], now: Date.now() + 120_000 });
  try {
    fake.rpc.catalog_raw_venues_page = serverTimeout;
    await assert.rejects(() => service.listVenues({ lat: 1.3, lng: 103.8, cursor: "c1" } as never));
  } finally {
    mock.timers.reset();
  }
});

test("two identical reads at once send one request", async () => {
  fake.rpc.catalog_raw_places = async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return { data: [], error: null };
  };
  const request = { coordinate: { latitude: 1.3, longitude: 103.8 }, limit: 3 };
  await Promise.all([service.listPlaces(request), service.listPlaces(request)]);
  assert.equal(fake.callsTo("catalog_raw_places").length, 1);
});

test("a read that never answers gives up with a network error", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    fake.rpc.catalog_raw_dishes_page = () => new Promise(() => undefined);
    const read = service.listDishes({ query: "laksa" });
    // Let the session check finish so the timeout is armed, then run the clock past it.
    await new Promise((resolve) => setImmediate(resolve));
    mock.timers.tick(16_000);
    await assert.rejects(() => read, CatalogNetworkError);
  } finally {
    mock.timers.reset();
  }
});
