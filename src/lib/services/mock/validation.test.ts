import assert from "node:assert/strict";
import test from "node:test";

import {
  buildings,
  blogPosts,
  dishes,
  guestProfile,
  stallPosts,
  userProfile,
  venues,
} from "./data";
import { validateFixtureBundle } from "./validation";

test("validateFixtureBundle passes for default fixtures", () => {
  const result = validateFixtureBundle();
  assert.equal(result.valid, true);
  assert.equal(result.issues.length, 0);
});

test("validateFixtureBundle catches broken venue references", () => {
  const result = validateFixtureBundle({
    buildings,
    venues: [{ ...venues[0], buildingId: "building-missing" }, ...venues.slice(1)],
    dishes,
    stallPosts,
    blogPosts,
    userProfile,
    guestProfile,
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "BROKEN_BUILDING_REF"));
});

test("validateFixtureBundle catches taste-vector range violations", () => {
  const result = validateFixtureBundle({
    buildings,
    venues,
    dishes: [
      {
        ...dishes[0],
        tasteVector: {
          ...dishes[0].tasteVector,
          spicy: 12,
        },
      },
      ...dishes.slice(1),
    ],
    stallPosts,
    blogPosts,
    userProfile,
    guestProfile,
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "INVALID_TASTE_VECTOR"));
});

test("validateFixtureBundle can enforce strict top-dish references", () => {
  const result = validateFixtureBundle(
    {
      buildings,
      venues,
      dishes,
      stallPosts,
      blogPosts,
      userProfile,
      guestProfile,
    },
    { strictTopDishRefs: true },
  );

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "BROKEN_TOP_DISH_REF"));
});
