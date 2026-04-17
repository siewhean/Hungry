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

test("deriveStallCommunityReviews flattens dish reviews with deterministic metadata", () => {
  const reviews = deriveStallCommunityReviews(dishes.slice(0, 2));

  assert.ok(reviews.length > 0);
  assert.ok(reviews.every((entry) => entry.avatarUrl.startsWith("https://images.unsplash.com/")));
  assert.ok(reviews.every((entry) => entry.role.length > 0));
  assert.ok(reviews.every((entry) => entry.dishName.length > 0));
});
