import { hasPersonalTasteProfile, tasteMatchPercent } from "@/lib/ai/tasteEngine";
import type { TasteVector } from "@/types/domain";
import type { ReviewFeedItem } from "./reviewFeed";

/** A filter chip on the Reviews page: everything, your taste, one kind of food or one area. */
export type ReviewExploreChip =
  | { id: "all"; kind: "all"; label: string }
  | { id: "taste"; kind: "taste"; label: string }
  | { id: string; kind: "food" | "area"; label: string; value: string };

/** A dish this close to the diner's palette counts as "for your taste". */
export const TASTE_MATCH_MIN_PERCENT = 70;
const MAX_FOOD_CHIPS = 6;
const MAX_AREA_CHIPS = 6;

/** Only reviews with a photo belong on the Reviews page. */
export function reviewsWithPhotos(items: readonly ReviewFeedItem[]): ReviewFeedItem[] {
  return items.filter((item) => item.review.photos.some((photo) => photo.trim().length > 0));
}

/** The kind of food a review is about: the dish's food type, else its name. */
export function reviewFoodLabel(item: ReviewFeedItem): string {
  return (item.dish?.foodTypeTag ?? item.dishName).trim();
}

/** Most common values first, ties in A-Z order, at most `limit`. */
function topValues(values: string[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

/**
 * Chips built from what is on the page: "For your taste" first when the diner has a palette,
 * then "All", the most reviewed foods, then the areas with the most reviews.
 */
export function buildReviewExploreChips(
  items: readonly ReviewFeedItem[],
  options: { userVector?: TasteVector; areaOf: (item: ReviewFeedItem) => string | undefined },
): ReviewExploreChip[] {
  const chips: ReviewExploreChip[] = [];
  if (options.userVector && hasPersonalTasteProfile(options.userVector)) {
    chips.push({ id: "taste", kind: "taste", label: "For your taste" });
  }
  chips.push({ id: "all", kind: "all", label: "All" });
  for (const food of topValues(items.map(reviewFoodLabel), MAX_FOOD_CHIPS)) {
    chips.push({ id: `food:${food}`, kind: "food", label: food, value: food });
  }
  const areas = topValues(
    items.map((item) => options.areaOf(item) ?? ""),
    MAX_AREA_CHIPS,
  );
  for (const area of areas) {
    chips.push({ id: `area:${area}`, kind: "area", label: area, value: area });
  }
  return chips;
}

/**
 * The chip a diner picked, kept in the rail even when its food or area dropped out of the top
 * values after a reload, so the filter never jumps to another chip on its own.
 */
export function withSelectedReviewChip(
  chips: readonly ReviewExploreChip[],
  selectedId: string,
): ReviewExploreChip[] {
  if (chips.some((chip) => chip.id === selectedId)) return [...chips];
  const [kind, ...rest] = selectedId.split(":");
  const value = rest.join(":");
  if ((kind === "food" || kind === "area") && value) {
    return [...chips, { id: selectedId, kind, label: value, value }];
  }
  return [...chips];
}

/** The chip in force: the picked one when it is in the rail, otherwise "All" (never "taste"). */
export function resolveActiveReviewChip(
  chips: readonly ReviewExploreChip[],
  selectedId: string,
): ReviewExploreChip | undefined {
  return (
    chips.find((chip) => chip.id === selectedId) ??
    chips.find((chip) => chip.kind === "all") ??
    chips[0]
  );
}

/**
 * The reviews the grid may show: not hidden for this session (reported, blocked), and not the
 * viewer's own review that moderation hid or removed (others cannot see it, so the public grid
 * must not suggest they can).
 */
export function visibleGridReviews(
  items: readonly ReviewFeedItem[],
  options: { viewerId?: string; isHidden: (item: ReviewFeedItem) => boolean },
): ReviewFeedItem[] {
  return items.filter((item) => {
    if (options.isHidden(item)) return false;
    const own = Boolean(options.viewerId && item.review.authorId === options.viewerId);
    return !(own && item.review.moderationState);
  });
}

export function filterReviewExplore(
  items: readonly ReviewFeedItem[],
  chip: ReviewExploreChip | undefined,
  options: { userVector?: TasteVector; areaOf: (item: ReviewFeedItem) => string | undefined },
): ReviewFeedItem[] {
  if (!chip || chip.kind === "all") return [...items];
  if (chip.kind === "taste") {
    const user = options.userVector;
    if (!user) return [...items];
    return items.filter(
      (item) =>
        item.dish !== undefined &&
        tasteMatchPercent(user, item.dish.tasteVector) >= TASTE_MATCH_MIN_PERCENT,
    );
  }
  if (chip.kind === "food") return items.filter((item) => reviewFoodLabel(item) === chip.value);
  return items.filter((item) => options.areaOf(item) === chip.value);
}
