import assert from "node:assert/strict";
import test from "node:test";

import {
  canShowTastePercent,
  tasteTrust,
  tasteWeight,
  VERIFIED_TASTE_CONFIDENCE,
} from "@/lib/ai/tasteTrust";
import { processExplicitFeedback } from "@/lib/ai/tasteEngine";
import { decideTasteScore } from "@/features/discovery/decideForMeCandidates";
import type { TasteVector } from "@/types/domain";

const spicy: TasteVector = { sweet: 2, spicy: 9, sour: 3, salty: 6, rich: 7, aromatic: 8 };
const sweet: TasteVector = { sweet: 9, spicy: 0, sour: 2, salty: 2, rich: 6, aromatic: 4 };
const neutral: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

test("verified at the AI tagger's apply cut-off, estimated below it, unknown at zero or neutral", () => {
  assert.equal(tasteTrust({ tasteVector: spicy, tasteConfidence: 0.9 }), "verified");
  assert.equal(
    tasteTrust({ tasteVector: spicy, tasteConfidence: VERIFIED_TASTE_CONFIDENCE }),
    "verified",
  );
  assert.equal(
    tasteTrust({ tasteVector: spicy }),
    "verified",
    "no confidence recorded counts as trusted",
  );
  assert.equal(tasteTrust({ tasteVector: spicy, tasteConfidence: 0.3 }), "estimated");
  assert.equal(tasteTrust({ tasteVector: spicy, tasteConfidence: 0 }), "unknown");
  assert.equal(tasteTrust({ tasteVector: neutral, tasteConfidence: 0.9 }), "unknown");
});

test("weight is full for verified, the confidence for an estimate, zero for unknown", () => {
  assert.equal(tasteWeight({ tasteVector: spicy, tasteConfidence: 0.75 }), 1);
  assert.equal(tasteWeight({ tasteVector: spicy, tasteConfidence: 0.3 }), 0.3);
  assert.equal(tasteWeight({ tasteVector: neutral, tasteConfidence: 0.3 }), 0);
});

test("a percentage is shown only for verified tags", () => {
  assert.equal(canShowTastePercent({ tasteVector: spicy, tasteConfidence: 0.9 }), true);
  assert.equal(canShowTastePercent({ tasteVector: spicy, tasteConfidence: 0.3 }), false);
});

test("an estimated dish teaches the palate less than a verified one", () => {
  const start = sweet;
  const event = { type: "dish_like" as const, dishVector: spicy };
  const verified = processExplicitFeedback(start, { ...event, dishConfidence: 0.9 });
  const estimated = processExplicitFeedback(start, { ...event, dishConfidence: 0.3 });
  assert.ok(verified.spicy - start.spicy > estimated.spicy - start.spicy);
  assert.ok(estimated.spicy > start.spicy, "an estimate still teaches something");
});

test("Decide scores an estimate between its match and the middle, an unknown by rating", () => {
  const base = { rating: 0, reviewCount: 0 };
  const verified = decideTasteScore(spicy, { ...base, tasteVector: spicy, tasteConfidence: 0.9 });
  const estimated = decideTasteScore(spicy, { ...base, tasteVector: spicy, tasteConfidence: 0.3 });
  const unknown = decideTasteScore(spicy, { ...base, tasteVector: neutral, tasteConfidence: 0 });
  assert.ok(verified > estimated && estimated > unknown);
  assert.equal(unknown, 50);
  assert.equal(
    decideTasteScore(spicy, {
      rating: 4.5,
      reviewCount: 3,
      tasteVector: neutral,
      tasteConfidence: 0,
    }),
    90,
  );
});
