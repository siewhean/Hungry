import type { CustomerInteraction } from "@/types/domain";

export type RatingFilter = "rating_low" | "rating_mid" | "rating_high";

/** Star bands of the inbox filter chips: 1–2 stars, 3 stars and 4–5 stars. */
const RATING_BANDS: Record<RatingFilter, readonly [number, number]> = {
  rating_low: [1, 2],
  rating_mid: [3, 3],
  rating_high: [4, 5],
};

export function isRatingFilter(value: string): value is RatingFilter {
  return value in RATING_BANDS;
}

/** A review without a star rating belongs to no band. */
export function matchesRatingFilter(
  interaction: Pick<CustomerInteraction, "rating">,
  filter: RatingFilter,
): boolean {
  const rating = interaction.rating;
  if (typeof rating !== "number") return false;
  const [min, max] = RATING_BANDS[filter];
  return rating >= min && rating <= max;
}

export type SentimentStats = {
  /** Reviews that carry a star rating: the base of the percentages. */
  total: number;
  positive: number;
  neutral: number;
  negative: number;
};

/** Percentages of the rated reviews; reviews without stars are left out, not called neutral. */
export function getSentimentStats(
  interactions: readonly Pick<CustomerInteraction, "rating">[],
): SentimentStats | null {
  const rated = interactions.filter(
    (item) => typeof item.rating === "number" && item.rating > 0,
  ) as { rating: number }[];
  if (rated.length === 0) return null;
  const share = (count: number) => Math.round((count / rated.length) * 100);
  return {
    total: rated.length,
    positive: share(rated.filter((item) => item.rating >= 4).length),
    neutral: share(rated.filter((item) => item.rating === 3).length),
    negative: share(rated.filter((item) => item.rating <= 2).length),
  };
}
