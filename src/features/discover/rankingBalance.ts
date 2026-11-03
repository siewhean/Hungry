/**
 * Three balancing rules for Home's ranking, all pure:
 *  - new and unproven dishes and stalls get a guaranteed slot, so popular ones do not win forever;
 *  - a dish's rating counts, but only as far as the number of reviews backs it;
 *  - a diner with food history ranks by their liked dishes as well as the palate; a new diner
 *    ranks by the quiz palate alone.
 */
import { buildTagAffinity, tagMatchScore } from "@/lib/ai/tasteEngine";
import type { DishSummary, FoodOpenness } from "@/types/domain";

/** A dish or stall with fewer reviews than this is "new": nobody has had a chance to rate it yet. */
export const FRESH_REVIEW_LIMIT = 3;
/** Only items this far down the ranking can be lifted into a reserved slot. */
export const FRESH_LIFT_WINDOW = 30;

/**
 * How hard Home leans on what the diner already likes, by their food openness setting:
 * "favourites" follows liked dishes closely and reserves few slots for new food; "adventurous"
 * leans on them lightly and reserves many. First slot is 1-based (1 is the top).
 */
export type RankingProfile = {
  historyMin: number;
  historyMax: number;
  historyFull: number;
  freshFirst: number;
  freshEvery: number;
};

export const RANKING_PROFILES: Record<FoodOpenness, RankingProfile> = {
  favourites: { historyMin: 0.35, historyMax: 0.7, historyFull: 4, freshFirst: 5, freshEvery: 9 },
  mix: { historyMin: 0.25, historyMax: 0.6, historyFull: 5, freshFirst: 4, freshEvery: 7 },
  adventurous: { historyMin: 0.1, historyMax: 0.35, historyFull: 8, freshFirst: 2, freshEvery: 4 },
};

/** The first reserved slot and the gap after it for a diner's openness (mix when unset). */
export function freshSlotsFor(openness: FoodOpenness = "mix"): { first: number; every: number } {
  const profile = RANKING_PROFILES[openness];
  return { first: profile.freshFirst, every: profile.freshEvery };
}

export function isUnprovenDish(dish: Pick<DishSummary, "reviewCount">): boolean {
  return dish.reviewCount < FRESH_REVIEW_LIMIT;
}

/**
 * Keeps the order, except that reserved slots (4, 11, 18... for "mix") go to the best-ranked new item not already
 * shown. With no new item left (or none in the window) the slot goes to the next ranked item, so
 * a list of all-new or all-proven items comes back unchanged.
 */
export function reserveFreshSlots<T>(
  ranked: readonly T[],
  isFresh: (item: T) => boolean,
  options: { first?: number; every?: number; window?: number } = {},
): T[] {
  const first = options.first ?? RANKING_PROFILES.mix.freshFirst;
  const every = options.every ?? RANKING_PROFILES.mix.freshEvery;
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
export const MAX_QUALITY_POINTS = 3;

/**
 * Points (-3 to +3) for a rating, pulled toward neutral when few reviews stand behind it: a
 * single 5-star review moves a dish less than twenty 4.6 reviews do.
 */
export function qualityPoints(rating: number, reviewCount: number): number {
  if (!(reviewCount > 0) || !(rating > 0)) return 0;
  const shrunk =
    (rating * reviewCount + PRIOR_RATING * PRIOR_REVIEWS) / (reviewCount + PRIOR_REVIEWS);
  const points = (shrunk - PRIOR_RATING) * 6;
  return Math.max(-MAX_QUALITY_POINTS, Math.min(MAX_QUALITY_POINTS, points));
}

/** Mix defaults, kept for callers that do not know the diner's openness. */
export const HISTORY_MAX_WEIGHT = RANKING_PROFILES.mix.historyMax;
export const HISTORY_MIN_WEIGHT = RANKING_PROFILES.mix.historyMin;
export const HISTORY_FULL = RANKING_PROFILES.mix.historyFull;

/**
 * Share of the score taken by the diner's liked dishes: 0 with none (quiz palate only), then
 * rising to the openness's maximum as liked dishes pile up.
 */
export function historyWeight(likedCount: number, openness: FoodOpenness = "mix"): number {
  if (likedCount <= 0) return 0;
  const { historyMin, historyMax, historyFull } = RANKING_PROFILES[openness];
  const progress = Math.min(1, likedCount / historyFull);
  return historyMin + (historyMax - historyMin) * progress;
}

/**
 * Turns a 0-100 taste match into the Home score: blended with how well the dish's tags match the
 * diner's liked dishes (returning diners), plus the review-backed rating points.
 */
export function buildHomeScorer(
  likedDishes: readonly DishSummary[],
  openness: FoodOpenness = "mix",
): (dish: DishSummary, tasteMatch: number) => number {
  const weight = historyWeight(likedDishes.length, openness);
  const affinity = weight > 0 ? buildTagAffinity([...likedDishes]) : new Map<string, number>();
  return (dish, tasteMatch) => {
    const blended =
      weight > 0
        ? (1 - weight) * tasteMatch + weight * 100 * tagMatchScore(dish, affinity)
        : tasteMatch;
    return blended + qualityPoints(dish.rating, dish.reviewCount);
  };
}
