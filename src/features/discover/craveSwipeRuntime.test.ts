import assert from "node:assert/strict";
import test from "node:test";

import { saveCurrentCraveDish } from "./craveSwipeRuntime";

test("Crave save behavior ignores the loading frame then saves the asynchronously loaded dish", () => {
  const savedDishIds: string[] = [];
  const saveDish = (dish: { id: string }) => savedDishIds.push(dish.id);

  assert.equal(saveCurrentCraveDish(undefined, saveDish), false);
  assert.deepEqual(savedDishIds, []);

  assert.equal(saveCurrentCraveDish({ id: "dish-loaded-after-request" }, saveDish), true);
  assert.deepEqual(savedDishIds, ["dish-loaded-after-request"]);
});

test("Crave save behavior always applies the dish from the current swipe", () => {
  const savedDishIds: string[] = [];
  const saveDish = (dish: { id: string }) => savedDishIds.push(dish.id);

  saveCurrentCraveDish({ id: "dish-a" }, saveDish);
  saveCurrentCraveDish({ id: "dish-b" }, saveDish);

  assert.deepEqual(savedDishIds, ["dish-a", "dish-b"]);
});
