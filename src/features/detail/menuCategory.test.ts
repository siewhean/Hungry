import assert from "node:assert/strict";
import test from "node:test";

import {
  ADD_ONS_CATEGORY,
  compareMenuCategories,
  inferDishCategory,
} from "@/features/detail/menuCategory";
import type { DishDetail } from "@/types/domain";

const dishOf = (overrides: Partial<DishDetail>) =>
  ({
    id: "d",
    name: "Dish",
    price: 5,
    priceRange: "",
    availabilityFlags: [],
    dietaryFlags: [],
    mustOrder: false,
    ...overrides,
  }) as unknown as DishDetail;

test("R4-STALL-11: a free-text availability flag does not create a category", () => {
  assert.equal(inferDishCategory(dishOf({ availabilityFlags: ["Fresh Catch Daily"] })), "Menu");
  assert.equal(inferDishCategory(dishOf({ availabilityFlags: ["seasonal", "sold_out"] })), "Menu");
});

test("an owner's section still wins, then name-based categories", () => {
  assert.equal(
    inferDishCategory(dishOf({ name: "Chicken Rice", availabilityFlags: ["section:Mains"] })),
    "Mains",
  );
  assert.equal(inferDishCategory(dishOf({ name: "Chicken Rice" })), "Rice");
  assert.equal(inferDishCategory(dishOf({ name: "Kopi", mustOrder: true })), "Popular");
});

test("R4-STALL-18: toppings and '+' priced extras are Add-ons, listed last", () => {
  assert.equal(
    inferDishCategory(dishOf({ name: "Fudge or Fruit Topping", price: 1 })),
    ADD_ONS_CATEGORY,
  );
  assert.equal(
    inferDishCategory(dishOf({ name: "Earle's Butter", priceRange: "+1" })),
    ADD_ONS_CATEGORY,
  );
  // A real dish with "extra" in its name and a real price is not an add-on.
  assert.equal(inferDishCategory(dishOf({ name: "Extra Large Laksa", price: 8 })), "Menu");
  const sorted = [ADD_ONS_CATEGORY, "Mains", "Drinks", "Rice"].sort(compareMenuCategories);
  assert.deepEqual(sorted, ["Rice", "Drinks", "Mains", ADD_ONS_CATEGORY]);
});
