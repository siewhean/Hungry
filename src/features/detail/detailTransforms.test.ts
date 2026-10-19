import assert from "node:assert/strict";
import test from "node:test";

import { dishes } from "../../lib/services/mock/data";
import { buildDishGallery, deriveStallCommunityReviews } from "./detailTransforms";

test("buildDishGallery keeps hero first and removes duplicate URLs", () => {
  const dish = {
    ...dishes[0],
    imageUrl: "https://example.com/hero.jpg",
    gallery: [
      "https://example.com/alt-1.jpg",
      "https://example.com/hero.jpg",
      "https://example.com/alt-2.jpg",
    ],
  };

  assert.deepEqual(buildDishGallery(dish), [
    "https://example.com/hero.jpg",
    "https://example.com/alt-1.jpg",
    "https://example.com/alt-2.jpg",
  ]);
});

test("deriveStallCommunityReviews keeps the newest reviews across dishes and names each dish", () => {
  const entries = dishes.slice(0, 3).flatMap((dish) =>
    dish.reviews.map((review) => ({
      review,
      dishId: dish.id,
      dishName: dish.name,
      venueId: dish.venueId,
      venueName: dish.venueName,
    })),
  );
  const reviews = deriveStallCommunityReviews(entries, 4);

  assert.ok(reviews.length > 0);
  assert.ok(reviews.length <= 4);
  for (let index = 1; index < reviews.length; index += 1) {
    assert.ok(
      new Date(reviews[index - 1].createdAt).getTime() >=
        new Date(reviews[index].createdAt).getTime(),
    );
  }
  assert.ok(reviews.every((entry) => entry.dishName.length > 0));
});

test("deriveStallCommunityReviews never invents an avatar or a reviewer role", () => {
  const [dish] = dishes;
  const review = { ...dish.reviews[0], authorAvatarUrl: undefined };
  const [entry] = deriveStallCommunityReviews([
    { review, dishId: dish.id, dishName: dish.name, venueId: dish.venueId, venueName: "" },
  ]);

  assert.equal(entry.avatarUrl, undefined);
  assert.equal("role" in entry, false);
});
