import { hasAvailabilityFlag } from "@/features/merchant/menuSections";
import type { DishDetail } from "@/types/domain";

/** A stall can feature this many dishes ("Stall's pick"); the database enforces it too. */
export const MAX_FEATURED_DISHES = 3;

export function countFeaturedDishes(menu: readonly DishDetail[]): number {
  return menu.filter((dish) => hasAvailabilityFlag(dish.availabilityFlags, "featured")).length;
}

/** The hint the blocked-word trigger on dish and stall text attaches to its refusal. */
export const MERCHANT_TEXT_BLOCKED_HINT = "merchant_text_blocked_term";

/** The database refusing dish or stall text that has a blocked word: the merchant's input, not a bug. */
export function isBlockedTextError(error: unknown): boolean {
  const { code, hint } = (error ?? {}) as { code?: unknown; hint?: unknown };
  return code === "23514" && hint === MERCHANT_TEXT_BLOCKED_HINT;
}

/** The database refusing a fourth featured dish (check_violation): an answer, not a failure. */
export function isFeaturedLimitError(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "23514" && !isBlockedTextError(error);
}
