import { getDataRepository, getSimilarityScore } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSearchStore } from "@/store/useSearchStore";
import type { DishDetail, SearchFilters, StallPost, UserProfile, VenueSummary } from "@/types/domain";

export type SearchSortMode = "best_match" | "distance" | "rating" | "price";

export function useSearchData() {
  const profile = useProfileStore((state) => state.profile);
  const filters = useSearchStore((state) => state.filters);
  const recentSearches = useSearchStore((state) => state.recentSearches);

  return {
    profile,
    filters,
    recentSearches,
  };
}

export function getSearchResults(filters: SearchFilters, tasteVector = filters.tasteValues) {
  return getDataRepository().searchDishes(filters, tasteVector);
}

export function sortSearchResults(results: DishDetail[], mode: SearchSortMode, tasteVector: UserProfile["tasteVector"]) {
  const cloned = [...results];

  if (mode === "distance") {
    return cloned.sort((left, right) => left.distanceMeters - right.distanceMeters);
  }

  if (mode === "rating") {
    return cloned.sort((left, right) => right.rating - left.rating);
  }

  if (mode === "price") {
    return cloned.sort((left, right) => left.price - right.price);
  }

  return cloned.sort(
    (left, right) => getSimilarityScore(right.tasteVector, tasteVector) - getSimilarityScore(left.tasteVector, tasteVector),
  );
}

export function getDecideForMeDish() {
  const profile = useProfileStore.getState().profile;
  return getDataRepository().getDecideForMe(profile.tasteVector);
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
    .filter((group): group is { venue: VenueSummary; dishes: DishDetail[]; minDistanceMeters: number; bestRating: number } => Boolean(group))
    .sort((left, right) => {
      if (left.minDistanceMeters !== right.minDistanceMeters) {
        return left.minDistanceMeters - right.minDistanceMeters;
      }
      return right.bestRating - left.bestRating;
    });
}

export interface DiscoverStallCollection {
  venue: VenueSummary;
  location: string;
  posts: StallPost[];
  topDishes: DishDetail[];
  affinity: number;
}

export function getDiscoverStallCollections(profile: UserProfile, query: string) {
  const repository = getDataRepository();
  const normalizedQuery = query.trim().toLowerCase();
  const posts = repository.listStallPosts();
  const buildings = repository.listBuildings();
  const seenVenues = new Set<string>();
  const collections: Array<DiscoverStallCollection & { nearestDistanceMeters: number }> = [];

  for (const building of buildings) {
    const venues = repository.listVenuesByBuilding(building.id);

    for (const venue of venues) {
      if (seenVenues.has(venue.id)) {
        continue;
      }
      seenVenues.add(venue.id);

      const venuePosts = posts.filter((post) => post.venueId === venue.id);
      if (!venuePosts.length) {
        continue;
      }

      const topDishes = repository.listDishesByVenue(venue.id);
      const affinity =
        topDishes.length > 0 ? getSimilarityScore(topDishes[0].tasteVector, profile.tasteVector) : 0;
      const nearestDistanceMeters = topDishes.length
        ? Math.min(...topDishes.map((dish) => dish.distanceMeters))
        : Number.MAX_SAFE_INTEGER;

      collections.push({
        venue,
        location: building.name,
        posts: venuePosts,
        topDishes,
        affinity,
        nearestDistanceMeters,
      });
    }
  }

  return collections
    .filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${item.venue.name} ${item.location} ${item.topDishes.map((dish) => dish.name).join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      const leftProximityScore = Math.max(0, 1 - left.nearestDistanceMeters / 2500);
      const rightProximityScore = Math.max(0, 1 - right.nearestDistanceMeters / 2500);
      const leftScore = left.affinity * 0.7 + leftProximityScore * 0.3;
      const rightScore = right.affinity * 0.7 + rightProximityScore * 0.3;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      return left.nearestDistanceMeters - right.nearestDistanceMeters;
    })
    .map(({ nearestDistanceMeters: _nearestDistanceMeters, ...collection }) => collection);
}
