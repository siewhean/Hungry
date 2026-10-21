import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import type { SearchFilters } from "@/types/domain";

/** Adds the user's real location (GPS or manual pick) when the caller has none. */
export function withUserLocation(filters: SearchFilters): SearchFilters {
  if (typeof filters.latitude === "number" && typeof filters.longitude === "number") {
    return filters;
  }
  const { coordinate, isApproximate } = getEffectiveLocation(useLocationStore.getState());
  if (isApproximate) return filters;
  return { ...filters, latitude: coordinate.latitude, longitude: coordinate.longitude };
}

export async function getSearchResultsAsync(
  filters: SearchFilters,
  tasteVector = filters.tasteValues,
) {
  const results = await getHungryService().discovery.searchDishes(
    withUserLocation(filters),
    tasteVector,
  );
  return results.map((result) => result.dish);
}

export function getDecideForMeDish() {
  const profile = useProfileStore.getState().profile;
  return getDataRepository().getDecideForMe(profile.tasteVector, {
    dietaryFlags: profile.dietaryPreferences,
    neophiliaIndex: profile.tasteProfile?.neophiliaIndex ?? 5,
    radiusMeters: 500,
  });
}
