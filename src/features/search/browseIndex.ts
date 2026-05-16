import { getDataRepository } from "@/lib/services/serviceProvider";
import type { DataRepository } from "@/lib/services/types";
import type { DietaryFlag, DishDetail, StallPost, VenueSummary } from "@/types/domain";

export interface BrowseIndex {
  allDishes: DishDetail[];
  allVenues: VenueSummary[];
  dishById: Map<string, DishDetail>;
  dishesByVenueId: Map<string, DishDetail[]>;
  postByDishId: Map<string, StallPost>;
  postByVenueId: Map<string, StallPost>;
  searchTextByDishId: Map<string, string>;
  sortedDishesByVenueId: Map<string, DishDetail[]>;
  stallPosts: StallPost[];
  venueById: Map<string, VenueSummary>;
  venuesByBuildingId: Map<string, VenueSummary[]>;
}

let cachedBrowseIndex: { index: BrowseIndex; repository: DataRepository } | null = null;

function toDishSearchText(dish: DishDetail, venue?: VenueSummary): string {
  return [
    dish.name,
    dish.venueName,
    venue?.name,
    dish.priceRange,
    dish.tasteTags.join(" "),
    dish.dietaryFlags.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function cloneSortedDishes(dishes: DishDetail[]): DishDetail[] {
  return [...dishes].sort((left, right) => right.rating - left.rating);
}

export function getCachedBrowseIndex(
  repository: DataRepository = getDataRepository(),
): BrowseIndex | null {
  return cachedBrowseIndex?.repository === repository ? cachedBrowseIndex.index : null;
}

export function clearBrowseIndexCache(): void {
  cachedBrowseIndex = null;
}

export function getBrowseIndex(repository: DataRepository = getDataRepository()): BrowseIndex {
  const cached = getCachedBrowseIndex(repository);
  if (cached) {
    return cached;
  }

  const buildings = repository.listBuildings();
  const allVenues = buildings.flatMap((building) => repository.listVenuesByBuilding(building.id));
  const stallPosts = repository.listStallPosts();
  const venueById = new Map<string, VenueSummary>();
  const venuesByBuildingId = new Map<string, VenueSummary[]>();
  const dishById = new Map<string, DishDetail>();
  const dishesByVenueId = new Map<string, DishDetail[]>();
  const sortedDishesByVenueId = new Map<string, DishDetail[]>();
  const postByDishId = new Map<string, StallPost>();
  const postByVenueId = new Map<string, StallPost>();
  const searchTextByDishId = new Map<string, string>();
  const allDishes: DishDetail[] = [];

  allVenues.forEach((venue) => {
    venueById.set(venue.id, venue);
    const venuesForBuilding = venuesByBuildingId.get(venue.buildingId) ?? [];
    venuesForBuilding.push(venue);
    venuesByBuildingId.set(venue.buildingId, venuesForBuilding);

    const dishes = repository.listDishesByVenue(venue.id);
    dishesByVenueId.set(venue.id, dishes);
    sortedDishesByVenueId.set(venue.id, cloneSortedDishes(dishes));
    dishes.forEach((dish) => {
      allDishes.push(dish);
      dishById.set(dish.id, dish);
      searchTextByDishId.set(dish.id, toDishSearchText(dish, venue));
    });
  });

  stallPosts.forEach((post) => {
    if (!postByVenueId.has(post.venueId)) {
      postByVenueId.set(post.venueId, post);
    }
    post.dishIds.forEach((dishId) => {
      if (!postByDishId.has(dishId)) {
        postByDishId.set(dishId, post);
      }
    });
  });

  const index: BrowseIndex = {
    allDishes,
    allVenues,
    dishById,
    dishesByVenueId,
    postByDishId,
    postByVenueId,
    searchTextByDishId,
    sortedDishesByVenueId,
    stallPosts,
    venueById,
    venuesByBuildingId,
  };

  cachedBrowseIndex = { index, repository };
  return index;
}

export function searchBrowseDishes(
  index: BrowseIndex,
  options: {
    dietaryFlags?: readonly DietaryFlag[];
    query?: string;
    radiusMeters?: number;
  },
): DishDetail[] {
  const normalizedQuery = options.query?.trim().toLowerCase() ?? "";
  const dietaryFlags = options.dietaryFlags ?? [];
  const radiusMeters = options.radiusMeters ?? Number.MAX_SAFE_INTEGER;

  return index.allDishes
    .filter((dish) => {
      const matchesQuery =
        !normalizedQuery ||
        (index.searchTextByDishId.get(dish.id) ?? dish.name.toLowerCase()).includes(
          normalizedQuery,
        );
      const matchesDietary =
        dietaryFlags.length === 0 || dietaryFlags.every((flag) => dish.dietaryFlags.includes(flag));
      return matchesQuery && matchesDietary && dish.distanceMeters <= radiusMeters;
    })
    .sort((left, right) => {
      if (right.rating !== left.rating) {
        return right.rating - left.rating;
      }
      return left.distanceMeters - right.distanceMeters;
    });
}
