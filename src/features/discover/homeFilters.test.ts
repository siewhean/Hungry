import assert from "node:assert/strict";
import test from "node:test";

import { getDietaryChipLabel, HOME_CHEAP_PRICE_LIMIT } from "./homeFilters";

test("the dietary chip says 'Dietary needs' until some are saved", () => {
  assert.equal(getDietaryChipLabel([]), "Dietary needs");
});

test("saved needs name the chip, halal and vegetarian first, with a count for the rest", () => {
  assert.equal(getDietaryChipLabel(["halal"]), "Halal");
  assert.equal(getDietaryChipLabel(["vegetarian", "halal"]), "Halal · Vegetarian");
  assert.equal(getDietaryChipLabel(["nut_free", "vegan", "halal", "kosher"]), "Halal · Vegan +2");
});

test("the Under S$5 chip limit is five dollars", () => {
  assert.equal(HOME_CHEAP_PRICE_LIMIT, 5);
});
