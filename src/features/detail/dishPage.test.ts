import assert from "node:assert/strict";
import test from "node:test";

import { buildDishHeroPhotos, withoutRemovedReview } from "@/features/detail/dishPage";
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
