import { hasAvailabilityFlag } from "@/features/merchant/menuSections";
import type { DishDetail } from "@/types/domain";

/** A stall can feature this many dishes ("Stall's pick"); the database enforces it too. */
export const MAX_FEATURED_DISHES = 3;

export function countFeaturedDishes(menu: readonly DishDetail[]): number {
  return menu.filter((dish) => hasAvailabilityFlag(dish.availabilityFlags, "featured")).length;
}

/** The database refusing a fourth featured dish (check_violation): an answer, not a failure. */
export function isFeaturedLimitError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "23514";
}
