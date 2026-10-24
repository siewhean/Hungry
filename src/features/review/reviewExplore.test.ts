import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import type { DishDetail, Review } from "@/types/domain";
import {
  buildReviewExploreChips,
  filterReviewExplore,
  resolveActiveReviewChip,
  reviewsWithPhotos,
  clearDeletedReviewsForSession,
  isReviewDeletedForSession,
  markReviewDeletedForSession,
  visibleGridReviews,
  withSelectedReviewChip,
} from "./reviewExplore";
import type { ReviewFeedItem } from "./reviewFeed";

const review = (id: string, photos: string[]): Review => ({
  id,
  authorName: "A",
  rating: 4,
  createdAt: "2026-10-01",
  text: "Good",
  tags: [],
  wouldRecommend: true,
  photos,
});

const item = (
  id: string,
  dishName: string,
  area: string,
  tasteVector = NEUTRAL_TASTE_VECTOR,
  photos = ["https://example.com/a.jpg"],
): ReviewFeedItem & { area: string } => ({
  review: review(id, photos),
  dish: { id: `dish-${id}`, name: dishName, tasteVector } as unknown as DishDetail,
  dishId: `dish-${id}`,
  dishName,
  venueName: "Stall",
  venueId: "venue",
  interactionId: id,
  area,
});

const spicyLover = { ...NEUTRAL_TASTE_VECTOR, spicy: 10, rich: 9 };
const items = [
  item("1", "Laksa", "Maxwell", { ...NEUTRAL_TASTE_VECTOR, spicy: 9, rich: 9 }),
  item("2", "Laksa", "Amoy"),
  item("3", "Chicken Rice", "Maxwell", { ...NEUTRAL_TASTE_VECTOR, spicy: 0, rich: 2 }),
  item("4", "Kaya Toast", "Amoy", NEUTRAL_TASTE_VECTOR, []),
];
const areaOf = (entry: ReviewFeedItem) => (entry as ReviewFeedItem & { area: string }).area;

test("only reviews with a photo are shown", () => {
  assert.deepEqual(
    reviewsWithPhotos(items).map((entry) => entry.review.id),
    ["1", "2", "3"],
  );
  assert.equal(reviewsWithPhotos([item("5", "X", "Y", NEUTRAL_TASTE_VECTOR, [" "])]).length, 0);
});

test("chips: your taste first, then all, most reviewed foods, then areas", () => {
  const shown = reviewsWithPhotos(items);
  const chips = buildReviewExploreChips(shown, { userVector: spicyLover, areaOf });
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["For your taste", "All", "Laksa", "Chicken Rice", "Maxwell", "Amoy"],
  );
  // No palette: no taste chip.
  const plain = buildReviewExploreChips(shown, { userVector: NEUTRAL_TASTE_VECTOR, areaOf });
  assert.ok(!plain.some((chip) => chip.kind === "taste"));
});

test("filters by taste, food and area", () => {
  const shown = reviewsWithPhotos(items);
  const chips = buildReviewExploreChips(shown, { userVector: spicyLover, areaOf });
  const pick = (label: string) =>
    filterReviewExplore(
      shown,
      chips.find((chip) => chip.label === label),
      { userVector: spicyLover, areaOf },
    ).map((entry) => entry.review.id);
  assert.deepEqual(pick("All"), ["1", "2", "3"]);
  assert.deepEqual(pick("For your taste"), ["1"]);
  assert.deepEqual(pick("Laksa"), ["1", "2"]);
  assert.deepEqual(pick("Maxwell"), ["1", "3"]);
});

test("a picked food that drops out of the top six stays selected; a lost chip falls back to All (REV-8)", () => {
  const chips = buildReviewExploreChips(items, { userVector: spicyLover, areaOf: (i) => (i as unknown as { area: string }).area });
  assert.equal(chips[0]?.id, "taste", "taste is first for a diner with a palette");

  // "food:Satay" is not on the page any more: it is kept, not swapped for "For your taste".
  const kept = withSelectedReviewChip(chips, "food:Satay");
  assert.equal(resolveActiveReviewChip(kept, "food:Satay")?.id, "food:Satay");
  assert.equal(kept.length, chips.length + 1);
  assert.equal(withSelectedReviewChip(chips, "food:Laksa").length, chips.length);

  // An id that cannot be rebuilt falls back to All, never to the taste chip.
  assert.equal(resolveActiveReviewChip(chips, "gone")?.id, "all");
});

test("the grid leaves out session-hidden reviews and the viewer's own moderated ones (REV-X5)", () => {
  const own = item("own", "Laksa", "Maxwell");
  own.review = { ...own.review, authorId: "me", moderationState: "hidden" };
  const ownLive = item("own-live", "Laksa", "Maxwell");
  ownLive.review = { ...ownLive.review, authorId: "me" };
  const reported = item("reported", "Laksa", "Maxwell");
  const visible = visibleGridReviews([own, ownLive, reported, ...items], {
    viewerId: "me",
    isHidden: (i) => i.review.id === "reported",
  });
  assert.deepEqual(
    visible.map((i) => i.review.id),
    ["own-live", ...items.map((i) => i.review.id)],
  );
});

test("a review deleted on another screen leaves the grid this session (REV-V1)", () => {
  clearDeletedReviewsForSession();
  const deleted = item("deleted", "Laksa", "Maxwell");
  const kept = item("kept", "Laksa", "Maxwell");
  const options = { isHidden: () => false };
  assert.equal(visibleGridReviews([deleted, kept], options).length, 2);
  markReviewDeletedForSession("deleted");
  assert.equal(isReviewDeletedForSession("deleted"), true);
  assert.deepEqual(
    visibleGridReviews([deleted, kept], options).map((i) => i.review.id),
    ["kept"],
  );
  clearDeletedReviewsForSession();
});
