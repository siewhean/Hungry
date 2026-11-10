import { useEffect, useState } from "react";

import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { ReviewPortfolioLabel } from "@/lib/services/types";
import { useSessionStore } from "@/store/useSessionStore";

/** The server reads at most this many reviews at once. */
export const REVIEW_LABELS_BATCH = 50;

const EMPTY: ReadonlyMap<string, ReviewPortfolioLabel> = new Map();

/**
 * The words beside a review: "Emma's best laksa", "#2 in Emma's Food Portfolio", or both
 * ("Emma's best laksa, #2 overall"). Null when the label has neither.
 */
export function portfolioLabelText(
  label: Pick<ReviewPortfolioLabel, "foodType" | "overallPlace">,
  authorName: string,
): string | null {
  const name = authorName.trim();
  const owner = name ? `${name}'s` : "Their";
  const foodType = label.foodType?.trim().toLowerCase();
  const place = label.overallPlace;
  if (foodType && place) return `${owner} best ${foodType}, #${place} overall`;
  if (foodType) return `${owner} best ${foodType}`;
  if (place)
    return name ? `#${place} in ${name}'s Food Portfolio` : `#${place} in their Food Portfolio`;
  return null;
}

/**
 * The Food Portfolio label of each review on screen, by review id: one batched read. The server
 * returns a label only when the review's dish is its author's best of that dish type or in their
 * top three, and the author has at least five public dishes. A failed read is reported and shows
 * no labels.
 */
export function useReviewPortfolioLabels(
  reviewIds: string[],
): ReadonlyMap<string, ReviewPortfolioLabel> {
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  const enabled = FEATURE_FLAGS.foodPortfolioEnabled && isAuthenticated;
  const key = enabled ? [...new Set(reviewIds)].slice(0, REVIEW_LABELS_BATCH).join(",") : "";
  const [labels, setLabels] = useState<{
    key: string;
    map: ReadonlyMap<string, ReviewPortfolioLabel>;
  }>({ key: "", map: EMPTY });

  useEffect(() => {
    if (!key) return undefined;
    let active = true;
    getHungryService()
      .foodPortfolio.getReviewPortfolioLabels(key.split(","))
      .then((rows) => {
        if (active) setLabels({ key, map: new Map(rows.map((row) => [row.reviewId, row])) });
      })
      .catch((error: unknown) => {
        // The label is extra: the review shows without it.
        reportError(error, { screen: "Reviews", action: "load_portfolio_labels" });
      });
    return () => {
      active = false;
    };
  }, [key]);

  return key && labels.key === key ? labels.map : EMPTY;
}
