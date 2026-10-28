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

test("searchDishes sends the quiz keywords only when asked, and maps course and cuisine tags", async () => {
  fake.rpc.search_dishes = () => ({
    data: [
      {
        dish_id: "d1",
        venue_id: "v1",
        building_id: "b1",
        venue_name: "Stall",
        name: "Wanton Mee",
        food_type: "Noodles",
        course: "Main",
        cuisine_tags: ["Chinese", "Local"],
        rating: 4,
        review_count: 1,
        price: 5,
        distance_meters: 100,
        rank_score: 1,
      },
    ],
  });
  const filters = {
    query: "",
    categories: [],
    dietaryFlags: [],
    tasteValues: NEUTRAL,
    radius: 1000,
    latitude: 1.28,
    longitude: 103.84,
  };
  const [first] = await service.discovery.searchDishes(
    { ...filters, cuisineKeywords: ["chinese"], stapleKeywords: ["noodle", "mee"] },
    NEUTRAL,
  );
  await service.discovery.searchDishes(filters, NEUTRAL);
  const calls = fake.callsTo("search_dishes").map((call) => call.args);
  assert.deepEqual(calls[0].p_cuisine_keywords, ["chinese"]);
  assert.deepEqual(calls[0].p_staple_keywords, ["noodle", "mee"]);
  assert.equal("p_cuisine_keywords" in calls[1], false, "no keywords, no new arguments");
  assert.equal(first.dish.course, "Main");
  assert.deepEqual(first.dish.cuisineTags, ["Chinese", "Local"]);
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

test("getVenuesByIds reads 120 uncached stalls in three batches of 50 and returns all of them (MD-B9)", async () => {
  fake.rpc.get_venue_summaries = (args) => ({
    data: (args.p_venue_ids as string[]).map((id) => ({ venue_id: id, name: `Stall ${id}` })),
  });
  const ids = Array.from({ length: 120 }, (_, index) => `v-bulk-${index}`);
  const venues = await service.discovery.getVenuesByIds(ids);
  assert.equal(venues.length, 120);
  assert.deepEqual(
    fake.callsTo("get_venue_summaries").map((call) => (call.args.p_venue_ids as string[]).length),
    [50, 50, 20],
  );
});

test("getVenuesByIds rejects when any one of the batches fails (MD-B9)", async () => {
  let call = 0;
  fake.rpc.get_venue_summaries = (args) => {
    call += 1;
    return call === 2
      ? { error: { message: "rate limited" } }
      : { data: (args.p_venue_ids as string[]).map((id) => ({ venue_id: id, name: id })) };
  };
  const ids = Array.from({ length: 120 }, (_, index) => `v-part-${index}`);
  await assert.rejects(service.discovery.getVenuesByIds(ids));
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
