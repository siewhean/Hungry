import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_PROFILE } from "@/constants/taste";
import type { TasteProfile } from "@/types/domain";
import {
  mergeDietaryPreferences,
  ONBOARDING_RECALIBRATION_WEIGHT,
  recalibrateTasteProfile,
} from "./tasteEngine";

function assertClose(actual: number, expected: number, label: string) {
  assert.ok(Math.abs(actual - expected) < 1e-9, `${label}: ${actual} !== ${expected}`);
}

const saved: TasteProfile = {
  vector: { sweet: 9, spicy: 2, sour: 5, salty: 5, rich: 4, aromatic: 6 },
  bitterTolerance: 3,
  fatAffinity: 8,
  textureArchetype: "chewer",
  neophiliaIndex: 2,
  spiceSeeking: 1,
};

const fresh: TasteProfile = {
  vector: { sweet: 4, spicy: 9, sour: 5, salty: 0, rich: 9, aromatic: 6 },
  bitterTolerance: 8,
  fatAffinity: 3,
  textureArchetype: "cruncher",
  neophiliaIndex: 7,
  spiceSeeking: 9,
};

test("recalibration blends every score 0.6 toward the new answers", () => {
  assert.equal(ONBOARDING_RECALIBRATION_WEIGHT, 0.6);
  const result = recalibrateTasteProfile(saved, fresh);
  // saved + 0.6 × (new − saved) = 0.4 × saved + 0.6 × new
  assertClose(result.vector.sweet, 6, "sweet");
  assertClose(result.vector.spicy, 6.2, "spicy");
  assertClose(result.vector.sour, 5, "sour (agreement stays put)");
  assertClose(result.vector.salty, 2, "salty");
  assertClose(result.vector.rich, 7, "rich");
  assertClose(result.bitterTolerance, 6, "bitterTolerance");
  assertClose(result.fatAffinity, 5, "fatAffinity");
  assertClose(result.neophiliaIndex, 5, "neophiliaIndex");
  assertClose(result.spiceSeeking, 5.8, "spiceSeeking");
});

test("the single-choice texture archetype takes the new answer", () => {
  assert.equal(recalibrateTasteProfile(saved, fresh).textureArchetype, "cruncher");
});

test("recalibrated scores are clamped to the 0-10 range", () => {
  const outOfRange: TasteProfile = {
    ...NEUTRAL_TASTE_PROFILE,
    vector: { sweet: 14, spicy: -6, sour: 10, salty: 0, rich: 5, aromatic: 5 },
    spiceSeeking: 20,
    bitterTolerance: -10,
  };
  const result = recalibrateTasteProfile(outOfRange, outOfRange);
  assert.equal(result.vector.sweet, 10);
  assert.equal(result.vector.spicy, 0);
  assert.equal(result.spiceSeeking, 10);
  assert.equal(result.bitterTolerance, 0);
});

test("recalibration does not mutate its inputs", () => {
  const before = JSON.stringify(saved);
  recalibrateTasteProfile(saved, fresh);
  assert.equal(JSON.stringify(saved), before);
});

test("diet restrictions and allergies are unioned and never dropped", () => {
  assert.deepEqual(mergeDietaryPreferences(["nut_free", "halal"], ["vegetarian", "halal"]), [
    "nut_free",
    "halal",
    "vegetarian",
  ]);
  // A saved allergy survives new answers that do not mention it.
  assert.deepEqual(mergeDietaryPreferences(["gluten_free"], []), ["gluten_free"]);
  assert.deepEqual(mergeDietaryPreferences([], ["nut_free"]), ["nut_free"]);
});
