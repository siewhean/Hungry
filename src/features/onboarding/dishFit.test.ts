import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { dishFitChips, dishReasonChips } from "./dishFit";

const dish = {
  ...NEUTRAL_TASTE_VECTOR,
  spicy: 8,
  sweet: 1,
  salty: 1,
  sour: 1,
  rich: 1,
  aromatic: 1,
};

test("a spice-sensitive person is told a spicy dish will hit harder", () => {
  const chips = dishFitChips(dish, { ...NEUTRAL_TASTE_VECTOR, spicy: 1 });
  assert.equal(chips[0], "More spicy for you");
});

test("a spice-loving person is told it is gentler, and a neutral one gets 'just your'", () => {
  assert.equal(
    dishFitChips(dish, { ...NEUTRAL_TASTE_VECTOR, spicy: 10 })[0],
    "Gentler spicy for you",
  );
  assert.equal(dishFitChips(dish, NEUTRAL_TASTE_VECTOR)[0], "Just your spicy");
});

test("a dish with no taste vector gets no chips and the list is capped", () => {
  assert.deepEqual(dishFitChips(undefined, NEUTRAL_TASTE_VECTOR), []);
  const loud = { ...NEUTRAL_TASTE_VECTOR, spicy: 9, sweet: 9, salty: 9, sour: 9 };
  assert.equal(dishFitChips(loud, NEUTRAL_TASTE_VECTOR).length, 2);
});

test("reasons name only axes the dish is strong on and the person likes", () => {
  assert.deepEqual(dishReasonChips(dish, { ...NEUTRAL_TASTE_VECTOR, spicy: 9 }), [
    "You like spicy",
  ]);
  assert.deepEqual(dishReasonChips(dish, { ...NEUTRAL_TASTE_VECTOR, spicy: 3 }), []);
  assert.deepEqual(dishReasonChips(undefined, NEUTRAL_TASTE_VECTOR), []);
});
