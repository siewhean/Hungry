// Decide for Me's server reads against a fake Supabase client: the search asks for the chosen
// price and a 50-row pool, and a failed stall batch or dish search rejects (one call, no
// fan-out), so screens show their retry rather than an empty result.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

let service: typeof import("./supabaseService").supabaseService;

const NEUTRAL = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.queries.length = 0;
  fake.rpc = {};
  fake.tables = {};
});

test("searchDishes sends the price ceiling and the requested pool size, capped at 50", async () => {
  fake.rpc.search_dishes = () => ({ data: [] });
  const filters = {
    query: "",
    categories: [],
    dietaryFlags: [],
    tasteValues: NEUTRAL,
    radius: 500,
    latitude: 1.28,
    longitude: 103.84,
  };
  await service.discovery.searchDishes({ ...filters, maxPrice: 8, limit: 50 }, NEUTRAL);
  await service.discovery.searchDishes({ ...filters, limit: 500 }, NEUTRAL);
  await service.discovery.searchDishes(filters, NEUTRAL);
  const calls = fake.callsTo("search_dishes").map((call) => call.args);
  assert.equal(calls[0].p_max_price, 8);
  assert.equal(calls[0].p_limit, 50);
  assert.equal(calls[1].p_limit, 50, "the server cap");
  assert.equal(calls[2].p_limit, 20, "the default");
  assert.equal(calls[2].p_max_price, null);
});

test("getVenuesByIds rejects when the batch fails, with one call and no per-stall reads", async () => {
  fake.rpc.get_venue_summaries = () => ({ error: { message: "network down" } });
  // Resolving with only the cached stalls would tell Saved and Followed stalls they closed.
  await assert.rejects(service.discovery.getVenuesByIds(["v-x1", "v-x2", "v-x3"]));
  assert.equal(fake.callsTo("get_venue_summaries").length, 1);
  assert.equal(fake.callsTo("get_venue_detail").length, 0);
});

test("getVenuesByIds still resolves an empty list for ids the server does not know", async () => {
  fake.rpc.get_venue_summaries = () => ({ data: [] });
  assert.deepEqual(await service.discovery.getVenuesByIds(["v-gone"]), []);
});

test("searchDishes rejects when the RPC fails and the cache has nothing (MAP-V3)", async () => {
  fake.rpc.search_dishes = () => ({ error: { message: "network down" } });
  const filters = {
    query: "",
    categories: [],
    dietaryFlags: [],
    tasteValues: NEUTRAL,
    radius: 500,
    latitude: 1.28,
    longitude: 103.84,
  };
  await assert.rejects(service.discovery.searchDishes(filters, NEUTRAL), /Couldn't search dishes/);
});

test("searchDishes with no match resolves empty, so the screen can say No match", async () => {
  fake.rpc.search_dishes = () => ({ data: [] });
  const filters = {
    query: "",
    categories: [],
    dietaryFlags: [],
    tasteValues: NEUTRAL,
    radius: 500,
  };
  assert.deepEqual(await service.discovery.searchDishes(filters, NEUTRAL), []);
});
