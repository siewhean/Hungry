// The words and pictures behind the two Food Portfolio share cards: Portfolio (a 3 by 3 grid of
// your dish photos) and Rank (your place on the leaderboard). The artwork lives in
// src/components/foodPortfolio/FoodPortfolioShareSheet.tsx; this file holds no React.

import { boardScoreLabel } from "@/features/leaderboard/leaderboardDisplay";
import type { Bite, LeaderboardPeriod, LeaderboardSummary } from "@/lib/services/types";

export type FoodPortfolioCardKind = "portfolio" | "rank";

/** Cards are laid out at this width (points) and scaled; sizes in the artwork are relative to it. */
export const FOOD_PORTFOLIO_CARD_BASE_WIDTH = 360;
/** Shared as an Instagram Story picture (9:16). */
export const FOOD_PORTFOLIO_CARD_SIZE = { width: 1080, height: 1920 } as const;
export const FOOD_PORTFOLIO_CARD_PHOTOS = 9;
/** The last line on both cards: an ask to follow, and where to find Hungry. */
export const FOOD_PORTFOLIO_CARD_FOOTER = "Follow me on Hungry · usehungry.com";

export function foodPortfolioCardHeight(width: number): number {
  return Math.round((width * FOOD_PORTFOLIO_CARD_SIZE.height) / FOOD_PORTFOLIO_CARD_SIZE.width);
}

/** Up to nine photos: your top three first, then your newest dishes, each photo once. */
export function portfolioCardPhotos(
  topPosts: Pick<Bite, "photoUrl">[],
  posts: Pick<Bite, "photoUrl">[],
  max: number = FOOD_PORTFOLIO_CARD_PHOTOS,
): string[] {
  const photos: string[] = [];
  for (const post of [...topPosts, ...posts]) {
    const url = post.photoUrl?.trim();
    if (url && !photos.includes(url)) photos.push(url);
    if (photos.length >= max) break;
  }
  return photos;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

/** "12 dishes · 5 stalls"; the stall count is left out while it is unknown. */
export function portfolioCardStatLine(dishCount: number, stallCount: number | null): string {
  const dishes = plural(dishCount, "dish", "dishes");
  return stallCount === null ? dishes : `${dishes} · ${plural(stallCount, "stall", "stalls")}`;
}

export interface RankCardModel {
  rank: number;
  period: LeaderboardPeriod;
  /** "#4" */
  headline: string;
  /** "this week" or "all time" */
  periodLabel: string;
  /** "Most active · 83 pts" */
  detail: string;
}

/**
 * The rank to show: this week's Most active rank when you have one, otherwise all time. Null
 * when you are not on the Most active board yet, so there is nothing to share.
 */
export function rankCardModel(summary: LeaderboardSummary | null): RankCardModel | null {
  if (!summary) return null;
  const week = summary.activeWeekRank && summary.activeWeekRank > 0 ? summary.activeWeekRank : null;
  const all = summary.activeAllRank && summary.activeAllRank > 0 ? summary.activeAllRank : null;
  const rank = week ?? all;
  if (!rank) return null;
  const period: LeaderboardPeriod = week ? "week" : "all";
  const score = period === "week" ? summary.weekPoints : summary.totalPoints;
  return {
    rank,
    period,
    headline: `#${rank}`,
    periodLabel: period === "week" ? "this week" : "all time",
    detail: `Most active · ${boardScoreLabel("active", score)}`,
  };
}

/** The line that goes with the link when the picture cannot be shared. */
export function foodPortfolioShareMessage(
  kind: FoodPortfolioCardKind,
  name: string,
  rank: RankCardModel | null,
): string {
  if (kind === "rank" && rank) {
    return `I'm ${rank.headline} on the Hungry leaderboard ${rank.periodLabel}. ${name} on Hungry:`;
  }
  return `${name}'s Food Portfolio on Hungry:`;
}
