import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { triedDishFacts, useAchievementTallyStore } from "./useAchievementTallyStore";

test("a tagged spicy dish counts as spicy and an untagged one never does", () => {
  const dish = {
    tasteVector: { ...NEUTRAL_TASTE_VECTOR, spicy: 8 },
    price: 4.5,
    tasteConfidence: 1,
  };
  assert.deepEqual(triedDishFacts(dish, true), { spicy: true, sweet: false, budget: true });
  assert.deepEqual(triedDishFacts(dish, false), { spicy: false, sweet: false, budget: true });
  assert.equal(triedDishFacts({ ...dish, price: 0 }, true).budget, false);
});

test("facts are kept per user and can be forgotten when a dish is un-marked", () => {
  const facts = { spicy: true, sweet: false, budget: false };
  useAchievementTallyStore.getState().recordTriedDish("user-a", "dish-1", facts);
  assert.deepEqual(useAchievementTallyStore.getState().triedByUser["user-a"]?.["dish-1"], facts);
  assert.equal(useAchievementTallyStore.getState().triedByUser["user-b"], undefined);
  useAchievementTallyStore.getState().forgetTriedDish("user-a", "dish-1");
  assert.equal(useAchievementTallyStore.getState().triedByUser["user-a"]?.["dish-1"], undefined);
});
