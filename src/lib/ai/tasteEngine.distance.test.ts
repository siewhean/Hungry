import assert from "node:assert/strict";
import test from "node:test";

import type { DishSummary, TasteVector } from "@/types/domain";
import {
  DISTANCE_DECAY_FLOOR,
  distanceDecayFactor,
  runRecommendationPipeline,
  type PipelineContext,
} from "./tasteEngine";

const USER: TasteVector = { sweet: 2, spicy: 9, sour: 4, salty: 6, rich: 5, aromatic: 7 };
const PERFECT: TasteVector = USER;
const OKAY: TasteVector = { sweet: 5, spicy: 6, sour: 5, salty: 5, rich: 5, aromatic: 5 };

function dish(id: string, venueId: string, tasteVector: TasteVector, distanceMeters: number) {
  return {
    id,
    venueId,
    buildingId: `building-${venueId}`,
    venueName: `Venue ${venueId}`,
    unitNumber: "#01-01",
    floor: "L1",
    name: `Dish ${id}`,
    imageUrl: "https://example.com/dish.jpg",
    distanceMeters,
    rating: 4.2,
    reviewCount: 10,
    price: 6,
    priceRange: "$",
    liveCrowd: "medium",
    tasteTags: [],
    tasteVector,
    dietaryFlags: [],
  } as DishSummary;
}

function context(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    userVector: USER,
    dietaryFlags: [],
    neophiliaIndex: 0,
    context: { timeSegment: "lunch" },
    ...overrides,
  };
}

const NEAR_OKAY = dish("near-okay", "v1", OKAY, 60);
const FAR_PERFECT = dish("far-perfect", "v2", PERFECT, 1_500);

test("the decay factor is 1 at the diner's feet and never below the floor", () => {
  assert.equal(distanceDecayFactor(0), 1);
  assert.ok(distanceDecayFactor(400) < distanceDecayFactor(100));
  assert.ok(distanceDecayFactor(50_000) >= DISTANCE_DECAY_FLOOR);
  assert.equal(distanceDecayFactor(Number.NaN), 1);
  assert.equal(distanceDecayFactor(-5), 1);
});

test("decay mode counts distance in metres; the additive score only compares it with the pool", () => {
  // One far outlier stretches the pool, so in the additive score 1.5 km looks close to 60 m.
  const outlier = dish("outlier", "v9", OKAY, 20_000);
  const pool = [FAR_PERFECT, NEAR_OKAY, outlier];

  const additive = runRecommendationPipeline(pool, context());
  assert.equal(additive[0]?.dishId, "far-perfect");

  const decay = runRecommendationPipeline(pool, context({ distanceMode: "decay" }));
  assert.equal(decay[0]?.dishId, "near-okay");
});

test("decay mode keeps ranking far dishes by relevance among themselves", () => {
  const farOkay = dish("far-okay", "v3", OKAY, 1_500);
  const ranked = runRecommendationPipeline(
    [farOkay, FAR_PERFECT],
    context({ distanceMode: "decay" }),
  );
  const perfect = ranked.find((item) => item.dishId === "far-perfect");
  const okay = ranked.find((item) => item.dishId === "far-okay");
  assert.ok(perfect && okay && perfect.score > okay.score);
});

test("without distanceMode the score is the same as asking for additive", () => {
  const dishes = [FAR_PERFECT, NEAR_OKAY];
  assert.deepEqual(
    runRecommendationPipeline(dishes, context()),
    runRecommendationPipeline(dishes, context({ distanceMode: "additive" })),
  );
});

test("decay scores stay between 0 and 1", () => {
  const ranked = runRecommendationPipeline(
    [FAR_PERFECT, NEAR_OKAY, dish("mid", "v4", OKAY, 900)],
    context({ distanceMode: "decay" }),
  );
  for (const item of ranked) assert.ok(item.score >= 0 && item.score <= 1, `${item.score}`);
});

test("decay mode still drops dishes that break a dietary need", () => {
  const unsafe = dish("unsafe", "v5", PERFECT, 10);
  const safe = { ...NEAR_OKAY, dietaryFlags: ["vegan"] } as DishSummary;
  const ranked = runRecommendationPipeline(
    [unsafe, safe],
    context({ distanceMode: "decay", dietaryFlags: ["vegan"] }),
  );
  assert.deepEqual(
    ranked.map((item) => item.dishId),
    ["near-okay"],
  );
});
