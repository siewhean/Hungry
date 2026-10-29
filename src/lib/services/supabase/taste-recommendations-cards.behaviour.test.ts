// get_taste_recommendations returns the card itself (20261028090000), so the first picks show
// without the full catalog download: no catalog read happens, and the stall pin reaches the dish.

import assert from "node:assert/strict";
import test, { before, beforeEach } from "node:test";

import type { RecommendationSlateRequest } from "@/lib/services/types";
import { installFakeSupabase } from "@/test/supabase/appClient";

const { fake } = installFakeSupabase();

let service: typeof import("./supabaseService").supabaseService;

before(async () => {
  const { setConfiguredDataSource } = await import("./client");
  setConfiguredDataSource("supabase");
  service = (await import("./supabaseService")).supabaseService;
});

beforeEach(() => {
  fake.rpcCalls.length = 0;
  fake.rpc = {};
  fake.tables = {};
});

const request: RecommendationSlateRequest = {
  surface: "home",
  tasteProfile: { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 },
  dietaryFlags: ["halal"],
  latitude: 1.2806,
  longitude: 103.8505,
  limit: 6,
};

/** One row as the function returns it: the five ranking columns, then the card columns. */
function cardRow(overrides: Record<string, unknown> = {}) {
  return {
    dish_id: "dish-prod-1",
    match_score: 0.82,
    match_percent: 82,
    match_reason: "Spicy profile match",
    is_serendipitous: false,
    venue_id: "venue-prod-1",
    building_id: "bld-prod-7001",
    venue_name: "Sungei Road Laksa",
    unit_number: "#01-54",
    floor: "1",
    name: "Laksa",
    image_url: null,
    blurhash: null,
    distance_meters: 450,
    rating: 4.5,
    review_count: 12,
    price: 5.5,
    price_range: "$",
    food_type: "laksa",
    taste_tags: ["spicy"],
    taste_vector: { sweet: 3, spicy: 8, sour: 4, salty: 5, rich: 7, aromatic: 6 },
    dietary_flags: ["halal"],
    latitude: 1.2812,
    longitude: 103.8507,
    ...overrides,
  };
}

test("the picks are built from the rows, with no catalog download", async () => {
  fake.rpc.get_taste_recommendations = () => ({ data: [cardRow()], error: null });
  const slate = await service.recommendations.getSlate(request);
  assert.equal(slate.items.length, 1);
  const { dish, matchPercent } = slate.items[0]!;
  assert.equal(matchPercent, 82);
  assert.equal(dish.id, "dish-prod-1");
  assert.equal(dish.name, "Laksa");
  assert.equal(dish.venueName, "Sungei Road Laksa");
  assert.equal(dish.unitNumber, "#01-54");
  assert.equal(dish.buildingId, "bld-prod-7001");
  assert.equal(dish.price, 5.5);
  assert.equal(dish.foodTypeTag, "laksa");
  assert.deepEqual(dish.dietaryFlags, ["halal"]);
  assert.equal(dish.tasteVector.spicy, 8);
  assert.deepEqual(dish.venuePin, { latitude: 1.2812, longitude: 103.8507 });
  assert.deepEqual(
    fake.rpcCalls.map((call) => call.name),
    ["get_taste_recommendations"],
    "nothing else is read",
  );
  for (const table of ["buildings", "venues", "dishes"]) {
    assert.equal(fake.queriesOn(table).length, 0, `${table} is not downloaded`);
  }
});

test("the request still carries the position, diet and limit to the function", async () => {
  fake.rpc.get_taste_recommendations = () => ({ data: [cardRow()], error: null });
  await service.recommendations.getSlate(request);
  const [call] = fake.callsTo("get_taste_recommendations");
  assert.equal(call?.args.p_lat, 1.2806);
  assert.equal(call?.args.p_lng, 103.8505);
  assert.deepEqual(call?.args.p_dietary_flags, ["halal"]);
  assert.equal(call?.args.p_limit, 6);
});

test("a photo the server did not approve leaves the card without one", async () => {
  fake.rpc.get_taste_recommendations = () => ({
    data: [
      cardRow({ image_url: null }),
      cardRow({ dish_id: "dish-prod-2", image_url: "https://x.test/a.jpg" }),
    ],
    error: null,
  });
  const { items } = await service.recommendations.getSlate(request);
  assert.equal(items[0]!.dish.imageUrl, "");
  assert.equal(items[1]!.dish.imageUrl, "https://x.test/a.jpg");
});

test("a stall with no usable position gives a card with no pin", async () => {
  fake.rpc.get_taste_recommendations = () => ({
    data: [cardRow({ latitude: null, longitude: null })],
    error: null,
  });
  const { items } = await service.recommendations.getSlate(request);
  assert.equal(items[0]!.dish.venuePin, undefined);
});

test("rows from before the card columns (ids only) still ask for the catalog, as before", async () => {
  fake.rpc.get_taste_recommendations = () => ({
    data: [
      {
        dish_id: "dish-prod-1",
        match_score: 0.8,
        match_percent: 80,
        match_reason: "Taste profile match",
        is_serendipitous: false,
      },
    ],
    error: null,
  });
  await service.recommendations.getSlate(request);
  assert.ok(
    fake.queriesOn("dishes").length > 0,
    "the catalog download is still the way to turn id-only rows into dishes",
  );
});
