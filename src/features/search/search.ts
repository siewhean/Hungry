import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { getEffectiveLocation, useLocationStore } from "@/store/useLocationStore";
import { useProfileStore } from "@/store/useProfileStore";
import type { DishDetail, SearchFilters, VenueSummary } from "@/types/domain";

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

export function groupResultsByVenue(results: DishDetail[]) {
  const repository = getDataRepository();
  const grouped = new Map<string, DishDetail[]>();

  for (const dish of results) {
    const venueResults = grouped.get(dish.venueId) ?? [];
    venueResults.push(dish);
    grouped.set(dish.venueId, venueResults);
  }

  return Array.from(grouped.entries())
    .map(([venueId, dishesByVenue]) => {
      const venue = repository.getVenueById(venueId);
      if (!venue) {
        return undefined;
      }

      return {
        venue,
        dishes: dishesByVenue.sort((left, right) => right.rating - left.rating),
        minDistanceMeters: Math.min(...dishesByVenue.map((dish) => dish.distanceMeters)),
        bestRating: Math.max(...dishesByVenue.map((dish) => dish.rating)),
      };
    })
    .filter(
      (
        group,
      ): group is {
        venue: VenueSummary;
        dishes: DishDetail[];
        minDistanceMeters: number;
        bestRating: number;
      } => Boolean(group),
    )
    .sort((left, right) => {
      if (left.minDistanceMeters !== right.minDistanceMeters) {
        return left.minDistanceMeters - right.minDistanceMeters;
      }
      return right.bestRating - left.bestRating;
    });
}
