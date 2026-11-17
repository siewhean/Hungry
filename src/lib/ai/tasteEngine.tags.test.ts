import assert from "node:assert/strict";
import test from "node:test";

import type { DishSummary, TasteVector } from "@/types/domain";
import { buildTagAffinity, runRecommendationPipeline, tagMatchScore } from "./tasteEngine";

const RICH_SALTY: TasteVector = { sweet: 2, spicy: 3, sour: 1, salty: 7, rich: 8, aromatic: 6 };

// The liked dish leads on a different axis so diversification (max 2 per dominant axis) keeps both test dishes.
const SPICY_LED: TasteVector = { ...RICH_SALTY, spicy: 9 };

function buildDish(
  id: string,
  tasteTags: string[],
  foodTypeTag?: string,
  tasteVector = RICH_SALTY,
): DishSummary {
  return {
    id,
    venueId: `venue-${id}`,
    buildingId: "building-1",
    venueName: `Venue ${id}`,
    unitNumber: "#01-01",
    floor: "L1",
    name: id,
    foodTypeTag,
    imageUrl: "https://example.com/dish.jpg",
    distanceMeters: 120,
    rating: 4,
    reviewCount: 12,
    price: 6,
    priceRange: "$",
    tasteTags,
    tasteVector,
    dietaryFlags: [],
  };
}

const likedCurry = buildDish("curry-mee", ["lemak", "hiam"], "Noodles", SPICY_LED);
const laksa = buildDish("laksa", ["Lemak", "hiam"], "noodles");
const bakKutTeh = buildDish("bak-kut-teh", ["sedap"], "soup");
const pool = [likedCurry, laksa, bakKutTeh];

function scoreOf(dishId: string, likedDishIds?: string[]) {
  const results = runRecommendationPipeline(pool, {
    userVector: RICH_SALTY,
    dietaryFlags: [],
    neophiliaIndex: 0,
    likedDishIds,
  });
  return results.find((result) => result.dishId === dishId)?.score ?? 0;
}

test("tag affinity is normalised and case-insensitive, including food type", () => {
  const affinity = buildTagAffinity([likedCurry]);
  assert.equal(affinity.get("lemak"), 1);
  assert.equal(affinity.get("noodles"), 1);
  assert.equal(tagMatchScore(laksa, affinity), 1);
  assert.equal(tagMatchScore(bakKutTeh, affinity), 0);
});

test("without liked dishes, identical vectors score the same", () => {
  assert.equal(scoreOf("laksa"), scoreOf("bak-kut-teh"));
});

test("liked dishes' tags separate dishes with identical vectors", () => {
  const liked = [likedCurry.id];
  assert.ok(scoreOf("laksa", liked) > scoreOf("bak-kut-teh", liked));
});

test("liked ids missing from the pool leave scores unchanged", () => {
  assert.equal(scoreOf("laksa", ["not-in-pool"]), scoreOf("laksa"));
});
