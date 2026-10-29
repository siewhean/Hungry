import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDecideAnswers,
  DECIDE_FOR_ME_OPTION_ID,
  DECIDE_QUESTIONS,
  decideAnswerMaxPrice,
  decideServerFilters,
  describeDecideAnswers,
  filterByDecideAnswers,
  givenServerAnswers,
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

test("keywords match whole words, so rice and fish dishes are not desserts", () => {
  const dishes = [
    dish("Chicken Rice", { price: 4 }),
    dish("Steamed Fish", { price: 9 }),
    dish("Iced Tea", { price: 2 }),
    dish("Ice Kachang", { price: 3 }),
  ];
  assert.deepEqual(
    filterByDecideAnswers(dishes, { staple: "dessert" }).map((d) => d.name),
    ["Iced Tea", "Ice Kachang"],
  );
  assert.deepEqual(
    filterByDecideAnswers([dish("Fishball Noodles"), dish("Kaya Toast")], {
      staple: "noodles",
    }).map((d) => d.name),
    ["Fishball Noodles"],
    "plural forms still match",
  );
});

test("answers that would empty the list are reported as relaxed", () => {
  const dishes = [
    dish("Chicken Rice", { price: 4.5 }),
    dish("Fish Soup", { price: 6 }),
    dish("Steamed Fish", { price: 9 }),
  ];
  const result = applyDecideAnswers(dishes, { cuisine: "japanese-korean", price: "under5" });
  assert.deepEqual(result.relaxed, ["cuisine"]);
  assert.deepEqual(
    result.dishes.map((d) => d.name),
    ["Chicken Rice"],
  );
  assert.deepEqual(applyDecideAnswers(dishes, { price: "under8" }).relaxed, []);
  assert.deepEqual(applyDecideAnswers([], { price: "under8" }).relaxed, [], "nothing to relax");
});

test("the result screen gets the chosen price and the answer labels", () => {
  assert.equal(decideAnswerMaxPrice({ price: "under8" }), 8);
  assert.equal(decideAnswerMaxPrice({ price: "decide" }), undefined);
  assert.deepEqual(
    describeDecideAnswers({ flavour: "spicy", cuisine: "malay", staple: "decide" }).map(
      (answer) => answer.label,
    ),
    ["Malay", "Spicy"],
  );
});

test("MD-D4 cuisine tags and the course count as text, the same fields the server matches", () => {
  const laksa = dish("Laksa", { cuisineTags: ["Malay"], foodTypeTag: "Noodles", course: "Main" });
  const tea = dish("Teh Tarik", { course: "Drink", cuisineTags: ["Local"] });
  assert.deepEqual(filterByDecideAnswers([laksa, tea], { cuisine: "malay" }), [laksa]);
  assert.deepEqual(filterByDecideAnswers([laksa, tea], { staple: "dessert" }), [tea]);
  assert.deepEqual(filterByDecideAnswers([laksa, tea], { staple: "noodles" }), [laksa]);
});

test("MD-D4 the server gets the keywords and price of the answers still in play", () => {
  const answers = { cuisine: "chinese", staple: "noodles", price: "under8", flavour: "spicy" };
  assert.deepEqual(givenServerAnswers(answers), ["staple", "cuisine", "price"]);
  const all = decideServerFilters(answers);
  assert.ok(all.cuisineKeywords?.includes("chinese"));
  assert.ok(all.stapleKeywords?.includes("noodle"));
  assert.equal(all.maxPrice, 8);
  const noStaple = decideServerFilters(answers, ["staple"]);
  assert.equal(noStaple.stapleKeywords, undefined);
  assert.ok(noStaple.cuisineKeywords);
  assert.deepEqual(decideServerFilters(answers, ["staple", "cuisine", "price"]), {});
  assert.deepEqual(decideServerFilters({}), {});
  assert.deepEqual(givenServerAnswers({ cuisine: DECIDE_FOR_ME_OPTION_ID }), []);
});
