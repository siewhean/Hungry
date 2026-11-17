import assert from "node:assert/strict";
import test from "node:test";

import type { TasteVector } from "@/types/domain";
import {
  blendedMatchScore,
  buildTasteVectorFromQuiz,
  calibrateVector,
  cosineSimilarity,
  decideForMe,
  dotProduct,
  euclideanDistance,
  magnitude,
  rankDishes,
} from "./tasteEngine";

const USER_VECTOR: TasteVector = {
  sweet: 8,
  spicy: 7,
  sour: 3,
  salty: 6,
  rich: 5,
  aromatic: 9,
};

test("tasteEngine: vector primitives return deterministic math results", () => {
  const a: TasteVector = {
    sweet: 1,
    spicy: 2,
    sour: 3,
    salty: 4,
    rich: 5,
    aromatic: 6,
  };
  const b: TasteVector = {
    sweet: 6,
    spicy: 5,
    sour: 4,
    salty: 3,
    rich: 2,
    aromatic: 1,
  };

  assert.equal(dotProduct(a, b), 56);
  assert.equal(magnitude(a), Math.sqrt(91));
  assert.equal(euclideanDistance(a, a), 0);
});

test("tasteEngine: cosine similarity handles identical and zero vectors", () => {
  const zero: TasteVector = {
    sweet: 0,
    spicy: 0,
    sour: 0,
    salty: 0,
    rich: 0,
    aromatic: 0,
  };

  const same = cosineSimilarity(USER_VECTOR, USER_VECTOR);
  const zeroCase = cosineSimilarity(USER_VECTOR, zero);

  assert.ok(same > 0.999999);
  assert.equal(zeroCase, 0);
});

test("tasteEngine: blended score prefers close dishes", () => {
  const close: TasteVector = { ...USER_VECTOR, sweet: 7, aromatic: 8 };
  const far: TasteVector = {
    sweet: 0,
    spicy: 0,
    sour: 10,
    salty: 0,
    rich: 10,
    aromatic: 0,
  };

  const closeScore = blendedMatchScore(USER_VECTOR, close);
  const farScore = blendedMatchScore(USER_VECTOR, far);

  assert.ok(closeScore > farScore);
  assert.ok(closeScore >= 0 && closeScore <= 1);
  assert.ok(farScore >= 0 && farScore <= 1);
});

test("tasteEngine: rankDishes sorts descending and decideForMe respects threshold", () => {
  const dishes = [
    { id: "dish-close", name: "Close", tasteVector: { ...USER_VECTOR } },
    {
      id: "dish-mid",
      name: "Mid",
      tasteVector: { ...USER_VECTOR, sweet: 5, spicy: 5, aromatic: 5 },
    },
    {
      id: "dish-far",
      name: "Far",
      tasteVector: { sweet: 0, spicy: 0, sour: 10, salty: 0, rich: 10, aromatic: 0 },
    },
  ];

  const ranked = rankDishes(USER_VECTOR, dishes);
  assert.equal(ranked.length, 3);
  assert.equal(ranked[0]?.dishId, "dish-close");
  assert.ok((ranked[0]?.score ?? 0) >= (ranked[1]?.score ?? 0));
  assert.ok((ranked[1]?.score ?? 0) >= (ranked[2]?.score ?? 0));
  assert.ok((ranked[0]?.explanation.length ?? 0) > 0);

  const picked = decideForMe(USER_VECTOR, dishes, 0.2);
  assert.equal(picked?.dishId, "dish-close");

  const noPick = decideForMe(USER_VECTOR, dishes, 1.1);
  assert.equal(noPick, null);
});

test("tasteEngine: calibration and quiz builder clamp values into 0-10", () => {
  const current: TasteVector = {
    sweet: 9.9,
    spicy: 0.2,
    sour: 5,
    salty: 5,
    rich: 5,
    aromatic: 5,
  };

  const impression: TasteVector = {
    sweet: 20,
    spicy: -10,
    sour: 8,
    salty: 7,
    rich: 6,
    aromatic: 4,
  };

  const calibrated = calibrateVector(current, impression, 0.5);
  assert.ok(calibrated.sweet <= 10);
  assert.ok(calibrated.spicy >= 0);

  const quizVector = buildTasteVectorFromQuiz({
    sweet: 11,
    spicy: -1,
    sour: 3,
  });
  assert.deepEqual(quizVector, {
    sweet: 10,
    spicy: 0,
    sour: 3,
    salty: 5,
    rich: 5,
    aromatic: 5,
  });
});
