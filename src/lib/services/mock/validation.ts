import { blogPosts, buildings, dishes, guestProfile, stallPosts, userProfile, venues } from "./data";
import type { BlogPost, BuildingSummary, DishDetail, StallPost, UserProfile, VenueSummary } from "@/types/domain";

const TASTE_KEYS = ["sweet", "spicy", "sour", "salty", "rich", "aromatic"] as const;

export interface FixtureValidationIssue {
  code: string;
  message: string;
}

export interface FixtureValidationResult {
  valid: boolean;
  issues: FixtureValidationIssue[];
}

export interface MockFixtureBundle {
  buildings: BuildingSummary[];
  venues: VenueSummary[];
  dishes: DishDetail[];
  stallPosts: StallPost[];
  blogPosts: BlogPost[];
  userProfile: UserProfile;
  guestProfile: UserProfile;
}

export interface FixtureValidationOptions {
  strictTopDishRefs?: boolean;
}

export function getDefaultFixtureBundle(): MockFixtureBundle {
  return {
    buildings,
    venues,
    dishes,
    stallPosts,
    blogPosts,
    userProfile,
    guestProfile,
  };
}

function pushIssue(issues: FixtureValidationIssue[], code: string, message: string) {
  issues.push({ code, message });
}

function validateUniqueIds(
  issues: FixtureValidationIssue[],
  label: string,
  entities: Array<{ id: string }>,
): void {
  const seen = new Set<string>();
  for (const entity of entities) {
    if (seen.has(entity.id)) {
      pushIssue(issues, "DUPLICATE_ID", `${label} has duplicate id: ${entity.id}`);
      continue;
    }
    seen.add(entity.id);
  }
}

function validateTasteVector(issues: FixtureValidationIssue[], dish: DishDetail): void {
  for (const key of TASTE_KEYS) {
    const value = dish.tasteVector[key];
    if (!Number.isFinite(value) || value < 0 || value > 10) {
      pushIssue(issues, "INVALID_TASTE_VECTOR", `dish ${dish.id} has out-of-range ${key}: ${value}`);
    }
  }
}

export function validateFixtureBundle(
  bundle: MockFixtureBundle = getDefaultFixtureBundle(),
  options: FixtureValidationOptions = {},
): FixtureValidationResult {
  const issues: FixtureValidationIssue[] = [];

  validateUniqueIds(issues, "buildings", bundle.buildings);
  validateUniqueIds(issues, "venues", bundle.venues);
  validateUniqueIds(issues, "dishes", bundle.dishes);
  validateUniqueIds(issues, "stallPosts", bundle.stallPosts);
  validateUniqueIds(issues, "blogPosts", bundle.blogPosts);

  const buildingIds = new Set(bundle.buildings.map((item) => item.id));
  const venuesById = new Map(bundle.venues.map((item) => [item.id, item]));
  const dishesById = new Map(bundle.dishes.map((item) => [item.id, item]));

  for (const venue of bundle.venues) {
    if (!buildingIds.has(venue.buildingId)) {
      pushIssue(
        issues,
        "BROKEN_BUILDING_REF",
        `venue ${venue.id} references missing building ${venue.buildingId}`,
      );
    }
    const topDish = dishesById.get(venue.topDishId);
    if (!topDish) {
      if (options.strictTopDishRefs) {
        pushIssue(issues, "BROKEN_TOP_DISH_REF", `venue ${venue.id} topDishId missing: ${venue.topDishId}`);
      }
    } else if (topDish.venueId !== venue.id) {
      pushIssue(
        issues,
        "TOP_DISH_VENUE_MISMATCH",
        `venue ${venue.id} topDishId ${venue.topDishId} belongs to ${topDish.venueId}`,
      );
    }
  }

  for (const dish of bundle.dishes) {
    const venue = venuesById.get(dish.venueId);
    if (!venue) {
      pushIssue(issues, "BROKEN_VENUE_REF", `dish ${dish.id} references missing venue ${dish.venueId}`);
      continue;
    }
    if (!buildingIds.has(dish.buildingId)) {
      pushIssue(issues, "BROKEN_BUILDING_REF", `dish ${dish.id} references missing building ${dish.buildingId}`);
    }
    if (dish.buildingId !== venue.buildingId) {
      pushIssue(
        issues,
        "DISH_BUILDING_MISMATCH",
        `dish ${dish.id} building ${dish.buildingId} does not match venue ${venue.id} building ${venue.buildingId}`,
      );
    }
    if (dish.rating < 0 || dish.rating > 5) {
      pushIssue(issues, "INVALID_RATING", `dish ${dish.id} has invalid rating ${dish.rating}`);
    }
    if (dish.price < 0) {
      pushIssue(issues, "INVALID_PRICE", `dish ${dish.id} has invalid price ${dish.price}`);
    }
    validateTasteVector(issues, dish);
  }

  for (const post of bundle.stallPosts) {
    const venue = venuesById.get(post.venueId);
    if (!venue) {
      pushIssue(issues, "BROKEN_POST_VENUE_REF", `stallPost ${post.id} references missing venue ${post.venueId}`);
      continue;
    }
    if (post.buildingId !== venue.buildingId) {
      pushIssue(
        issues,
        "POST_BUILDING_MISMATCH",
        `stallPost ${post.id} building ${post.buildingId} does not match venue ${venue.id} building ${venue.buildingId}`,
      );
    }
    for (const dishId of post.dishIds) {
      const dish = dishesById.get(dishId);
      if (!dish) {
        pushIssue(issues, "BROKEN_POST_DISH_REF", `stallPost ${post.id} references missing dish ${dishId}`);
        continue;
      }
      if (dish.venueId !== post.venueId) {
        pushIssue(
          issues,
          "POST_DISH_VENUE_MISMATCH",
          `stallPost ${post.id} dish ${dish.id} belongs to ${dish.venueId}, expected ${post.venueId}`,
        );
      }
    }
  }

  for (const post of bundle.blogPosts) {
    if (post.relatedVenueId && !venuesById.has(post.relatedVenueId)) {
      pushIssue(issues, "BROKEN_BLOG_VENUE_REF", `blogPost ${post.id} relatedVenueId missing: ${post.relatedVenueId}`);
    }
  }

  for (const dishId of bundle.userProfile.favouriteDishIds) {
    if (!dishesById.has(dishId)) {
      pushIssue(issues, "BROKEN_PROFILE_FAV_REF", `userProfile favourite dish missing: ${dishId}`);
    }
  }

  for (const dishId of bundle.userProfile.reviewedDishIds) {
    if (!dishesById.has(dishId)) {
      pushIssue(issues, "BROKEN_PROFILE_REVIEW_REF", `userProfile reviewed dish missing: ${dishId}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function assertFixtureBundleValid(bundle: MockFixtureBundle = getDefaultFixtureBundle()): void {
  const result = validateFixtureBundle(bundle);
  if (!result.valid) {
    throw new Error(`Mock fixture validation failed:\n${result.issues.map((i) => `- ${i.code}: ${i.message}`).join("\n")}`);
  }
}
