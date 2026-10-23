import assert from "node:assert/strict";
import test from "node:test";

import type { CatalogRawDishCard } from "@/lib/services/catalog";
import {
  formatAwayLabel,
  loadSimilarDishes,
  pickSimilarDishes,
  similarDishQuery,
} from "@/features/detail/similarDishes";

const card = (id: string, venueId: string) => ({ id, venueId }) as unknown as CatalogRawDishCard;

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
      return { items: [card("a", "v0"), card("b", "v1")] };
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
    { query: "Laksa", sort: "nearby", limit: 12, coordinate: point, radiusMeters: 3000 },
  ]);
  assert.deepEqual(
    await loadSimilarDishes(service, { id: "x", venueId: "v0", name: "Set" }, undefined),
    [],
  );
  assert.equal(calls.length, 1);
});
