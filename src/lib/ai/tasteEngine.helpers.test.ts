import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import type { TasteVector } from "@/types/domain";
import {
  averageTasteVectors,
  buildTasteVectorFromQuiz,
  decideForMe,
  hasTrustedTasteProfile,
  rankDishes,
  tasteAxisMatchPercent,
  tasteMatchPercent,
} from "./tasteEngine";

const vector = (patch: Partial<TasteVector>): TasteVector => ({
  ...NEUTRAL_TASTE_VECTOR,
  ...patch,
});

test("a match percent is trusted after the quiz, or after enough positive signals", () => {
  const spicy = vector({ spicy: 9 });
  assert.equal(hasTrustedTasteProfile(NEUTRAL_TASTE_VECTOR, { skippedTasteQuiz: false }), false);
  assert.equal(hasTrustedTasteProfile(spicy, { skippedTasteQuiz: false }), true);
  assert.equal(hasTrustedTasteProfile(spicy, { skippedTasteQuiz: true }), false);
  assert.equal(hasTrustedTasteProfile(spicy, { skippedTasteQuiz: true, signalCount: 5 }), true);
  assert.equal(
    hasTrustedTasteProfile(spicy, {
      skippedTasteQuiz: true,
      signalCount: 6,
      negativeSignalCount: 2,
    }),
    false,
    "turn-downs do not count toward trust",
  );
});

test("dish explanations name up to two matching tastes, else call it a crowd favourite", () => {
  const indifferent = vector({ sweet: 0, spicy: 0, sour: 0, salty: 0, rich: 0, aromatic: 0 });
  const [crowd] = rankDishes(indifferent, [
    { id: "d1", name: "Kaya toast", tasteVector: vector({}) },
  ]);
  assert.equal(crowd?.explanation, "Kaya toast is a crowd favourite.");
  const oneLove = vector({ sweet: 0, spicy: 9, sour: 0, salty: 0, rich: 0, aromatic: 0 });
  assert.equal(
    rankDishes(oneLove, [{ id: "d2", name: "Laksa", tasteVector: vector({ spicy: 9 }) }])[0]
      ?.explanation,
    "Matches your love of heat.",
  );
  assert.match(
    rankDishes(vector({ spicy: 9 }), [
      { id: "d3", name: "Mee", tasteVector: vector({ spicy: 9 }) },
    ])[0]?.explanation ?? "",
    /^Matches your .+ and .+ preferences\.$/,
  );
});

test("decideForMe returns the best dish above the threshold, or nothing", () => {
  const user = vector({ spicy: 10, rich: 9 });
  const dishes = [
    { id: "mild", name: "Porridge", tasteVector: vector({ spicy: 0, rich: 1 }) },
    { id: "hot", name: "Laksa", tasteVector: vector({ spicy: 10, rich: 9 }) },
  ];
  assert.equal(decideForMe(user, dishes)?.dishId, "hot");
  assert.equal(decideForMe(user, dishes, 1.01), null);
  assert.equal(decideForMe(user, []), null);
});

test("vector helpers clamp, average and fall back", () => {
  assert.deepEqual(averageTasteVectors([], NEUTRAL_TASTE_VECTOR), NEUTRAL_TASTE_VECTOR);
  assert.equal(
    averageTasteVectors([vector({ spicy: 10 }), vector({ spicy: 0 })], NEUTRAL_TASTE_VECTOR).spicy,
    5,
  );
  assert.deepEqual(
    buildTasteVectorFromQuiz({ spicy: 14, sweet: -3 }),
    vector({ spicy: 10, sweet: 0 }),
  );
  assert.equal(tasteAxisMatchPercent(5, 5), 100);
  assert.equal(tasteAxisMatchPercent(0, 10), 0);
  assert.equal(
    tasteMatchPercent(NEUTRAL_TASTE_VECTOR, vector({ spicy: 9 })),
    87,
    "a neutral diner weighs every axis equally",
  );
  assert.equal(tasteMatchPercent(vector({ spicy: 9 }), vector({ spicy: 9 })), 100);
  assert.equal(
    tasteMatchPercent(vector({ spicy: 9 }), vector({ spicy: 1 })),
    50,
    "missing the one axis they care about costs half the score",
  );
});

test("MD-D1 the overall match lies between the worst and best axis match", () => {
  const user = vector({ sweet: 6, spicy: 6, sour: 6, salty: 6, rich: 6, aromatic: 6 });
  const dish = vector({ sweet: 9, spicy: 9, sour: 8, salty: 7, rich: 9, aromatic: 8 });
  const overall = tasteMatchPercent(user, dish);
  const axes = (["sweet", "spicy", "sour", "salty", "rich", "aromatic"] as const).map((axis) =>
    tasteAxisMatchPercent(user[axis], dish[axis]),
  );
  assert.ok(overall <= Math.max(...axes) && overall >= Math.min(...axes), `${overall} vs ${axes}`);
  assert.ok(overall < 100, "a dish with more of everything is not a 100% match");
});

test("MD-D1 a bland dish scores low for a diner who cares about heat and richness", () => {
  assert.ok(tasteMatchPercent(vector({ spicy: 10, rich: 9 }), NEUTRAL_TASTE_VECTOR) < 40);
});
