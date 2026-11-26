import assert from "node:assert/strict";
import test from "node:test";

import {
  describeDietaryNeeds,
  getDietaryChipA11yLabel,
  getDietaryChipLabel,
  HOME_CHEAP_PRICE_LIMIT,
} from "./homeFilters";

test("the dietary chip always says 'Dietary needs', never a saved need such as Beef free", () => {
  assert.equal(getDietaryChipLabel([]), "Dietary needs");
  assert.equal(getDietaryChipLabel(["beef_free"]), "Dietary needs");
  assert.equal(getDietaryChipLabel(["halal", "vegetarian"]), "Dietary needs");
});

test("a screen reader hears what the dietary chip is applying", () => {
  assert.equal(getDietaryChipA11yLabel([]), "Dietary needs");
  assert.equal(getDietaryChipA11yLabel(["beef_free"]), "Dietary needs: Beef free");
});

test("saved needs read in words, halal and vegetarian first, with a count for the rest", () => {
  assert.equal(describeDietaryNeeds(["halal"]), "Halal");
  assert.equal(describeDietaryNeeds(["vegetarian", "halal"]), "Halal · Vegetarian");
  assert.equal(describeDietaryNeeds(["nut_free", "vegan", "halal", "kosher"]), "Halal · Vegan +2");
});

test("the Under S$5 chip limit is five dollars", () => {
  assert.equal(HOME_CHEAP_PRICE_LIMIT, 5);
});
