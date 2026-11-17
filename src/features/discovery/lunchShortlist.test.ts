import assert from "node:assert/strict";
import test from "node:test";
import { dishes } from "@/lib/services/mock/data";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { hungryService } from "@/lib/services/mock/mockService";
import {
  buildLunchRequest,
  effectiveLunchBudget,
  eligibleLunchDishes,
  hasLunchLocation,
} from "./lunchShortlist";

test("lunch limits never relax profile budgets and invalid limits fail closed", () => {
  assert.equal(effectiveLunchBudget(8, 5), 5);
  assert.equal(effectiveLunchBudget(5, 8), 5);
  assert.equal(effectiveLunchBudget(8), 8);
  for (const invalid of [0, -1, NaN, Infinity]) {
    assert.equal(effectiveLunchBudget(8, invalid), 0);
    assert.equal(effectiveLunchBudget(invalid, 8), 0);
  }
});

test("GPS or explicit selected coordinates are required rather than fallback proximity", () => {
  const coordinate = { latitude: 1.28, longitude: 103.84 };
  assert.equal(hasLunchLocation("unknown", coordinate), false);
  assert.equal(hasLunchLocation("denied", coordinate), false);
  assert.equal(hasLunchLocation("granted", coordinate), true);
  assert.equal(hasLunchLocation("denied", coordinate, coordinate), true);
  assert.equal(hasLunchLocation("granted", { latitude: NaN, longitude: 103 }), false);
});

test("lunch response rejects invalid prices, out-of-range distances, dietary mismatches and duplicates", () => {
  const dish = dishes[0];
  const valid = { ...dish, price: 5, distanceMeters: 500 };
  assert.deepEqual(eligibleLunchDishes([valid, valid], 5, 500, []), [valid]);
  for (const price of [0, -1, NaN, Infinity, 5.01]) {
    assert.deepEqual(eligibleLunchDishes([{ ...valid, price }], 5, 500, []), []);
  }
  for (const distanceMeters of [-1, NaN, Infinity, 501]) {
    assert.deepEqual(eligibleLunchDishes([{ ...valid, distanceMeters }], 5, 500, []), []);
  }
  assert.deepEqual(eligibleLunchDishes([{ ...valid, dietaryFlags: [] }], 5, 500, ["halal"]), []);
});

test("lunch request sends budget into ranking before its candidate limit", async () => {
  const maxPrice = Math.min(...dishes.map((dish) => dish.price));
  const request = buildLunchRequest({
    tasteProfile: NEUTRAL_TASTE_VECTOR,
    dietaryFlags: [],
    coordinate: { latitude: 1.2813, longitude: 103.8458 },
    radiusMeters: 100_000,
    maxPrice,
  });
  assert.equal(request.maxPrice, maxPrice);
  assert.equal(request.radiusMeters, 100_000);
  const slate = await hungryService.recommendations.getSlate({ ...request, limit: 1 });
  assert.ok(slate.items.length > 0);
  assert.ok(slate.items.every(({ dish }) => dish.price > 0 && dish.price <= maxPrice));
});
