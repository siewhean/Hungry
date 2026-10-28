import assert from "node:assert/strict";
import test from "node:test";

import { TASTE_DIMENSIONS } from "@/constants/taste";
import { describeTasteVector, tasteLevelLabel } from "./tasteFingerprint";

test("taste levels: 7 and up is High, 3 and under is Low, the rest Medium", () => {
  assert.equal(tasteLevelLabel(10), "High");
  assert.equal(tasteLevelLabel(7), "High");
  assert.equal(tasteLevelLabel(6.9), "Medium");
  assert.equal(tasteLevelLabel(4), "Medium");
  assert.equal(tasteLevelLabel(3), "Low");
  assert.equal(tasteLevelLabel(0), "Low");
});

test("the spoken radar summary lists every axis in TASTE_DIMENSIONS order, no percentages", () => {
  const vector = { sweet: 2, spicy: 9, sour: 5, salty: 5, rich: 8, aromatic: 7 } as never;
  const spoken = describeTasteVector(vector);
  assert.match(spoken, /^Taste: /);
  let last = -1;
  for (const { label } of TASTE_DIMENSIONS) {
    const index = spoken.indexOf(label);
    assert.ok(index > last, `${label} is in order`);
    last = index;
  }
  assert.ok(spoken.includes("Spicy high"));
  assert.ok(spoken.includes("Sweet low"));
  assert.equal(spoken.includes("%"), false);
});
