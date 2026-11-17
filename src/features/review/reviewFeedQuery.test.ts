import assert from "node:assert/strict";
import test from "node:test";
import type { RecentReviewFeedEntry } from "@/lib/services/types";
import { dishes } from "@/lib/services/mock/data";
import { normalizeReviewFeedOptions, selectReviewFeedEntries } from "./reviewFeedQuery";
const dish = dishes.find((item) => item.reviews.length)!;
const base: RecentReviewFeedEntry = {
  review: dish.reviews[0],
  dishId: dish.id,
  dishName: dish.name,
  venueId: dish.venueId,
  venueName: dish.venueName,
};
const entries = ["a", "b", "c"].map((suffix, index) => ({
  ...base,
  review: {
    ...base.review,
    id: `${base.review.id}-${suffix}`,
    createdAt: base.review.createdAt,
    rating: base.review.rating - index,
  },
}));

test("review filtering precedes limiting and searches dish, stall and tags", () => {
  for (const query of [dish.name, dish.venueName, base.review.tags[0]])
    assert.equal(selectReviewFeedEntries(entries, { query, limit: 1 }).length, 1);
  assert.deepEqual(selectReviewFeedEntries(entries, { query: "no matching food" }), []);
  assert.deepEqual(selectReviewFeedEntries(entries, { venueId: "missing-venue" }), []);
});

test("same-time review cursor pages use IDs and top-rated uses rating first", () => {
  const first = selectReviewFeedEntries(entries, { limit: 1 })[0];
  assert.equal(first.review.id, entries[2].review.id);
  const next = selectReviewFeedEntries(entries, {
    limit: 2,
    cursor: { createdAt: first.review.createdAt, id: first.review.id },
  });
  assert.deepEqual(
    next.map((entry) => entry.review.id),
    [entries[1].review.id, entries[0].review.id],
  );
  const best = selectReviewFeedEntries(entries, { sort: "top_rated", limit: 1 })[0];
  assert.equal(best.review.id, entries[0].review.id);
  assert.equal(
    selectReviewFeedEntries(entries, {
      sort: "top_rated",
      cursor: { createdAt: best.review.createdAt, id: best.review.id, rating: best.review.rating },
    }).length,
    2,
  );
});

test("cursor keeps microsecond precision and rejects incomplete rating boundaries", () => {
  const earlier = { ...base, review: { ...base.review, createdAt: "2026-10-20T00:00:00.000001Z" } };
  const later = { ...base, review: { ...base.review, createdAt: "2026-10-20T00:00:00.000002Z" } };
  assert.equal(
    normalizeReviewFeedOptions({
      cursor: { createdAt: later.review.createdAt, id: later.review.id },
    }).cursor?.createdAt,
    later.review.createdAt,
  );
  assert.deepEqual(
    selectReviewFeedEntries([earlier, later], {
      cursor: { createdAt: later.review.createdAt, id: later.review.id },
    }),
    [earlier],
  );
  assert.throws(
    () =>
      normalizeReviewFeedOptions({
        sort: "top_rated",
        cursor: { createdAt: base.review.createdAt, id: base.review.id },
      }),
    /cursor/,
  );
  assert.throws(() => normalizeReviewFeedOptions({ limit: NaN }), /page size/);
});
