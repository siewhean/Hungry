import assert from "node:assert/strict";
import test from "node:test";

import {
  CUISINE_OPTIONS,
  MAX_CUISINES,
  getCuisineChoices,
  toggleCuisine,
} from "@/features/merchant/cuisineOptions";

test("cuisine choices list the catalog options, then any saved label that is not one", () => {
  assert.deepEqual(getCuisineChoices(["Chinese"]), [...CUISINE_OPTIONS]);
  const choices = getCuisineChoices(["Chinese", "Hainanese"]);
  assert.equal(choices.length, CUISINE_OPTIONS.length + 1);
  assert.equal(choices.at(-1), "Hainanese");
});

test("toggleCuisine adds, removes and stops at the cap", () => {
  assert.deepEqual(toggleCuisine([], "Malay"), ["Malay"]);
  assert.deepEqual(toggleCuisine(["Malay", "Thai"], "Malay"), ["Thai"]);
  const full = ["Malay", "Thai", "Korean"];
  assert.equal(full.length, MAX_CUISINES);
  assert.deepEqual(toggleCuisine(full, "Western"), full);
  assert.deepEqual(toggleCuisine(full, "Thai"), ["Malay", "Korean"]);
});

test("a stall saved with more than the cap can still trim down", () => {
  const over = ["Malay", "Thai", "Korean", "Western"];
  assert.deepEqual(toggleCuisine(over, "Western"), ["Malay", "Thai", "Korean"]);
  assert.deepEqual(toggleCuisine(over, "Indian"), over);
});
