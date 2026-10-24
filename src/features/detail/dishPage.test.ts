import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDishHeroPhotos,
  mergeRefreshedReviews,
  withoutRemovedReview,
} from "@/features/detail/dishPage";
import type { DishDetail, Review } from "@/types/domain";

const dish = (imageUrl: string, gallery: string[] = []) =>
  ({ id: "d1", imageUrl, gallery }) as unknown as DishDetail;

test("a blocked-host dish photo never reaches the hero, and nothing shows twice (DISH-5)", () => {
  assert.deepEqual(buildDishHeroPhotos(dish("https://images.unsplash.com/photo-1")), []);
  // new URL() adds the trailing slash: the raw and normalised forms used to both show.
  assert.deepEqual(buildDishHeroPhotos(dish("https://cdn.hungry.sg", ["https://cdn.hungry.sg/"])), [
    "https://cdn.hungry.sg/",
  ]);
});

test("the hero holds only the dish's own photos, up to eight (DISH-18)", () => {
  const gallery = Array.from({ length: 10 }, (_, index) => `https://cdn.hungry.sg/${index}.jpg`);
  const photos = buildDishHeroPhotos(dish("https://cdn.hungry.sg/main.jpg", gallery));
  assert.equal(photos.length, 8);
  assert.equal(photos[0], "https://cdn.hungry.sg/main.jpg");
});

test("blocking an author drops all their reviews; a report drops only that one (DISH-19)", () => {
  const reviews = [
    { id: "r1", authorId: "u-bad" },
    { id: "r2", authorId: "u-bad" },
    { id: "r3", authorId: "u-ok" },
    { id: "r4" },
  ] as Review[];
  assert.deepEqual(
    withoutRemovedReview(reviews, "r1", new Set(["u-bad"])).map((review) => review.id),
    ["r3", "r4"],
  );
  assert.deepEqual(
    withoutRemovedReview(reviews, "r3", new Set()).map((review) => review.id),
    ["r1", "r2", "r4"],
  );
});

test("a refreshed first page keeps the older pages already loaded, and drops what left (DISH-V5)", () => {
  const r = (id: string, minute: number) =>
    ({ id, createdAt: new Date(Date.UTC(2026, 9, 20, 12, 60 - minute)).toISOString() }) as Review;
  const shown = { reviews: [r("a", 1), r("b", 2), r("gone", 3), r("c", 4), r("d", 5)], hasMore: true };
  // A new review on top; "gone" was deleted; the fresh page of 4 ends at "c".
  const fresh = [r("new", 0), r("a", 1), r("b", 2), r("c", 4)];
  const merged = mergeRefreshedReviews(shown, fresh, 4);
  assert.deepEqual(
    merged.reviews.map((review) => review.id),
    ["new", "a", "b", "c", "d"],
  );
  assert.equal(merged.hasMore, true);
  // A short fresh page is the whole list; nothing shown for the dish keeps the fresh page.
  assert.deepEqual(mergeRefreshedReviews(shown, [r("a", 1)], 4), {
    reviews: [r("a", 1)],
    hasMore: false,
  });
  assert.deepEqual(mergeRefreshedReviews(null, fresh, 4).reviews, fresh);
});
