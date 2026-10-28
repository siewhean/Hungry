import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogRawDishCard } from "@/lib/services/catalog";
import {
  SIMILAR_DISH_FETCH_LIMIT,
  dishNameMatchesQuery,
  formatAwayLabel,
  loadSimilarDishes,
  pickSimilarDishes,
  similarDishQuery,
  similarDishTileLabel,
} from "@/features/detail/similarDishes";

const card = (id: string, venueId: string) => ({ id, venueId }) as unknown as CatalogRawDishCard;
const named = (id: string, venueId: string, name: string) =>
  ({ id, venueId, name }) as unknown as CatalogRawDishCard;

test("the similar-dish query drops portions and set words", () => {
  assert.equal(similarDishQuery("Chicken Satay (10 sticks)"), "Chicken Satay");
  assert.equal(similarDishQuery("Signature Laksa Set"), "Laksa");
  assert.equal(similarDishQuery("Roti Prata!"), "Roti Prata");
});

test("similar dishes come from other stalls, one per stall, up to the limit", () => {
  const picks = pickSimilarDishes(
    [card("same", "v0"), card("a", "v0"), card("b", "v1"), card("c", "v1"), card("d", "v2")],
    { id: "same", venueId: "v0" },
    5,
  );
  assert.deepEqual(
    picks.map((pick) => pick.id),
    ["b", "d"],
  );
  assert.equal(
    pickSimilarDishes([card("b", "v1"), card("d", "v2")], { id: "x", venueId: "v9" }, 1).length,
    1,
  );
});

test("distance labels round to tens of metres or tenths of a kilometre", () => {
  assert.equal(formatAwayLabel(undefined), undefined);
  assert.equal(formatAwayLabel(Number.NaN), undefined);
  assert.equal(formatAwayLabel(3), "10 m away");
  assert.equal(formatAwayLabel(245), "250 m away");
  assert.equal(formatAwayLabel(1420), "1.4 km away");
});

test("loading similar dishes makes one nearby read and drops the current stall", async () => {
  const calls: unknown[] = [];
  const service = {
    listDishes: async (input: unknown) => {
      calls.push(input);
      return { items: [named("a", "v0", "Laksa"), named("b", "v1", "Curry Laksa")] };
    },
  };
  const point = { latitude: 1.3, longitude: 103.8 };
  const picks = await loadSimilarDishes(
    service,
    { id: "x", venueId: "v0", name: "Laksa (large)" },
    point,
  );
  assert.deepEqual(
    picks.map((pick) => pick.id),
    ["b"],
  );
  assert.deepEqual(calls, [
    { query: "Laksa", sort: "nearby", limit: 40, coordinate: point, radiusMeters: 3000 },
  ]);
  assert.deepEqual(
    await loadSimilarDishes(service, { id: "x", venueId: "v0", name: "Set" }, undefined),
    [],
  );
  assert.equal(calls.length, 1);
});

test("a stall or building name match is not the same dish (DISH-3)", async () => {
  assert.equal(dishNameMatchesQuery("Roasted Chicken Rice Set", "Chicken Rice"), true);
  assert.equal(dishNameMatchesQuery("Barley", "Chicken Rice"), false);
  assert.equal(dishNameMatchesQuery("Chicken Wing", "Chicken Rice"), false);
  assert.equal(dishNameMatchesQuery("Licorice", "Rice"), false);

  const service = {
    // The RPC also matches venue_name: "Ah Seng Chicken Rice" sells Barley.
    listDishes: async () => ({
      items: [named("barley", "ah-seng", "Barley"), named("cr", "v2", "Chicken Rice")],
    }),
  };
  const picks = await loadSimilarDishes(
    service,
    { id: "x", venueId: "v0", name: "Chicken Rice" },
    { latitude: 1.3, longitude: 103.8 },
  );
  assert.deepEqual(
    picks.map((pick) => pick.id),
    ["cr"],
  );
});

test("the current stall's own matches do not use up the page (DISH-X2)", async () => {
  const calls: { limit: number }[] = [];
  const own = Array.from({ length: 10 }, (_, index) =>
    named(`own-${index}`, "v0", `Chicken Rice ${index}`),
  );
  const service = {
    listDishes: async (input: { limit: number }) => {
      calls.push(input);
      return {
        items: [
          ...own,
          named("a", "v1", "Chicken Rice"),
          named("b", "v2", "Chicken Rice"),
          named("c", "v3", "Chicken Rice"),
        ].slice(0, input.limit),
      };
    },
  };
  const picks = await loadSimilarDishes(
    service,
    { id: "own-0", venueId: "v0", name: "Chicken Rice" },
    { latitude: 1.3, longitude: 103.8 },
  );
  assert.deepEqual(
    picks.map((pick) => pick.id),
    ["a", "b", "c"],
  );
  assert.equal(calls[0]?.limit, SIMILAR_DISH_FETCH_LIMIT);
});

test("with no stall coordinate there is no nearby read and no tiles (DISH-14)", async () => {
  let called = 0;
  const service = {
    listDishes: async () => {
      called += 1;
      return { items: [named("a", "v1", "Laksa")] };
    },
  };
  assert.deepEqual(
    await loadSimilarDishes(service, { id: "x", venueId: "v0", name: "Laksa" }, undefined),
    [],
  );
  assert.equal(called, 0);
});

test("a nearby tile's spoken label carries its price, rating and distance (DISH-V6)", () => {
  assert.equal(
    similarDishTileLabel({
      name: "Laksa",
      venueName: "Sungei Road Laksa",
      price: 4.5,
      rating: 4.3,
      reviewCount: 12,
      distanceMeters: 450,
    }),
    "Open Laksa at Sungei Road Laksa, S$4.50, rated 4.3 from 12 reviews, 450 m away",
  );
  assert.equal(
    similarDishTileLabel({ name: "Laksa", venueName: "Stall", price: 0 }),
    "Open Laksa at Stall, Price not listed",
  );
});

test("a tile with one review, no price fields and an unknown distance still reads cleanly", () => {
  assert.equal(
    similarDishTileLabel({ name: "Laksa", venueName: "Stall", rating: 5, reviewCount: 1 }),
    "Open Laksa at Stall, Price not listed, rated 5.0 from 1 review",
  );
  assert.equal(
    similarDishTileLabel({ name: "Laksa", venueName: "Stall", rating: 4, reviewCount: 0 }),
    "Open Laksa at Stall, Price not listed",
    "a rating without reviews is not read out",
  );
  assert.equal(formatAwayLabel(Number.NaN), undefined);
  assert.equal(formatAwayLabel(3), "10 m away");
});

test("a name query with no words matches nothing, and short names load nothing", async () => {
  assert.equal(dishNameMatchesQuery("Laksa", "   "), false);
  let reads = 0;
  const service = {
    listDishes: async () => {
      reads += 1;
      return { items: [] };
    },
  };
  assert.deepEqual(
    await loadSimilarDishes(
      service,
      { id: "d1", venueId: "v1", name: "A" },
      {
        latitude: 1.3,
        longitude: 103.8,
      },
    ),
    [],
  );
  assert.equal(reads, 0);
});
