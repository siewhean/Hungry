import { blogPosts, buildings, dishes, guestProfile, userProfile, venues } from "./data";
import { listMockStallPosts } from "./stallPostState";
import { runRecommendationPipeline } from "@/lib/ai/tasteEngine";
import { similarityScore } from "@/lib/ai/similarityScore";
import type { DecideForMeOptions } from "@/lib/services/types";
import type {
  BlogPost,
  BuildingSummary,
  DietaryFlag,
  DishDetail,
  SearchFilters,
  StallPost,
  TasteVector,
  UserProfile,
  VenueSummary,
} from "@/types/domain";

const BUILDING_ID_ALIASES: Record<string, string[]> = {
  "building-maxwell": ["hc-maxwell"],
  "hc-maxwell": ["building-maxwell"],
  "building-lau-pa-sat": ["hc-lau-pa-sat"],
  "hc-lau-pa-sat": ["building-lau-pa-sat"],
  "building-amoy": ["hc-amoy"],
  "hc-amoy": ["building-amoy"],
  "building-old-airport-road": ["hc-old-airport-road"],
  "hc-old-airport-road": ["building-old-airport-road"],
  "building-tiong-bahru": ["hc-tiong-bahru"],
  "hc-tiong-bahru": ["building-tiong-bahru"],
  "building-food-republic-wisma": ["fc-food-republic-wisma"],
  "fc-food-republic-wisma": ["building-food-republic-wisma"],
  "building-koufu-jem": ["fc-koufu-jem"],
  "fc-koufu-jem": ["building-koufu-jem"],
};

function resolveBuildingIds(buildingId: string) {
  return new Set([buildingId, ...(BUILDING_ID_ALIASES[buildingId] ?? [])]);
}

export const dataRepositoryMock = {
  getProfile(isAuthenticated: boolean): UserProfile {
    return isAuthenticated ? userProfile : guestProfile;
  },
  listBuildings(): BuildingSummary[] {
    return buildings;
  },
  listVenuesByBuilding(buildingId: string): VenueSummary[] {
    const buildingIds = resolveBuildingIds(buildingId);
    return venues.filter((venue) => buildingIds.has(venue.buildingId));
  },
  getVenueById(venueId: string) {
    return venues.find((venue) => venue.id === venueId);
  },
  getDishById(dishId: string): DishDetail | undefined {
    return dishes.find((dish) => dish.id === dishId);
  },
  listDishesByVenue(venueId: string): DishDetail[] {
    return dishes.filter((dish) => dish.venueId === venueId);
  },
  listPopularNearby(): DishDetail[] {
    return [...dishes].sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 4);
  },
  searchDishes(filters: SearchFilters, tasteProfile: TasteVector): DishDetail[] {
    const query = filters.query.trim().toLowerCase();
    const results = dishes.filter((dish) => {
      const matchesQuery = !query || dish.name.toLowerCase().includes(query);
      const matchesDietary =
        filters.dietaryFlags.length === 0 ||
        filters.dietaryFlags.every((flag) => dish.dietaryFlags.includes(flag));
      const matchesCategory =
        filters.categories.length === 0 ||
        filters.categories.some((category) =>
          `${dish.name} ${dish.tasteTags.join(" ")}`.toLowerCase().includes(category.split(" ")[0]),
        );

      return (
        matchesQuery && matchesDietary && matchesCategory && dish.distanceMeters <= filters.radius
      );
    });

    const ranked = runRecommendationPipeline(results, {
      userVector: filters.tasteValues || tasteProfile,
      dietaryFlags: filters.dietaryFlags,
      radiusMeters: filters.radius,
      neophiliaIndex: 5,
    });

    return ranked
      .map((result) => results.find((dish) => dish.id === result.dishId))
      .filter((dish): dish is DishDetail => Boolean(dish));
  },
  getDecideForMe(tasteProfile: TasteVector, options: DecideForMeOptions = {}) {
    const dietaryFlags: DietaryFlag[] = options.dietaryFlags ?? [];
    const radiusMeters = options.radiusMeters ?? 500;
    const pipelineResults = runRecommendationPipeline(dishes, {
      userVector: tasteProfile,
      dietaryFlags,
      neophiliaIndex: options.neophiliaIndex ?? 5,
      latitude: options.latitude,
      longitude: options.longitude,
      radiusMeters,
      excludeDishIds: options.excludeDishIds,
    });

    const topDish = pipelineResults[0]
      ? dishes.find((dish) => dish.id === pipelineResults[0].dishId)
      : undefined;
    if (topDish) {
      return topDish;
    }

    return [...dishes]
      .filter((dish) => dish.distanceMeters <= radiusMeters)
      .sort(
        (a, b) =>
          similarityScore(b.tasteVector, tasteProfile) -
          similarityScore(a.tasteVector, tasteProfile),
      )[0];
  },
  listBlogPosts(): BlogPost[] {
    return blogPosts;
  },
  listStallPosts(): StallPost[] {
    return listMockStallPosts();
  },
};

export const mockRepository = dataRepositoryMock;
