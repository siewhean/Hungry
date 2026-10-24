import assert from "node:assert/strict";
import test from "node:test";

import {
  DECIDE_FOR_ME_OPTION_ID,
  DECIDE_QUESTIONS,
  filterByDecideAnswers,
  hasDecideConstraints,
} from "./decideQuiz";
import type { DishDetail, TasteVector } from "@/types/domain";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

function dish(id: string, overrides: Partial<DishDetail> = {}): DishDetail {
  return {
    id,
    venueId: "v",
    buildingId: "b",
    venueName: "Stall",
    unitNumber: "01-01",
    floor: "L1",
    name: id,
    imageUrl: "",
    distanceMeters: 100,
    rating: 4,
    reviewCount: 3,
    price: 5,
    priceRange: "$",
    tasteTags: [],
    tasteVector: NEUTRAL,
    dietaryFlags: [],
    gallery: [],
    mustOrder: false,
    availabilityFlags: [],
    reviews: [],
    ...overrides,
  };
}

test("every question offers Decide for me", () => {
  for (const question of DECIDE_QUESTIONS) {
    assert.ok(
      question.options.some((option) => option.id === DECIDE_FOR_ME_OPTION_ID),
      question.id,
    );
  }
});

test("Decide for me answers leave the list untouched", () => {
  const dishes = [dish("a"), dish("b")];
  const answers = { cuisine: "decide", staple: "decide", price: "decide", flavour: "decide" };
  assert.equal(hasDecideConstraints(answers), false);
  assert.deepEqual(filterByDecideAnswers(dishes, answers), dishes);
  assert.deepEqual(filterByDecideAnswers(dishes, {}), dishes);
});

test("answers narrow by food, price and flavour", () => {
  const dishes = [
    dish("Chicken Rice", { price: 4, foodTypeTag: "Rice" }),
    dish("Laksa", { price: 6, foodTypeTag: "Noodles", tasteVector: { ...NEUTRAL, spicy: 8 } }),
    dish("Wagyu Ramen", {
      price: 18,
      foodTypeTag: "Noodles",
      tasteVector: { ...NEUTRAL, rich: 8 },
    }),
  ];
  assert.deepEqual(
    filterByDecideAnswers(dishes, { staple: "noodles" }).map((d) => d.name),
    ["Laksa", "Wagyu Ramen"],
  );
  assert.deepEqual(
    filterByDecideAnswers(dishes, { staple: "noodles", price: "under8" }).map((d) => d.name),
    ["Laksa"],
  );
  assert.deepEqual(
    filterByDecideAnswers(dishes, { flavour: "spicy" }).map((d) => d.name),
    ["Laksa"],
  );
  assert.equal(hasDecideConstraints({ price: "under5" }), true);
});

test("a question that would empty the list is skipped", () => {
  const dishes = [dish("Chicken Rice", { price: 4, foodTypeTag: "Rice" })];
  const result = filterByDecideAnswers(dishes, { cuisine: "western", price: "under5" });
  assert.deepEqual(
    result.map((d) => d.name),
    ["Chicken Rice"],
  );
});
