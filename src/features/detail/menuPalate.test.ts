import assert from "node:assert/strict";
import test from "node:test";

import { likelyMatchDishIds } from "./menuPalate";

const spicy = { sweet: 2, spicy: 9, sour: 4, salty: 6, rich: 6, aromatic: 7 };
const sweet = { sweet: 9, spicy: 1, sour: 3, salty: 3, rich: 5, aromatic: 4 };
const neutral = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

test("only dishes close to a trusted palate, with a confident taste, are likely a match", () => {
  const dishes = [
    { id: "laksa", tasteVector: spicy, tasteConfidence: 0.9 },
    { id: "chendol", tasteVector: sweet, tasteConfidence: 0.9 },
    { id: "guess", tasteVector: spicy, tasteConfidence: 0.3 },
    { id: "unknown", tasteVector: neutral },
  ];
  assert.deepEqual([...likelyMatchDishIds(dishes, spicy)], ["laksa"]);
  assert.equal(likelyMatchDishIds(dishes, null).size, 0, "no palate, no tags");
});
