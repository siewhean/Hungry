import assert from "node:assert/strict";
import test from "node:test";

import { likelyMatchDishIds } from "./menuPalate";

const spicy = { sweet: 2, spicy: 9, sour: 4, salty: 6, rich: 6, aromatic: 7 };
const sweet = { sweet: 9, spicy: 1, sour: 3, salty: 3, rich: 5, aromatic: 4 };
const neutral = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

test("dishes close to a trusted palate are likely a match, estimates included, unknowns never", () => {
  const dishes = [
    { id: "laksa", tasteVector: spicy, tasteConfidence: 0.9 },
    { id: "chendol", tasteVector: sweet, tasteConfidence: 0.9 },
    { id: "guess", tasteVector: spicy, tasteConfidence: 0.3 },
    { id: "placeholder", tasteVector: spicy, tasteConfidence: 0 },
    { id: "unknown", tasteVector: neutral },
  ];
  // "Likely a match" is a reason, not a percentage, so the workbook estimate may earn it.
  assert.deepEqual([...likelyMatchDishIds(dishes, spicy)], ["laksa", "guess"]);
  assert.equal(likelyMatchDishIds(dishes, null).size, 0, "no palate, no tags");
});
