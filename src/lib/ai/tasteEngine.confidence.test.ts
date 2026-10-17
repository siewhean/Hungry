import assert from "node:assert/strict";
import test from "node:test";

import type { DishSummary, TasteVector } from "@/types/domain";
import { runRecommendationPipeline } from "./tasteEngine";

const USER_VECTOR: TasteVector = { sweet: 2, spicy: 8, sour: 3, salty: 6, rich: 7, aromatic: 8 };
const OPPOSITE_VECTOR: TasteVector = {
  sweet: 9,
  spicy: 0,
  sour: 8,
  salty: 1,
  rich: 1,
  aromatic: 1,
};

function buildDish(
  tasteVector: TasteVector,
  rating: number,
  tasteConfidence?: number,
): DishSummary {
  return {
    id: "dish-1",
    venueId: "venue-1",
    buildingId: "building-1",
    venueName: "Venue 1",
    unitNumber: "#01-01",
    floor: "L1",
    name: "Dish 1",
    imageUrl: "https://example.com/dish.jpg",
    distanceMeters: 120,
    rating,
    reviewCount: 12,
    price: 6,
    priceRange: "$",
    tasteTags: [],
    tasteVector,
    tasteConfidence,
    dietaryFlags: [],
  };
}

function scoreOf(dish: DishSummary): number {
  const [result] = runRecommendationPipeline([dish], {
    userVector: USER_VECTOR,
    dietaryFlags: [],
    neophiliaIndex: 0,
  });
  assert.ok(result, "pipeline returned the dish");
  return result.score;
}

test("a dish with no tasteConfidence scores the same as a fully trusted one", () => {
  assert.equal(scoreOf(buildDish(USER_VECTOR, 4)), scoreOf(buildDish(USER_VECTOR, 4, 1)));
});

test("low confidence shrinks the pull of a strong taste match", () => {
  const trusted = scoreOf(buildDish(USER_VECTOR, 2, 1));
  const unsure = scoreOf(buildDish(USER_VECTOR, 2, 0.2));
  assert.ok(unsure < trusted, `expected ${unsure} < ${trusted}`);
});

test("low confidence leans on rating when the taste match is weak", () => {
  const trusted = scoreOf(buildDish(OPPOSITE_VECTOR, 5, 1));
  const untagged = scoreOf(buildDish(OPPOSITE_VECTOR, 5, 0));
  assert.ok(untagged > trusted, `expected ${untagged} > ${trusted}`);
});
