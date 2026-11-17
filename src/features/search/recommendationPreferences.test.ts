import assert from "node:assert/strict";
import test from "node:test";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { dishes } from "@/lib/services/mock/data";
import { hungryService } from "@/lib/services/mock/mockService";
import { mockRepository } from "@/lib/services/mock/repositories";
import { useUIStore } from "@/store/useUIStore";

test("recommendation budget and reviewed exclusions apply before a one-item limit", async () => {
  const profile = await hungryService.profile.getProfile();
  const previousHide = useUIStore.getState().hideReviewedDishesFromFeed;
  const cheapestPrice = Math.min(...dishes.map((dish) => dish.price));
  const excluded = dishes.filter((dish) => dish.price === cheapestPrice).map((dish) => dish.id);
  try {
    await hungryService.profile.updateProfile({
      maxDishBudget: cheapestPrice,
      reviewedDishIds: excluded,
    });
    useUIStore.getState().setHideReviewedDishesFromFeed(true);
    const slate = await hungryService.recommendations.getSlate({
      surface: "discover",
      tasteProfile: NEUTRAL_TASTE_VECTOR,
      radiusMeters: 100_000,
      limit: 1,
    });
    assert.deepEqual(slate.items, []);
    useUIStore.getState().setHideReviewedDishesFromFeed(false);
    const visible = await hungryService.recommendations.getSlate({
      surface: "discover",
      tasteProfile: NEUTRAL_TASTE_VECTOR,
      radiusMeters: 100_000,
      limit: 1,
    });
    assert.ok(visible.items.length > 0);
    assert.ok(visible.items.every((item) => item.dish.price <= cheapestPrice));
  } finally {
    await hungryService.profile.updateProfile({
      maxDishBudget: profile.maxDishBudget,
      reviewedDishIds: profile.reviewedDishIds,
    });
    useUIStore.getState().setHideReviewedDishesFromFeed(previousHide);
  }
});

test("mock search price and dietary constraints are hard requirements", () => {
  const limit = Math.min(...dishes.map((dish) => dish.price)) - 1;
  const results = mockRepository.searchDishes(
    {
      query: "",
      categories: [],
      dietaryFlags: [],
      tasteValues: NEUTRAL_TASTE_VECTOR,
      radius: 100_000,
      maxPrice: limit,
    },
    NEUTRAL_TASTE_VECTOR,
  );
  assert.deepEqual(results, []);
});

test("a slate started before an account transition cannot resolve into the new account", async () => {
  const { advanceAccountGeneration } = await import("@/lib/security/accountScope");
  const pending = hungryService.recommendations.getSlate({
    surface: "discover",
    tasteProfile: NEUTRAL_TASTE_VECTOR,
    limit: 1,
  });
  advanceAccountGeneration();
  await assert.rejects(pending, /account changed/i);
});

test("an explicit empty slate filter does not bypass profile dietary requirements", async () => {
  const profile = await hungryService.profile.getProfile();
  try {
    await hungryService.profile.updateProfile({
      dietaryPreferences: ["halal"],
      maxDishBudget: undefined,
    });
    const slate = await hungryService.recommendations.getSlate({
      surface: "discover",
      tasteProfile: NEUTRAL_TASTE_VECTOR,
      dietaryFlags: [],
      radiusMeters: 100_000,
      limit: 20,
    });
    assert.ok(slate.items.length > 0);
    assert.ok(slate.items.every((item) => item.dish.dietaryFlags.includes("halal")));
  } finally {
    await hungryService.profile.updateProfile({
      dietaryPreferences: profile.dietaryPreferences,
      maxDishBudget: profile.maxDishBudget,
    });
  }
});
