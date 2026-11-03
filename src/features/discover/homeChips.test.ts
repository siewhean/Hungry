import assert from "node:assert/strict";
import test from "node:test";

import {
  cannotTakeSpice,
  fitChipsToDiner,
  isChipInSeason,
  kindsOfNames,
  type HomeChipContext,
} from "./homeChips";

const CHIPS = [
  "spicy",
  "halal",
  "cheap",
  "vegetarian",
  "noodles",
  "rice",
  "soup",
  "dessert",
  "drinks",
  "breakfast",
  "western",
].map((id) => ({ id }));

const ctx = (overrides: Partial<HomeChipContext> = {}): HomeChipContext => ({
  hour: 12,
  avoidSpicy: false,
  dietaryPreferences: [],
  knownKinds: new Set(),
  activeIds: new Set(),
  ...overrides,
});
const ids = (context: HomeChipContext) => fitChipsToDiner(CHIPS, context).map((chip) => chip.id);

test("breakfast is offered in the morning only", () => {
  assert.ok(ids(ctx({ hour: 8 })).includes("breakfast"));
  assert.equal(ids(ctx({ hour: 19 })).includes("breakfast"), false);
  assert.equal(ids(ctx({ hour: 12 })).includes("breakfast"), false);
});

test("dinner time offers rice, noodles and soup but not drinks or breakfast", () => {
  const dinner = ids(ctx({ hour: 19 }));
  for (const id of ["rice", "noodles", "soup", "western", "dessert"])
    assert.ok(dinner.includes(id), id);
  for (const id of ["breakfast", "drinks"]) assert.equal(dinner.includes(id), false, id);
});

test("late at night only the night foods stay", () => {
  const night = ids(ctx({ hour: 1 }));
  assert.ok(night.includes("soup"));
  for (const id of ["breakfast", "rice", "western", "dessert", "drinks"]) {
    assert.equal(night.includes(id), false, id);
  }
});

test("someone who cannot take spice never sees the spicy chip, unless it is on", () => {
  assert.equal(ids(ctx({ avoidSpicy: true })).includes("spicy"), false);
  assert.ok(ids(ctx({ avoidSpicy: true, activeIds: new Set(["spicy"]) })).includes("spicy"));
  assert.ok(ids(ctx()).includes("spicy"));
});

test("a chip that is on stays even out of season", () => {
  assert.ok(ids(ctx({ hour: 19, activeIds: new Set(["breakfast"]) })).includes("breakfast"));
});

test("a saved vegetarian need replaces the Vegetarian chip", () => {
  assert.equal(ids(ctx({ dietaryPreferences: ["vegetarian"] })).includes("vegetarian"), false);
  assert.equal(ids(ctx({ dietaryPreferences: ["vegan"] })).includes("vegetarian"), false);
  assert.ok(ids(ctx({ dietaryPreferences: ["halal"] })).includes("vegetarian"));
});

test("foods the diner knows come first, the rest keep their order", () => {
  const order = ids(ctx({ hour: 19, knownKinds: new Set(["soup", "rice"]) }));
  assert.deepEqual(order.slice(0, 2), ["rice", "soup"]);
  assert.deepEqual(
    order.slice(2),
    ["spicy", "halal", "cheap", "vegetarian", "noodles", "dessert", "western"].filter((id) =>
      order.includes(id),
    ),
  );
});

test("the spice rule reads the quiz first, then the learned palate", () => {
  assert.equal(
    cannotTakeSpice({ tasteVector: { spicy: 8 }, tasteProfile: { spiceSeeking: 1 } }),
    true,
  );
  assert.equal(cannotTakeSpice({ tasteVector: { spicy: 2 } }), true);
  assert.equal(
    cannotTakeSpice({ tasteVector: { spicy: 5 }, tasteProfile: { spiceSeeking: 5 } }),
    false,
  );
  assert.equal(
    cannotTakeSpice({ tasteVector: { spicy: 9 }, tasteProfile: { spiceSeeking: 9 } }),
    false,
  );
});

test("kinds are read from dish names", () => {
  assert.deepEqual(
    [...kindsOfNames(["prawn noodles", "hainanese chicken rice", "mystery"])].sort(),
    ["noodles", "rice"],
  );
  assert.equal(isChipInSeason("cheap", 3), true);
});
