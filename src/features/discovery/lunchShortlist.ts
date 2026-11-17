import type { RecommendationSlateRequest } from "@/lib/services/types";
import type { Coordinate, DietaryFlag, DishDetail, TasteVector } from "@/types/domain";

import { isWithinBudget } from "@/features/discover/budget";
export {
  BUDGET_OPTIONS as LUNCH_BUDGETS,
  resolveBudgetMaximum as effectiveLunchBudget,
} from "@/features/discover/budget";

export const LUNCH_RADII = [500, 1000, 3000] as const;

export function hasLunchLocation(
  permission: string,
  coordinate: Coordinate,
  manualCoordinate?: Coordinate,
): boolean {
  const source = manualCoordinate ?? (permission === "granted" ? coordinate : undefined);
  return (
    !!source &&
    Number.isFinite(source.latitude) &&
    Math.abs(source.latitude) <= 90 &&
    Number.isFinite(source.longitude) &&
    Math.abs(source.longitude) <= 180
  );
}

export function buildLunchRequest(options: {
  tasteProfile: TasteVector;
  dietaryFlags: DietaryFlag[];
  coordinate: Coordinate;
  radiusMeters: number;
  maxPrice: number;
  neophiliaIndex?: number;
}): RecommendationSlateRequest {
  return {
    surface: "decide",
    tasteProfile: options.tasteProfile,
    dietaryFlags: [...options.dietaryFlags],
    latitude: options.coordinate.latitude,
    longitude: options.coordinate.longitude,
    radiusMeters: options.radiusMeters,
    maxPrice: options.maxPrice,
    limit: 30,
    neophiliaIndex: options.neophiliaIndex,
  };
}

export function eligibleLunchDishes(
  dishes: DishDetail[],
  maxPrice: number,
  radiusMeters: number,
  dietaryFlags: DietaryFlag[],
): DishDetail[] {
  const seen = new Set<string>();
  return dishes.filter((dish) => {
    if (
      seen.has(dish.id) ||
      !isWithinBudget(dish.price, maxPrice) ||
      !Number.isFinite(dish.distanceMeters) ||
      dish.distanceMeters < 0 ||
      dish.distanceMeters > radiusMeters ||
      !dietaryFlags.every((flag) => dish.dietaryFlags.includes(flag))
    )
      return false;
    seen.add(dish.id);
    return true;
  });
}
