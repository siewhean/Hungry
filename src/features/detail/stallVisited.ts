import type { DishDetail } from "@/types/domain";

/** How many dishes the "What did you have?" sheet offers. */
export const VISITED_SHEET_DISH_COUNT = 4;

/**
 * The dishes to offer after a stall is marked visited: the ones the stall is known for
 * first (must-order, then most reviewed, then best rated), skipping dishes the diner has
 * already tried or reviewed.
 */
export function pickVisitedSheetDishes(
  dishes: readonly DishDetail[],
  doneDishIds: readonly string[] = [],
  limit: number = VISITED_SHEET_DISH_COUNT,
): DishDetail[] {
  const done = new Set(doneDishIds);
  return dishes
    .filter((dish) => !done.has(dish.id))
    .sort(
      (left, right) =>
        Number(Boolean(right.mustOrder)) - Number(Boolean(left.mustOrder)) ||
        right.reviewCount - left.reviewCount ||
        right.rating - left.rating ||
        left.name.localeCompare(right.name),
    )
    .slice(0, limit);
}
