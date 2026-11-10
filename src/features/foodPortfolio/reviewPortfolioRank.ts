import { TASTE_DIMENSIONS } from "@/constants/taste";
import { standardTasteRating } from "@/features/detail/perceivedTaste";
import { tasteMatchPercent } from "@/features/detail/tasteMatch";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite, TasteStamp } from "@/lib/services/types";
import type { TasteKey, TasteVector } from "@/types/domain";

import { FOOD_PORTFOLIO_MAX_PINS, FOOD_PORTFOLIO_PAGE_SIZE } from "./foodPortfolioLoaders";

/** A place in the portfolio's ranking (1 = best), or null for "in my portfolio, not ranked". */
export type PortfolioRank = number | null;

/** Dishes a portfolio needs before its top-three places show as a label on reviews. */
export const PORTFOLIO_LABEL_MIN_DISHES = 5;

/** Stars count for 60% of the score and how close the dish is to the diner's palate for 40%. */
const RATING_WEIGHT = 0.6;
const MATCH_WEIGHT = 0.4;

/** True once every one of the six tastes has an answer. */
export function hasRatedAllTastes(felt: Partial<Record<TasteKey, number>>): boolean {
  return TASTE_DIMENSIONS.every(({ key }) => typeof felt[key] === "number");
}

/**
 * 0-100 palate match: the dish as this reviewer tasted it (their answers turned back into
 * standard levels, the rest from the dish's own levels) against what they like.
 */
export function reviewPalateMatch(
  dishVector: TasteVector,
  felt: Partial<Record<TasteKey, number>>,
  userVector: TasteVector,
): number {
  const tasted: TasteVector = { ...dishVector, ...standardTasteRating(felt, userVector) };
  return tasteMatchPercent(userVector, tasted);
}

/** 0-100 portfolio score from a 1-5 star rating and a 0-100 palate match. */
export function portfolioScore(rating: number, matchPercent: number): number {
  const stars = Math.max(0, Math.min(5, rating));
  return Math.round((stars / 5) * 100 * RATING_WEIGHT + matchPercent * MATCH_WEIGHT);
}

/** The score of a post that is already in the portfolio (its own stars and dish taste stamp). */
export function postPortfolioScore(
  post: Pick<Bite, "rating" | "tasteStamp">,
  userVector: TasteVector,
): number {
  const stamp: TasteStamp = post.tasteStamp;
  return portfolioScore(post.rating, tasteMatchPercent(userVector, stamp));
}

/**
 * Where the new dish would sit in the ranking: just above the first ranked dish that scores
 * lower, or last. `rankedScores` is the ranking best first; a dish whose score is unknown (null)
 * is stepped over, so the suggestion never depends on a dish we could not score.
 */
export function suggestRankedPlace(newScore: number, rankedScores: (number | null)[]): number {
  const firstLower = rankedScores.findIndex((score) => score !== null && score < newScore);
  return firstLower === -1 ? rankedScores.length + 1 : firstLower + 1;
}

/** True for the places that show as a label on reviews (the top three). */
export function isTopThreePlace(place: number | null): boolean {
  return place !== null && place >= 1 && place <= FOOD_PORTFOLIO_MAX_PINS;
}

/**
 * The scores of the viewer's ranked dishes, best first, for the suggestion. A ranked post that
 * is not in the newest page of posts has no score (null). A failed read is reported and gives an
 * empty ranking, so the editor still works with the new dish as the only one.
 */
export async function loadRankedScores(
  userId: string,
  userVector: TasteVector,
): Promise<(number | null)[]> {
  try {
    const service = getHungryService();
    const [ranking, posts] = await Promise.all([
      service.foodPortfolio.getMyRanking(),
      service.social.listUserPosts(userId, { limit: FOOD_PORTFOLIO_PAGE_SIZE, offset: 0 }),
    ]);
    const byId = new Map(posts.map((post) => [post.id, post]));
    return ranking.map((id) => {
      const post = byId.get(id);
      return post ? postPortfolioScore(post, userVector) : null;
    });
  } catch (error) {
    reportError(error, { screen: "ReviewScreen", action: "load_portfolio_ranking" });
    return [];
  }
}
