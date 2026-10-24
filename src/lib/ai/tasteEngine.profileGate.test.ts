import assert from "node:assert/strict";
import test from "node:test";

import type { TasteVector } from "@/types/domain";
import {
  hasPersonalTasteProfile,
  hasTrustedTasteProfile,
  MIN_LEARNED_TASTE_SIGNALS,
  processExplicitFeedback,
  tasteMatchPercent,
} from "./tasteEngine";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
const DISH: TasteVector = { sweet: 8, spicy: 2, sour: 3, salty: 6, rich: 7, aromatic: 4 };

test("one click from a neutral vector does not count as a taste profile for a quiz skipper", () => {
  const drifted = processExplicitFeedback(NEUTRAL, {
    type: "dish_result_click",
    dishVector: DISH,
    dishConfidence: 1,
    timestamp: Date.now(),
  });
  // The old check flips on any drift, and the match then reads as near-perfect.
  assert.equal(hasPersonalTasteProfile(drifted), true);
  assert.ok(tasteMatchPercent(drifted, DISH) >= 90);

  assert.equal(hasTrustedTasteProfile(drifted, { skippedTasteQuiz: true, signalCount: 1 }), false);
  assert.equal(
    hasTrustedTasteProfile(drifted, {
      skippedTasteQuiz: true,
      signalCount: MIN_LEARNED_TASTE_SIGNALS,
    }),
    true,
    "enough learned signals make it a profile",
  );
});

test("a quiz taker has a profile, and a neutral vector never does", () => {
  assert.equal(hasTrustedTasteProfile(DISH, { skippedTasteQuiz: false }), true);
  assert.equal(hasTrustedTasteProfile(NEUTRAL, { skippedTasteQuiz: false }), false);
  assert.equal(hasTrustedTasteProfile(NEUTRAL, { skippedTasteQuiz: true, signalCount: 50 }), false);
});
