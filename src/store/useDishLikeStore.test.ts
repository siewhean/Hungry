import assert from "node:assert/strict";
import test from "node:test";

import { useDishLikeStore } from "./useDishLikeStore";

test("liking toggles per user and never leaks to another account", () => {
  const store = useDishLikeStore.getState();
  assert.equal(store.isLiked("user-a", "dish-1"), false);
  assert.equal(store.toggleLike("user-a", "dish-1"), true);
  assert.equal(useDishLikeStore.getState().isLiked("user-a", "dish-1"), true);
  assert.equal(useDishLikeStore.getState().isLiked("user-b", "dish-1"), false);
  assert.equal(useDishLikeStore.getState().toggleLike("user-a", "dish-1"), false);
  assert.equal(useDishLikeStore.getState().isLiked("user-a", "dish-1"), false);
});
