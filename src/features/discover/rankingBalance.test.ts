import assert from "node:assert/strict";
import test from "node:test";

import type { DishSummary, TasteVector } from "@/types/domain";
import {
  buildHomeScorer,
  historyWeight,
  HISTORY_MAX_WEIGHT,
  isUnprovenDish,
  MAX_QUALITY_POINTS,
  qualityPoints,
  reserveFreshSlots,
} from "./rankingBalance";

const VECTOR: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

function dish(id: string, overrides: Partial<DishSummary> = {}): DishSummary {
  return {
    id,
    venueId: `v-${id}`,
    buildingId: "b1",
    venueName: id,
    unitNumber: "01-01",
    floor: "1",
    name: id,
    imageUrl: "",
    distanceMeters: 100,
    rating: 4,
    reviewCount: 10,
    price: 5,
    priceRange: "$",
    tasteTags: [],
    tasteVector: VECTOR,
    dietaryFlags: [],
    ...overrides,
  };
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

test("a dish with fewer than 3 reviews is new", () => {
  assert.equal(isUnprovenDish({ reviewCount: 0 }), true);
  assert.equal(isUnprovenDish({ reviewCount: 2 }), true);
  assert.equal(isUnprovenDish({ reviewCount: 3 }), false);
});

test("slot 3 and slot 8 go to the best-ranked new dishes, the rest keep their order", () => {
  const ranked = Array.from({ length: 12 }, (_, index) => ({
    id: `p${index + 1}`,
    fresh: index === 8 || index === 10,
  }));
  const result = reserveFreshSlots(ranked, (item) => item.fresh);
  assert.equal(result[2]?.id, "p9");
  assert.equal(result[7]?.id, "p11");
  assert.deepEqual(
    result.map((item) => item.id),
    ["p1", "p2", "p9", "p3", "p4", "p5", "p6", "p11", "p7", "p8", "p10", "p12"],
  );
});

test("nothing is lost or repeated when slots are reserved", () => {
  const ranked = Array.from({ length: 20 }, (_, index) => ({
    id: `p${index}`,
    fresh: index % 4 === 3,
  }));
  const result = reserveFreshSlots(ranked, (item) => item.fresh);
  assert.equal(result.length, 20);
  assert.equal(new Set(result.map((item) => item.id)).size, 20);
});

test("with no new dish, or only new dishes, the order is unchanged", () => {
  const proven = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
  assert.deepEqual(ids(reserveFreshSlots(proven, () => false)), ["a", "b", "c", "d", "e"]);
  assert.deepEqual(ids(reserveFreshSlots(proven, () => true)), ["a", "b", "c", "d", "e"]);
});

test("a new dish ranked beyond the lift window is not pulled up", () => {
  const ranked = Array.from({ length: 40 }, (_, index) => ({
    id: `p${index}`,
    fresh: index === 35,
  }));
  const result = reserveFreshSlots(ranked, (item) => item.fresh);
  assert.equal(result[2]?.id, "p2");
});

test("a rating counts for more with more reviews, and is never worth more than 5 points", () => {
  assert.equal(qualityPoints(5, 0), 0);
  const one = qualityPoints(5, 1);
  const many = qualityPoints(5, 50);
  assert.ok(one > 0 && one < many, `1 review ${one}, 50 reviews ${many}`);
  assert.ok(many <= MAX_QUALITY_POINTS);
  assert.ok(qualityPoints(2, 50) < 0, "a poorly rated, well-reviewed dish loses points");
  assert.equal(qualityPoints(1, 500), -MAX_QUALITY_POINTS);
});

test("history counts for nothing without liked dishes and grows to 40%", () => {
  assert.equal(historyWeight(0), 0);
  assert.ok(historyWeight(1) > 0);
  assert.ok(historyWeight(4) > historyWeight(1));
  assert.equal(historyWeight(8), HISTORY_MAX_WEIGHT);
  assert.equal(historyWeight(30), HISTORY_MAX_WEIGHT);
});

test("a new diner's score is the taste match plus the rating points, nothing from history", () => {
  const score = buildHomeScorer([]);
  const target = dish("a", { tasteTags: ["spicy"], rating: 4.5, reviewCount: 20 });
  assert.equal(score(target, 80), 80 + qualityPoints(4.5, 20));
});

test("a returning diner's score rises for dishes that share tags with the dishes they liked", () => {
  const liked = [dish("l1", { tasteTags: ["spicy", "noodle"], foodTypeTag: "laksa" })];
  const score = buildHomeScorer(liked);
  const alike = dish("a", { tasteTags: ["spicy", "noodle"], foodTypeTag: "laksa" });
  const different = dish("b", { tasteTags: ["sweet"], foodTypeTag: "cake" });
  assert.ok(score(alike, 70) > score(different, 70));
});
