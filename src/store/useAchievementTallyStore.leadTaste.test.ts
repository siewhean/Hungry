import assert from "node:assert/strict";
import test from "node:test";

import { leadTaste, triedDishFacts } from "./useAchievementTallyStore";

const NEUTRAL = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

test("the lead taste is the strongest one at the threshold, and none for a mild or untagged dish", () => {
  assert.equal(leadTaste({ ...NEUTRAL, spicy: 8, rich: 9 }, true), "rich");
  assert.equal(leadTaste({ ...NEUTRAL, sour: 6 }, true), undefined);
  assert.equal(leadTaste({ ...NEUTRAL, spicy: 9 }, false), undefined);
});

test("tried facts keep the lead taste and the kind of food", () => {
  const facts = triedDishFacts(
    {
      tasteVector: { ...NEUTRAL, sweet: 9 },
      price: 3,
      tasteConfidence: 0.3,
      foodTypeTag: "Dessert",
    },
    true,
  );
  assert.equal(facts.lead, "sweet");
  assert.equal(facts.sweet, true);
  assert.equal(facts.budget, true);
  assert.ok(facts.foodType);
});
