import assert from "node:assert/strict";
import test from "node:test";

import { getDataRepository } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";

test("review submission helpers persist reviewed dish and entry payload", () => {
  const dish = getDataRepository().listPopularNearby()[0];
  assert.ok(dish);

  useProfileStore.setState((state) => ({
    ...state,
    profile: {
      ...state.profile,
      reviewedDishIds: [],
      stats: {
        ...state.profile.stats,
        dishesReviewed: 0,
      },
    },
    reviewEntries: {},
  }));

  useProfileStore.getState().addReviewedDish(dish.id);
  // A Tried mark alone is not a review (H29).
  assert.equal(useProfileStore.getState().profile.stats.dishesReviewed, 0);
  useProfileStore.getState().addReview(dish);
  useProfileStore.getState().recordReviewEntry(dish.id, {
    rating: 5,
    text: "Excellent",
    tags: ["rich"],
  });

  const nextState = useProfileStore.getState();
  assert.ok(nextState.profile.reviewedDishIds.includes(dish.id));
  assert.equal(nextState.profile.stats.dishesReviewed, 1);
  assert.equal(nextState.reviewEntries[dish.id]?.rating, 5);
  assert.equal(nextState.reviewEntries[dish.id]?.text, "Excellent");
});
