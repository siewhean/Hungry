import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { buildResultPicks, fewDietaryPicksMessage } from "@/app/screens/onboarding/fillResultPicks";
import { describeTaste } from "@/app/screens/onboarding/resultPicks";

const dish = (id: string, price: number, dietaryFlags: string[] = []) => ({
  id,
  price,
  dietaryFlags,
});

test("taste matches come first, then popular dishes fill the grid", () => {
  const picks = buildResultPicks({
    ranked: [dish("r1", 5)],
    popular: ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => dish(id, 5)),
    count: 6,
    dietaryFlags: [],
    maxDishBudget: undefined,
  });
  assert.deepEqual(
    picks.map((pick) => [pick.dish.id, pick.popular]),
    [
      ["r1", false],
      ["p1", true],
      ["p2", true],
      ["p3", true],
      ["p4", true],
      ["p5", true],
    ],
  );
});

test("the budget removes dishes that cost more, from both lists", () => {
  const picks = buildResultPicks({
    ranked: [dish("cheap", 4.5), dish("pricey", 8)],
    popular: [dish("pop-cheap", 5.5), dish("pop-pricey", 12.8)],
    count: 6,
    dietaryFlags: [],
    maxDishBudget: 6,
  });
  assert.deepEqual(
    picks.map((pick) => pick.dish.id),
    ["cheap", "pop-cheap"],
  );
});

test("a dish must carry every requested diet, popular top-ups included", () => {
  const picks = buildResultPicks({
    ranked: [dish("halal-vegan", 5, ["halal", "vegan"]), dish("halal-only", 5, ["halal"])],
    popular: [dish("plain", 5), dish("halal-vegan-2", 5, ["halal", "vegan"])],
    count: 6,
    dietaryFlags: ["halal", "vegan"],
    maxDishBudget: undefined,
  });
  assert.deepEqual(
    picks.map((pick) => pick.dish.id),
    ["halal-vegan", "halal-vegan-2"],
  );
});

test("a dish in both lists appears once, as a taste match", () => {
  const picks = buildResultPicks({
    ranked: [dish("a", 5)],
    popular: [dish("a", 5), dish("b", 5)],
    count: 6,
    dietaryFlags: [],
    maxDishBudget: undefined,
  });
  assert.deepEqual(
    picks.map((pick) => [pick.dish.id, pick.popular]),
    [
      ["a", false],
      ["b", true],
    ],
  );
});

test("the grid never grows past the count", () => {
  const picks = buildResultPicks({
    ranked: ["a", "b", "c", "d", "e"].map((id) => dish(id, 5)),
    popular: ["f", "g"].map((id) => dish(id, 5)),
    count: 4,
    dietaryFlags: [],
    maxDishBudget: undefined,
  });
  assert.equal(picks.length, 4);
  assert.ok(picks.every((pick) => !pick.popular));
});

test("a short grid explains itself instead of looking broken", () => {
  assert.equal(
    fewDietaryPicksMessage(["halal"], 1),
    "Only 1 dish tagged halal so far. More appear on Home as stalls add them.",
  );
  assert.equal(
    fewDietaryPicksMessage(["gluten_free", "vegan"], 3),
    "Only 3 dishes tagged gluten free and vegan so far. More appear on Home as stalls add them.",
  );
});

test("describeTaste names the strongest leanings, light answers, or balance", () => {
  assert.match(
    describeTaste({ ...NEUTRAL_TASTE_VECTOR, spicy: 9, rich: 8, sweet: 7 })!,
    /^You lean spicy and rich\.$/,
  );
  assert.equal(
    describeTaste({ ...NEUTRAL_TASTE_VECTOR, spicy: 1 }),
    "You keep things light and mild.",
  );
  assert.equal(describeTaste({ ...NEUTRAL_TASTE_VECTOR }), "You like your flavours balanced.");
});

test("a dish with no listed price stays within any budget", () => {
  const picks = buildResultPicks({
    ranked: [dish("free", 0), dish("dear", 24)],
    popular: [],
    count: 4,
    dietaryFlags: [],
    maxDishBudget: 6,
  });
  assert.deepEqual(
    picks.map((pick) => pick.dish.id),
    ["free"],
  );
});
