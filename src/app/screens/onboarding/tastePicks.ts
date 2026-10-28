import { getHungryService } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail } from "@/types/domain";
import { buildResultPicks } from "./fillResultPicks";

// The server is asked for more than the grid needs: diet and budget are applied afterwards.
const SLATE_OVERFETCH = 3;
// Server picks start near the user and widen until there are enough dishes.
const TASTE_PICK_RADII_METERS = [3000, 10000, undefined];
/** Dishes the new onboarding fetches once and shares between its grid, swipe and results. */
export const ONBOARDING_POOL_SIZE = 24;

/** Dishes ranked by the quiz taste vector on the server (get_taste_recommendations). */
export async function loadTastePicks(count: number): Promise<DishDetail[]> {
  const { tasteVector, dietaryPreferences, maxDishBudget } = useProfileStore.getState().profile;
  const { coordinate, isApproximate } = getEffectiveLocation(useLocationStore.getState());
  const location = isApproximate ? undefined : coordinate;
  let picks: DishDetail[] = [];
  // n-plus-one-ok: widens the radius step by step and stops at the first slate that is full enough.
  for (const radiusMeters of location ? TASTE_PICK_RADII_METERS : [undefined]) {
    const slate = await getHungryService().recommendations.getSlate({
      surface: "home",
      tasteProfile: tasteVector,
      dietaryFlags: dietaryPreferences,
      latitude: location?.latitude,
      longitude: location?.longitude,
      radiusMeters,
      limit: count * SLATE_OVERFETCH,
    });
    picks = slate.items.map((item) => item.dish);
    const fitting = buildResultPicks({
      ranked: picks,
      popular: [],
      count,
      dietaryFlags: dietaryPreferences,
      maxDishBudget,
    });
    if (fitting.length >= count) break;
  }
  return picks;
}

let cached: { key: string; promise: Promise<DishDetail[]> } | null = null;

function poolKey(): string {
  const { tasteVector, dietaryPreferences, maxDishBudget } = useProfileStore.getState().profile;
  const { coordinate, isApproximate } = getEffectiveLocation(useLocationStore.getState());
  return JSON.stringify([
    tasteVector,
    dietaryPreferences,
    maxDishBudget ?? null,
    isApproximate ? null : coordinate,
  ]);
}

/** Forgets the shared pool (used when the person starts over, and by tests). */
export function clearOnboardingDishPool(): void {
  cached = null;
}

/**
 * The dishes the new onboarding shows: taste-ranked, every one carrying the diet and fitting the
 * budget, topped up with popular dishes nearby. Fetched once per set of answers, so the grid,
 * the swipe and the results share one request; a changed answer fetches again. A failed fetch is
 * not remembered, so Retry really retries.
 */
export function loadOnboardingDishPool(
  count: number = ONBOARDING_POOL_SIZE,
): Promise<DishDetail[]> {
  const key = poolKey();
  if (cached?.key === key) return cached.promise;
  const promise = (async () => {
    const { dietaryPreferences, maxDishBudget } = useProfileStore.getState().profile;
    const ranked = await loadTastePicks(count);
    const matches = buildResultPicks({
      ranked,
      popular: [],
      count,
      dietaryFlags: dietaryPreferences,
      maxDishBudget,
    });
    if (matches.length >= count) return matches.map((pick) => pick.dish);
    const popular = await getHungryService().discovery.listPopularNearby();
    return buildResultPicks({
      ranked,
      popular,
      count,
      dietaryFlags: dietaryPreferences,
      maxDishBudget,
    }).map((pick) => pick.dish);
  })();
  cached = { key, promise };
  promise.catch(() => {
    if (cached?.promise === promise) cached = null;
  });
  return promise;
}
