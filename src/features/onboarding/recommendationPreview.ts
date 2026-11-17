import type { DishDetail, UserProfile } from "@/types/domain";

/** A zero-match preview stays empty; unknown metadata cannot satisfy a requirement. */
export function selectOnboardingRecommendations(
  results: DishDetail[],
  profile: UserProfile,
  count = 4,
) {
  return results
    .filter(
      (dish) =>
        profile.dietaryPreferences.every((flag) => dish.dietaryFlags?.includes(flag)) &&
        (profile.maxDishBudget === undefined ||
          (dish.price > 0 && dish.price <= profile.maxDishBudget)),
    )
    .slice(0, count);
}
