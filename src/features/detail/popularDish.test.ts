import assert from "node:assert/strict";
import test from "node:test";

import { isPopularDish, POPULAR_MIN_RATING, POPULAR_MIN_REVIEWS } from "./popularDish";

test("a dish is popular only with enough reviews and a high enough rating", () => {
  assert.equal(
    isPopularDish({ rating: POPULAR_MIN_RATING, reviewCount: POPULAR_MIN_REVIEWS }),
    true,
  );
  assert.equal(isPopularDish({ rating: 4.8, reviewCount: 120 }), true);
});

test("an editorial must-order dish without reviews is not popular", () => {
  assert.equal(isPopularDish({ rating: 5, reviewCount: 0 }), false);
  assert.equal(isPopularDish({ rating: 5, reviewCount: POPULAR_MIN_REVIEWS - 1 }), false);
});

test("many reviews with a low rating are not popular", () => {
  assert.equal(isPopularDish({ rating: 3.9, reviewCount: 200 }), false);
});
