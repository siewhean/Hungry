import assert from "node:assert/strict";
import test from "node:test";

import { REVIEW_SEARCH_MIN_LENGTH, reviewMatchesQuery } from "./reviewSearch";

const item = {
  dishName: "Katong Laksa",
  venueName: "328 Katong Laksa Stall",
  review: { text: "Rich coconut broth", tags: ["Spicy", "Creamy"] },
};

test("a review matches on dish, stall, text or taste tag, ignoring case", () => {
  for (const query of ["katong", "STALL", "coconut", "creamy"]) {
    assert.equal(reviewMatchesQuery(item, query), true, query);
  }
  assert.equal(reviewMatchesQuery(item, "chicken"), false);
});

test("an empty query matches everything", () => {
  assert.equal(reviewMatchesQuery(item, "   "), true);
});

test("the server is asked only from two letters", () => {
  assert.equal(REVIEW_SEARCH_MIN_LENGTH, 2);
});
