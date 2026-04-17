import assert from "node:assert/strict";
import test from "node:test";

import { dishes, userProfile } from "../../lib/services/mock/data";
import { sortSearchResults } from "./search";

test("sortSearchResults sorts by price ascending", () => {
  const sorted = sortSearchResults(dishes.slice(0, 4), "price", userProfile.tasteVector);
  assert.deepEqual(
    sorted.map((dish) => dish.id),
    [...dishes.slice(0, 4)].sort((left, right) => left.price - right.price).map((dish) => dish.id),
  );
});

test("sortSearchResults sorts by rating descending", () => {
  const sorted = sortSearchResults(dishes.slice(0, 4), "rating", userProfile.tasteVector);
  assert.deepEqual(
    sorted.map((dish) => dish.id),
    [...dishes.slice(0, 4)]
      .sort((left, right) => right.rating - left.rating)
      .map((dish) => dish.id),
  );
});

test("sortSearchResults sorts by nearest distance", () => {
  const sorted = sortSearchResults(dishes.slice(0, 4), "distance", userProfile.tasteVector);
  assert.deepEqual(
    sorted.map((dish) => dish.id),
    [...dishes.slice(0, 4)]
      .sort((left, right) => left.distanceMeters - right.distanceMeters)
      .map((dish) => dish.id),
  );
});
