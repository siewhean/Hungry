import assert from "node:assert/strict";
import test from "node:test";

import {
  BUDGET_OPTIONS,
  DIETARY_OPTIONS,
  POPULAR_DIETARY_FLAGS,
  SORTED_DIETARY_OPTIONS,
  filterDietaryOptions,
} from "@/app/screens/onboarding/dietaryOptions";

test("the nine popular diets are what shows before More, in order", () => {
  const shown = filterDietaryOptions("", []).map((option) => option.value);
  assert.deepEqual(shown, POPULAR_DIETARY_FLAGS);
  assert.equal(POPULAR_DIETARY_FLAGS.length, 9);
});

test("a diet chosen from the long list stays in view", () => {
  const shown = filterDietaryOptions("", ["keto"]).map((option) => option.value);
  assert.ok(shown.includes("keto"));
  assert.equal(shown.length, POPULAR_DIETARY_FLAGS.length + 1);
});

test("search matches the label and the keywords across every diet", () => {
  assert.deepEqual(
    filterDietaryOptions("peanut", []).map((option) => option.value),
    ["nut_free", "peanut_free"],
  );
  assert.deepEqual(
    filterDietaryOptions("MUSLIM", []).map((option) => option.value),
    ["halal"],
  );
  assert.deepEqual(filterDietaryOptions("zzz", []), []);
});

test("every diet is listed once, popular first", () => {
  assert.equal(new Set(SORTED_DIETARY_OPTIONS.map((o) => o.value)).size, DIETARY_OPTIONS.length);
  assert.deepEqual(
    SORTED_DIETARY_OPTIONS.slice(0, POPULAR_DIETARY_FLAGS.length).map((o) => o.value),
    POPULAR_DIETARY_FLAGS,
  );
});

test("the budget chips say S$ and end with Any price", () => {
  assert.deepEqual(
    BUDGET_OPTIONS.map((option) => [option.label, option.value]),
    [
      ["Under S$6", 6],
      ["Under S$12", 12],
      ["Any price", undefined],
    ],
  );
});
