import assert from "node:assert/strict";
import test from "node:test";

import { suggestAllergensFromIngredients } from "./allergenKeywords";

test("allergen keyword check matches whole words only", () => {
  assert.deepEqual(suggestAllergensFromIngredients(["eggplant", "rice noodles"]), []);
  assert.deepEqual(suggestAllergensFromIngredients(["Egg noodles", "dark soy sauce"]), [
    "Eggs",
    "Soy",
    "Gluten",
  ]);
  assert.deepEqual(suggestAllergensFromIngredients(["tiger prawns", "sesame oil"]), [
    "Sesame",
    "Shellfish",
  ]);
});
