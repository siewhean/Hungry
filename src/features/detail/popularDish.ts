import type { DishDetail } from "@/types/domain";

/** A dish counts as popular only with at least this many reviews averaging this rating or better. */
export const POPULAR_MIN_REVIEWS = 5;
export const POPULAR_MIN_RATING = 4;

/**
 * "Popular" is calculated from real reviews. The editorial `mustOrder` flag is not enough on
 * its own, so a dish with no reviews never carries the badge.
 */
export function isPopularDish(dish: Pick<DishDetail, "rating" | "reviewCount">): boolean {
  return dish.reviewCount >= POPULAR_MIN_REVIEWS && dish.rating >= POPULAR_MIN_RATING;
}
