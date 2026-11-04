import type { Review } from "@/types/domain";

export type ReviewSort = "newest" | "helpful" | "highest" | "lowest";

export const REVIEW_SORT_OPTIONS: readonly { id: ReviewSort; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "helpful", label: "Most helpful" },
  { id: "highest", label: "Highest" },
  { id: "lowest", label: "Lowest" },
];

/** Fewer written reviews than this and a bar chart or a "most mentioned" list says nothing. */
export const MIN_REVIEWS_FOR_SUMMARY = 3;
/** A word counts as "mentioned" once this many diners used it. */
const MIN_TAG_MENTIONS = 2;
const MAX_MENTIONED_TAGS = 5;

export type ReviewSummary = {
  /** Written reviews per star, index 0 = 1 star ... index 4 = 5 stars. */
  counts: [number, number, number, number, number];
  total: number;
  /** Tags several diners used, most used first. */
  mentioned: { tag: string; count: number }[];
};

const time = (review: Review) => Date.parse(review.createdAt) || 0;

/** A sorted copy. Ties fall back to newest first, then id, so the order never shuffles. */
export function sortReviews(reviews: readonly Review[], sort: ReviewSort): Review[] {
  const byNewest = (a: Review, b: Review) => time(b) - time(a) || (a.id < b.id ? -1 : 1);
  const compare: Record<ReviewSort, (a: Review, b: Review) => number> = {
    newest: byNewest,
    helpful: (a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0) || byNewest(a, b),
    highest: (a, b) => b.rating - a.rating || byNewest(a, b),
    lowest: (a, b) => a.rating - b.rating || byNewest(a, b),
  };
  return [...reviews].sort(compare[sort]);
}

export function filterReviews(
  reviews: readonly Review[],
  filter: { withPhotos: boolean },
): Review[] {
  return filter.withPhotos
    ? reviews.filter((review) => (review.photos?.length ?? 0) > 0)
    : [...reviews];
}

/** The star histogram and the most used tags of the written reviews on screen. */
export function buildReviewSummary(reviews: readonly Review[]): ReviewSummary {
  const counts: ReviewSummary["counts"] = [0, 0, 0, 0, 0];
  const tagCounts = new Map<string, { tag: string; count: number }>();
  for (const review of reviews) {
    const star = Math.round(review.rating);
    if (star >= 1 && star <= 5) counts[star - 1] += 1;
    // One diner's repeated tag counts once.
    const seen = new Set<string>();
    for (const raw of review.tags ?? []) {
      const key = raw.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const entry = tagCounts.get(key);
      if (entry) entry.count += 1;
      else tagCounts.set(key, { tag: raw.trim(), count: 1 });
    }
  }
  const mentioned = [...tagCounts.values()]
    .filter((entry) => entry.count >= MIN_TAG_MENTIONS)
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, MAX_MENTIONED_TAGS);
  return { counts, total: reviews.length, mentioned };
}

/**
 * The header's count line. The dish's total counts every star rating; only some come with
 * words, so both numbers are given: "118 ratings · 1 written review".
 */
export function ratingsHeadline(
  ratingCount: number,
  writtenCount: number,
  moreWrittenAvailable = false,
): string {
  const written = Math.min(writtenCount, ratingCount);
  const writtenText = `${written}${moreWrittenAvailable ? "+" : ""} written ${
    written === 1 && !moreWrittenAvailable ? "review" : "reviews"
  }`;
  if (ratingCount <= 0) return writtenCount > 0 ? writtenText : "No ratings yet";
  const ratings = `${ratingCount} ${ratingCount === 1 ? "rating" : "ratings"}`;
  if (written <= 0) return ratings;
  // Every rating came with a review: one number is enough.
  if (written === ratingCount && !moreWrittenAvailable) {
    return `${ratingCount} ${ratingCount === 1 ? "review" : "reviews"}`;
  }
  return `${ratings} · ${writtenText}`;
}
