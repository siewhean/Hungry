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
  for (const entry of reviews) {
    const source = dishes.flatMap((d) => d.reviews).find((review) => entry.id === review.id);
    assert.ok(source, "Derived review keeps the canonical report target ID");
    assert.equal(entry.id, source.id);
    assert.equal(entry.avatarUrl, source?.authorAvatarUrl ?? "");
    assert.equal(entry.authorId, source?.authorId);
    assert.equal(entry.role, "Hungry member");
  }
  assert.ok(reviews.every((entry) => entry.role.length > 0));
  assert.ok(reviews.every((entry) => entry.dishName.length > 0));
});
