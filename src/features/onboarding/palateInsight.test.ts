import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  SENSITIVE_DINER,
  TOLERANT_DINER,
  laksaFeltBy,
  palateExample,
  summarisePalate,
} from "./palateInsight";

test("the same laksa feels 9 to Mei and 4.5 to Raj", () => {
  assert.equal(laksaFeltBy(SENSITIVE_DINER.level), 9);
  assert.equal(laksaFeltBy(5), 6);
  assert.equal(laksaFeltBy(TOLERANT_DINER.level), 4.5);
});

test("the headline names the two strongest leanings among the answered tastes", () => {
  const vector = { ...NEUTRAL_TASTE_VECTOR, sweet: 10, spicy: 0, rich: 7.5 };
  const summary = summarisePalate(vector, ["sweet", "spicy", "rich"]);
  assert.equal(summary.headline, "Sweet tooth, spice shy");
  assert.deepEqual(summary.notSet, ["sour", "salty", "aromatic"]);
});

test("a skipped taste never shapes the headline, even when its value is off average", () => {
  const vector = { ...NEUTRAL_TASTE_VECTOR, sweet: 10, spicy: 0 };
  assert.equal(summarisePalate(vector, ["spicy"]).headline, "Spice shy");
});

test("all average answers read as balanced, and no answers give no headline", () => {
  assert.equal(
    summarisePalate(NEUTRAL_TASTE_VECTOR, ["sweet", "spicy"]).headline,
    "Balanced across the board",
  );
  const none = summarisePalate(NEUTRAL_TASTE_VECTOR, []);
  assert.equal(none.headline, null);
  assert.equal(none.notSet.length, 6);
});

test("the example uses the person's strongest taste and their own number", () => {
  assert.equal(
    palateExample({ ...NEUTRAL_TASTE_VECTOR, spicy: 0 }, ["spicy"]),
    "A standard laksa will taste 10/10 spicy to you.",
  );
  assert.equal(
    palateExample({ ...NEUTRAL_TASTE_VECTOR, spicy: 7.5, sweet: 5 }, ["sweet", "spicy"]),
    "A standard laksa will taste 4.5/10 spicy to you.",
  );
  assert.equal(palateExample(NEUTRAL_TASTE_VECTOR, []), null);
});
