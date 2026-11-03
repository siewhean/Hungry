/**
 * Three balancing rules for Home's ranking, all pure:
 *  - new and unproven dishes and stalls get a guaranteed slot, so popular ones do not win forever;
 *  - a dish's rating counts, but only as far as the number of reviews backs it;
 *  - a diner with food history ranks by their liked dishes as well as the palate; a new diner
 *    ranks by the quiz palate alone.
 */
import { buildTagAffinity, tagMatchScore } from "@/lib/ai/tasteEngine";
import type { DishSummary } from "@/types/domain";

/** A dish or stall with fewer reviews than this is "new": nobody has had a chance to rate it yet. */
export const FRESH_REVIEW_LIMIT = 3;
/** The first reserved slot (1 is the top) and the gap between reserved slots after it. */
export const FRESH_FIRST_SLOT = 3;
export const FRESH_SLOT_EVERY = 5;
/** Only items this far down the ranking can be lifted into a reserved slot. */
export const FRESH_LIFT_WINDOW = 30;

export function isUnprovenDish(dish: Pick<DishSummary, "reviewCount">): boolean {
  return dish.reviewCount < FRESH_REVIEW_LIMIT;
}

/**
 * Keeps the order, except that slots 3, 8, 13... go to the best-ranked new item not already
 * shown. With no new item left (or none in the window) the slot goes to the next ranked item, so
 * a list of all-new or all-proven items comes back unchanged.
 */
export function reserveFreshSlots<T>(
  ranked: readonly T[],
  isFresh: (item: T) => boolean,
  options: { first?: number; every?: number; window?: number } = {},
): T[] {
  const first = options.first ?? FRESH_FIRST_SLOT;
  const every = options.every ?? FRESH_SLOT_EVERY;
  const window = options.window ?? FRESH_LIFT_WINDOW;
  const used = new Set<number>();
  const result: T[] = [];
  let cursor = 0;
  for (let slot = 1; slot <= ranked.length; slot += 1) {
    const reserved = slot >= first && (slot - first) % every === 0;
    let index = -1;
    if (reserved) {
      const limit = Math.min(ranked.length, window);
      for (let candidate = 0; candidate < limit; candidate += 1) {
        if (!used.has(candidate) && isFresh(ranked[candidate])) {
          index = candidate;
          break;
        }
      }
    }
    if (index === -1) {
      while (used.has(cursor)) cursor += 1;
      index = cursor;
    }
    used.add(index);
    result.push(ranked[index]);
  }
  return result;
}

/** The rating a stall or dish with no reviews is assumed to have: a little above neutral. */
const PRIOR_RATING = 3.8;
/** How many reviews it takes for the real rating to count as much as the assumed one. */
const PRIOR_REVIEWS = 3;
/** Most points (out of 100) the rating can add to, or take from, a taste match. */
export const MAX_QUALITY_POINTS = 5;

/**
 * Points (-5 to +5) for a rating, pulled toward neutral when few reviews stand behind it: a
 * single 5-star review moves a dish less than twenty 4.6 reviews do.
 */
export function qualityPoints(rating: number, reviewCount: number): number {
  if (!(reviewCount > 0) || !(rating > 0)) return 0;
  const shrunk =
    (rating * reviewCount + PRIOR_RATING * PRIOR_REVIEWS) / (reviewCount + PRIOR_REVIEWS);
  const points = (shrunk - PRIOR_RATING) * 6;
  return Math.max(-MAX_QUALITY_POINTS, Math.min(MAX_QUALITY_POINTS, points));
}

/** Most of the taste score that liked-dish tags may take, reached at HISTORY_FULL liked dishes. */
export const HISTORY_MAX_WEIGHT = 0.4;
export const HISTORY_MIN_WEIGHT = 0.1;
export const HISTORY_FULL = 8;

/** Share of the score taken by the diner's liked dishes: 0 with none (quiz palate only). */
export function historyWeight(likedCount: number): number {
  if (likedCount <= 0) return 0;
  const progress = Math.min(1, likedCount / HISTORY_FULL);
  return HISTORY_MIN_WEIGHT + (HISTORY_MAX_WEIGHT - HISTORY_MIN_WEIGHT) * progress;
}

/**
 * Turns a 0-100 taste match into the Home score: blended with how well the dish's tags match the
 * diner's liked dishes (returning diners), plus the review-backed rating points.
 */
export function buildHomeScorer(
  likedDishes: readonly DishSummary[],
): (dish: DishSummary, tasteMatch: number) => number {
  const weight = historyWeight(likedDishes.length);
  const affinity = weight > 0 ? buildTagAffinity([...likedDishes]) : new Map<string, number>();
  return (dish, tasteMatch) => {
    const blended =
      weight > 0
        ? (1 - weight) * tasteMatch + weight * 100 * tagMatchScore(dish, affinity)
        : tasteMatch;
    return blended + qualityPoints(dish.rating, dish.reviewCount);
  };
}
