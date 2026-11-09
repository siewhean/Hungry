import { useEffect, useState } from "react";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useSessionStore } from "@/store/useSessionStore";

/** The server reads at most this many reviews at once. */
export const REVIEW_RANKS_BATCH = 50;

const EMPTY: ReadonlyMap<string, number> = new Map();

/** "#2 in Sam's Food Portfolio" for a review's rank label. */
export function portfolioRankLabel(rank: number, authorName: string): string {
  const name = authorName.trim();
  return name ? `#${rank} in ${name}'s Food Portfolio` : `#${rank} in their Food Portfolio`;
}

/**
 * The top-three Food Portfolio place of each review's dish, by review id: one batched read for
 * every review on screen. Only reviews whose author has at least five dishes and ranks that dish
 * in their top three are in the map. A failed read is reported and shows no labels.
 */
export function useReviewPortfolioRanks(reviewIds: string[]): ReadonlyMap<string, number> {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const enabled = FEATURE_FLAGS.foodPortfolioEnabled && isAuthenticated;
  const key = enabled ? [...new Set(reviewIds)].slice(0, REVIEW_RANKS_BATCH).join(",") : "";
  const [ranks, setRanks] = useState<{ key: string; map: ReadonlyMap<string, number> }>({
    key: "",
    map: EMPTY,
  });

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    getHungryService()
      .foodPortfolio.getReviewPortfolioRanks(key.split(","))
      .then((rows) => {
        if (active) setRanks({ key, map: new Map(rows.map((row) => [row.reviewId, row.rank])) });
      })
      .catch((error: unknown) => {
        // The label is extra: the review shows without it.
        reportError(error, { screen: "Reviews", action: "load_portfolio_ranks" });
      });
    return () => {
      active = false;
    };
  }, [key]);

  return key && ranks.key === key ? ranks.map : EMPTY;
}
