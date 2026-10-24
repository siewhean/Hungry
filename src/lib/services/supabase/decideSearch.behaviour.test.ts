// Decide for Me's server reads against a fake Supabase client: the search asks for the chosen
// price and a 50-row pool, and a failed stall batch does not fan out into one read per stall.

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

test("getVenuesByIds makes one batched call and no per-stall reads when it fails", async () => {
  fake.rpc.get_venue_summaries = () => ({ error: { message: "network down" } });
  const venues = await service.discovery.getVenuesByIds(["v-x1", "v-x2", "v-x3"]);
  assert.deepEqual(venues, []);
  assert.equal(fake.callsTo("get_venue_summaries").length, 1);
  assert.equal(fake.callsTo("get_venue_detail").length, 0);
});
