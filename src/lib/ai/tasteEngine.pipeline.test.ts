import assert from "node:assert/strict";
import test from "node:test";

import type { DishSummary, TasteVector } from "@/types/domain";
import { processExplicitFeedback, runRecommendationPipeline } from "./tasteEngine";

const BASE_VECTOR: TasteVector = {
  sweet: 5,
  spicy: 5,
  sour: 5,
  salty: 5,
  rich: 5,
  aromatic: 5,
};

function buildDish(id: string, venueId: string, tasteVector: TasteVector): DishSummary {
  return {
    id,
    venueId,
    buildingId: `building-${venueId}`,
    venueName: `Venue ${venueId}`,
    unitNumber: "#01-01",
    floor: "L1",
    name: `Dish ${id}`,
    imageUrl: "https://example.com/dish.jpg",
    distanceMeters: 120,
    rating: 4.4,
    reviewCount: 12,
    price: 6,
    priceRange: "$",
    liveCrowd: "medium",
    tasteTags: ["popular"],
    tasteVector,
    dietaryFlags: [],
  };
}

function dominantTasteDimension(vector: TasteVector): keyof TasteVector {
  const keys: (keyof TasteVector)[] = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"];

  let dominant = keys[0];
  for (const key of keys) {
    if (vector[key] > vector[dominant]) {
      dominant = key;
    }
  }
  return dominant;
}

test("processExplicitFeedback pushes taste away on negative rating signals", () => {
  const spicyDishVector: TasteVector = {
    ...BASE_VECTOR,
    spicy: 10,
  };

  const updated = processExplicitFeedback(BASE_VECTOR, {
    type: "rating_1_star",
    dishVector: spicyDishVector,
    timestamp: Date.now(),
  });

  assert.ok(
    updated.spicy < BASE_VECTOR.spicy,
    "Negative rating should push spicy preference away from the disliked dish",
  );
});

test("processExplicitFeedback decays older feedback impact", () => {
  const richDishVector: TasteVector = {
    ...BASE_VECTOR,
    rich: 10,
  };

  const fresh = processExplicitFeedback(BASE_VECTOR, {
    type: "saved",
    dishVector: richDishVector,
    timestamp: Date.now(),
  });

  const stale = processExplicitFeedback(BASE_VECTOR, {
    type: "saved",
    dishVector: richDishVector,
    timestamp: Date.now() - 45 * 24 * 60 * 60 * 1000,
  });

  const freshDelta = fresh.rich - BASE_VECTOR.rich;
  const staleDelta = stale.rich - BASE_VECTOR.rich;

  assert.ok(freshDelta > staleDelta, "Fresh signals should weigh more than stale ones");
  assert.ok(staleDelta > 0, "Stale signals should still contribute a small positive update");
});

test("explicit search and click feedback use bounded relative weights", () => {
  const aromaticDishVector: TasteVector = {
    ...BASE_VECTOR,
    aromatic: 10,
  };

  const searched = processExplicitFeedback(BASE_VECTOR, {
    type: "search_query",
    dishVector: aromaticDishVector,
    timestamp: Date.now(),
  });
  const clicked = processExplicitFeedback(BASE_VECTOR, {
    type: "dish_result_click",
    dishVector: aromaticDishVector,
    timestamp: Date.now(),
  });
  const liked = processExplicitFeedback(BASE_VECTOR, {
    type: "dish_like",
    dishVector: aromaticDishVector,
    timestamp: Date.now(),
  });

  assert.ok(
    searched.aromatic > BASE_VECTOR.aromatic,
    "Search should lightly move toward matching dishes",
  );
  assert.ok(
    clicked.aromatic - BASE_VECTOR.aromatic > searched.aromatic - BASE_VECTOR.aromatic,
    "Clicked dish results should outweigh search-only intent",
  );
  assert.ok(
    liked.aromatic - BASE_VECTOR.aromatic > clicked.aromatic - BASE_VECTOR.aromatic,
    "Likes should outweigh result clicks",
  );
});

test("runRecommendationPipeline enforces venue and dominant-axis diversity caps", () => {
  const dishes: DishSummary[] = [
    buildDish("a1", "venue-a", {
      sweet: 9,
      spicy: 2,
      sour: 2,
      salty: 3,
      rich: 4,
      aromatic: 4,
    }),
    buildDish("a2", "venue-a", {
      sweet: 9,
      spicy: 3,
      sour: 2,
      salty: 3,
      rich: 4,
      aromatic: 4,
    }),
    buildDish("a3", "venue-a", {
      sweet: 8,
      spicy: 3,
      sour: 2,
      salty: 3,
      rich: 4,
      aromatic: 4,
    }),
    buildDish("a4", "venue-a", {
      sweet: 8,
      spicy: 2,
      sour: 2,
      salty: 3,
      rich: 4,
      aromatic: 4,
    }),
    buildDish("a5", "venue-a", {
      sweet: 8,
      spicy: 2,
      sour: 3,
      salty: 3,
      rich: 4,
      aromatic: 4,
    }),
    buildDish("a6", "venue-a", {
      sweet: 9,
      spicy: 2,
      sour: 3,
      salty: 3,
      rich: 4,
      aromatic: 4,
    }),
    buildDish("b1", "venue-b", {
      sweet: 3,
      spicy: 9,
      sour: 2,
      salty: 3,
      rich: 4,
      aromatic: 5,
    }),
    buildDish("b2", "venue-b", {
      sweet: 3,
      spicy: 8,
      sour: 2,
      salty: 3,
      rich: 4,
      aromatic: 5,
    }),
    buildDish("c1", "venue-c", {
      sweet: 3,
      spicy: 3,
      sour: 9,
      salty: 3,
      rich: 4,
      aromatic: 5,
    }),
    buildDish("c2", "venue-c", {
      sweet: 3,
      spicy: 3,
      sour: 8,
      salty: 3,
      rich: 4,
      aromatic: 5,
    }),
  ];

  const results = runRecommendationPipeline(dishes, {
    userVector: {
      sweet: 8,
      spicy: 7,
      sour: 7,
      salty: 5,
      rich: 5,
      aromatic: 5,
    },
    dietaryFlags: [],
    neophiliaIndex: 0,
    radiusMeters: 500,
  });

  assert.ok(results.length > 0, "Expected at least one recommendation");

  const dishById = new Map(dishes.map((dish) => [dish.id, dish]));
  const venueCounts = new Map<string, number>();
  const dominantDimensionCounts = new Map<string, number>();

  for (const result of results) {
    const dish = dishById.get(result.dishId);
    assert.ok(dish, `Missing fixture dish for ${result.dishId}`);

    const nextVenueCount = (venueCounts.get(dish.venueId) ?? 0) + 1;
    venueCounts.set(dish.venueId, nextVenueCount);

    const dominant = dominantTasteDimension(dish.tasteVector);
    const nextDimensionCount = (dominantDimensionCounts.get(dominant) ?? 0) + 1;
    dominantDimensionCounts.set(dominant, nextDimensionCount);
  }

  for (const [venueId, count] of venueCounts.entries()) {
    assert.ok(count <= 3, `Venue ${venueId} exceeded max-per-venue diversity cap`);
  }

  for (const [dimension, count] of dominantDimensionCounts.entries()) {
    assert.ok(count <= 2, `Dominant dimension ${dimension} exceeded diversity cap`);
  }
});

test("processExplicitFeedback ignores untagged neutral or zero-confidence dishes", () => {
  const spicyUser: TasteVector = { ...BASE_VECTOR, spicy: 9, sweet: 2 };

  const fromNeutral = processExplicitFeedback(spicyUser, {
    type: "saved",
    dishVector: { ...BASE_VECTOR },
    timestamp: Date.now(),
  });
  assert.deepEqual(fromNeutral, spicyUser, "Saving an untagged dish must not drag toward neutral");

  const fromUntrusted = processExplicitFeedback(spicyUser, {
    type: "rating_5_star",
    dishVector: { ...BASE_VECTOR, rich: 9 },
    dishConfidence: 0,
    timestamp: Date.now(),
  });
  assert.deepEqual(fromUntrusted, spicyUser, "Zero-confidence vectors carry no weight");

  const fromTagged = processExplicitFeedback(spicyUser, {
    type: "saved",
    dishVector: { ...BASE_VECTOR, rich: 9 },
    dishConfidence: 0.8,
    timestamp: Date.now(),
  });
  assert.ok(fromTagged.rich > spicyUser.rich, "Tagged dishes still update the vector");
});
