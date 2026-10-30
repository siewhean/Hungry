import assert from "node:assert/strict";
import test from "node:test";

import { dishes } from "@/lib/services/mock/data";
import {
  MAX_FEATURED_DISHES,
  countFeaturedDishes,
  isFeaturedLimitError,
} from "@/features/merchant/featuredDishes";

const base = dishes[0]!;

test("a stall can feature three dishes", () => {
  assert.equal(MAX_FEATURED_DISHES, 3);
});

test("featured dishes are counted whatever the flag's case, and other flags are not", () => {
  const menu = [
    { ...base, id: "a", availabilityFlags: ["featured"] },
    { ...base, id: "b", availabilityFlags: ["Featured", "sold_out"] },
    { ...base, id: "c", availabilityFlags: ["sold_out"] },
    { ...base, id: "d", availabilityFlags: [] },
  ];
  assert.equal(countFeaturedDishes(menu), 2);
  assert.equal(countFeaturedDishes([]), 0);
});

test("only the database's check violation counts as the featured limit", () => {
  assert.equal(isFeaturedLimitError({ code: "23514", message: "You can feature up to 3" }), true);
  assert.equal(isFeaturedLimitError({ code: "42501" }), false);
  assert.equal(isFeaturedLimitError(new Error("network")), false);
  assert.equal(isFeaturedLimitError(null), false);
});
