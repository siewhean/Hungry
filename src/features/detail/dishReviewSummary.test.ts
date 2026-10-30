import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReviewSummary,
  filterReviews,
  ratingsHeadline,
  sortReviews,
} from "@/features/detail/dishReviewSummary";
import type { Review } from "@/types/domain";

function review(id: string, over: Partial<Review> = {}): Review {
  return {
    id,
    authorName: "Diner",
    rating: 4,
    createdAt: "2026-10-20T10:00:00.000Z",
    text: "ok",
    tags: [],
    wouldRecommend: true,
    photos: [],
    ...over,
  };
}

const reviews = [
  review("a", { rating: 5, createdAt: "2026-10-01T00:00:00Z", helpfulCount: 1, tags: ["Crispy"] }),
  review("b", { rating: 2, createdAt: "2026-10-03T00:00:00Z", helpfulCount: 7, photos: ["p.jpg"] }),
  review("c", {
    rating: 4,
    createdAt: "2026-10-02T00:00:00Z",
    tags: ["crispy", "Crispy", "Salty"],
  }),
  review("d", { rating: 5, createdAt: "2026-10-02T00:00:00Z", tags: ["Crispy", "Salty"] }),
];

test("each sort orders the same reviews differently and never mutates the input", () => {
  const before = reviews.map((entry) => entry.id).join();
  assert.deepEqual(
    sortReviews(reviews, "newest").map((entry) => entry.id),
    ["b", "c", "d", "a"],
  );
  assert.deepEqual(
    sortReviews(reviews, "helpful").map((entry) => entry.id),
    ["b", "a", "c", "d"],
  );
  assert.deepEqual(
    sortReviews(reviews, "highest").map((entry) => entry.id),
    ["d", "a", "c", "b"],
  );
  assert.deepEqual(
    sortReviews(reviews, "lowest").map((entry) => entry.id),
    ["b", "c", "d", "a"],
  );
  assert.equal(reviews.map((entry) => entry.id).join(), before);
});

test("With photos keeps only reviews that have photos", () => {
  assert.deepEqual(
    filterReviews(reviews, { withPhotos: true }).map((entry) => entry.id),
    ["b"],
  );
  assert.equal(filterReviews(reviews, { withPhotos: false }).length, 4);
});

test("the summary counts stars and lists tags several diners used", () => {
  const summary = buildReviewSummary(reviews);
  assert.deepEqual(summary.counts, [0, 1, 0, 1, 2]);
  assert.equal(summary.total, 4);
  // "crispy" twice in one review counts once: a, c and d make three.
  assert.deepEqual(summary.mentioned, [
    { tag: "Crispy", count: 3 },
    { tag: "Salty", count: 2 },
  ]);
});

test("a tag only one diner used is not 'mentioned'", () => {
  assert.deepEqual(buildReviewSummary([review("x", { tags: ["Rich"] })]).mentioned, []);
});

test("the headline separates star ratings from written reviews", () => {
  assert.equal(ratingsHeadline(118, 1), "118 ratings · 1 written review");
  assert.equal(ratingsHeadline(118, 3), "118 ratings · 3 written reviews");
  assert.equal(ratingsHeadline(118, 0), "118 ratings");
  assert.equal(ratingsHeadline(4, 4), "4 reviews");
  assert.equal(ratingsHeadline(1, 1), "1 review");
  assert.equal(ratingsHeadline(0, 0), "No ratings yet");
  assert.equal(ratingsHeadline(120, 50, true), "120 ratings · 50+ written reviews");
});
