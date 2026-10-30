import assert from "node:assert/strict";
import test from "node:test";

import type { Bite } from "@/lib/services/types";
import type { DishDetail, TasteVector } from "@/types/domain";
import { pickRailsWithoutRepeats, tasteOrderBites } from "./homeRanking";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
const SPICY_FAN: TasteVector = { ...NEUTRAL, spicy: 9 };

function bite(id: string): Bite {
  return { id: `bite-${id}`, dishId: id, dishName: id } as Bite;
}

function dish(id: string, overrides: Partial<DishDetail> = {}): DishDetail {
  return {
    id,
    buildingId: "b1",
    distanceMeters: 100,
    rating: 4,
    reviewCount: 3,
    price: 5,
    tasteVector: NEUTRAL,
    dietaryFlags: [],
    ...overrides,
  } as DishDetail;
}

const OPTIONS = { tasteVector: SPICY_FAN };

test("tasteOrderBites puts the dish closest to the palate first and says why", () => {
  const bites = [bite("mild"), bite("hot")];
  const dishes = new Map([
    ["mild", dish("mild")],
    ["hot", dish("hot", { tasteVector: { ...NEUTRAL, spicy: 9 } })],
  ]);
  const { bites: ordered, reasons } = tasteOrderBites(bites, dishes, OPTIONS);
  assert.deepEqual(
    ordered.map((item) => item.dishId),
    ["hot", "mild"],
  );
  assert.equal(reasons.get("hot"), "Spicy, the way you like it");
});

test("tasteOrderBites keeps the old order, with no reasons, when there is no palate", () => {
  const bites = [bite("a"), bite("b")];
  const dishes = new Map([
    ["a", dish("a")],
    ["b", dish("b", { tasteVector: { ...NEUTRAL, spicy: 9 } })],
  ]);
  const result = tasteOrderBites(bites, dishes, { tasteVector: NEUTRAL });
  assert.deepEqual(
    result.bites.map((item) => item.dishId),
    ["a", "b"],
  );
  assert.equal(result.reasons.size, 0);
});

test("tasteOrderBites only reorders: a dish with a dietary flag gap or a high price stays in", () => {
  const bites = [bite("pricey"), bite("halal"), bite("unknown")];
  const dishes = new Map([
    ["pricey", dish("pricey", { price: 40 })],
    ["halal", dish("halal", { dietaryFlags: ["halal"] })],
  ]);
  const { bites: ordered } = tasteOrderBites(bites, dishes, OPTIONS);
  assert.deepEqual(ordered.map((item) => item.dishId).sort(), ["halal", "pricey", "unknown"]);
  assert.equal(
    ordered.at(-1)?.dishId,
    "unknown",
    "a bite with no loaded dish follows the ranked ones",
  );
});

test("pickRailsWithoutRepeats shows a dish in the first rail that has it", () => {
  const [first, second, third] = pickRailsWithoutRepeats(
    [
      { bites: [bite("a"), bite("b")], max: 5 },
      { bites: [bite("b"), bite("c"), bite("d"), bite("e")], max: 2 },
      { bites: [bite("a"), bite("c"), bite("f")], max: 5 },
    ],
    1,
  );
  assert.deepEqual(
    first.map((item) => item.dishId),
    ["a", "b"],
  );
  assert.deepEqual(
    second.map((item) => item.dishId),
    ["c", "d"],
  );
  assert.deepEqual(
    third.map((item) => item.dishId),
    ["f"],
    "a dish cut from a rail by its size is not repeated later",
  );
});

test("pickRailsWithoutRepeats leaves a thin rail thin, but keeps one marked keepWhenThin", () => {
  const rails = [
    { bites: [bite("a"), bite("b"), bite("c")], max: 5 },
    { bites: [bite("a"), bite("b"), bite("c")], max: 5, keepWhenThin: true },
    { bites: [bite("a"), bite("b"), bite("c"), bite("d")], max: 5 },
  ];
  const [, kept, thin] = pickRailsWithoutRepeats(rails, 3);
  assert.equal(kept.length, 3, "the main rail keeps its dishes");
  assert.deepEqual(
    thin.map((item) => item.dishId),
    ["d"],
    "a plain rail shows only what no rail above has",
  );
});
