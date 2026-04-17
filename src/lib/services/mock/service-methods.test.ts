import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";

test("discovery.getBuildingDetail returns enriched building metadata", async () => {
  const detail = await hungryService.discovery.getBuildingDetail("building-maxwell");

  assert.ok(detail);
  assert.equal(detail?.id, "building-maxwell");
  assert.ok(Boolean(detail?.address));
  assert.ok((detail?.totalStalls ?? 0) > 0);
});

test("discovery.getFloorPlan returns a floor plan with polygon geometry", async () => {
  const floorPlan = await hungryService.discovery.getFloorPlan("building-maxwell", "L1");

  assert.ok(floorPlan);
  assert.equal(floorPlan?.buildingId, "building-maxwell");
  assert.equal(floorPlan?.floor, "L1");
  assert.ok((floorPlan?.stalls.length ?? 0) > 0);
  assert.ok((floorPlan?.stalls[0]?.polygon.length ?? 0) >= 3);
});

test("discovery.searchDishes maps repository results into scored search contracts", async () => {
  const results = await hungryService.discovery.searchDishes(
    {
      query: "",
      categories: [],
      dietaryFlags: ["vegetarian"],
      tasteValues: NEUTRAL_TASTE_VECTOR,
      radius: 3000,
    },
    NEUTRAL_TASTE_VECTOR,
  );

  assert.ok(results.length > 0);
  assert.ok(results.every((result) => result.score >= 0 && result.score <= 1));
  assert.ok(results.every((result) => result.dish.dietaryFlags.includes("vegetarian")));
});

test("reviews.submitReview persists reviewed dish id in profile state", async () => {
  await hungryService.auth.signIn("reviewer@hungry.sg", "password");
  try {
    const beforeProfile = await hungryService.profile.getProfile();
    const dishToReview = dishes.find((dish) => !beforeProfile.reviewedDishIds.includes(dish.id));
    assert.ok(dishToReview, "Expected at least one reviewable fixture dish");

    await hungryService.reviews.submitReview({
      dishId: dishToReview.id,
      venueId: dishToReview.venueId,
      rating: 5,
      text: "Great dish.",
      tags: ["Fragrant"],
      photos: [],
    });

    const afterProfile = await hungryService.profile.getProfile();
    assert.ok(afterProfile.reviewedDishIds.includes(dishToReview.id));
  } finally {
    await hungryService.auth.signOut();
  }
});

test("discovery.decideForMe respects profile dietary preferences", async () => {
  await hungryService.auth.signIn("dietary@hungry.sg", "password");
  const originalPreferences = (await hungryService.profile.getProfile()).dietaryPreferences;
  try {
    await hungryService.profile.updateDietaryPreferences(["halal"]);

    const recommendation = await hungryService.discovery.decideForMe(NEUTRAL_TASTE_VECTOR);
    assert.ok(recommendation, "Expected a recommendation for halal profile");
    assert.ok(recommendation?.dietaryFlags.includes("halal"));
  } finally {
    await hungryService.profile.updateDietaryPreferences(originalPreferences);
    await hungryService.auth.signOut();
  }
});
