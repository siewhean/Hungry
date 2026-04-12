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
  return results;
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

  const collections = repository
    .listVenuesByBuilding("building-maxwell")
    .concat(repository.listVenuesByBuilding("building-lau-pa-sat"))
    .concat(repository.listVenuesByBuilding("building-amoy"))
    .map((venue) => {
      const posts = repository.listStallPosts().filter((post) => post.venueId === venue.id);
      const topDishes = repository.listDishesByVenue(venue.id);
      const building = repository.listBuildings().find((item) => item.id === venue.buildingId);
      const affinity =
        topDishes.length > 0 ? getSimilarityScore(topDishes[0].tasteVector, profile.tasteVector) : 0;

      return {
        venue,
        location: building?.name ?? "Singapore",
        posts,
        topDishes,
        affinity,
      } satisfies DiscoverStallCollection;
    })
    .filter((item) => item.posts.length > 0);

  return collections
    .filter((item) => {
      if (!normalizedQuery) {
        return true;
      }

      const haystack = `${item.venue.name} ${item.location} ${item.topDishes.map((dish) => dish.name).join(" ")}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => right.affinity - left.affinity);
}
