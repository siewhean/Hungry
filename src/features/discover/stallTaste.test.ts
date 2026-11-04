import assert from "node:assert/strict";
import test from "node:test";

import { STALL_LEAN_CONFIDENCE, stallTasteLean, stallText } from "./stallTaste";

test("a Thai stall leans spicy, sour and fragrant from its name or its cuisine tag", () => {
  const byName = stallTasteLean("#87 Just Thai");
  const byTag = stallTasteLean("Ah Seng Kitchen", ["thai"]);
  for (const lean of [byName, byTag]) {
    assert.ok(lean);
    assert.ok(lean.spicy > 5 && lean.sour > 5 && lean.aromatic > 5);
    assert.equal(lean.sweet, 5);
  }
});

test("a bakery or dessert stall leans sweet; a salad bar leans light", () => {
  assert.ok((stallTasteLean("Tiong Bahru Bakery")?.sweet ?? 0) >= 8);
  assert.ok((stallTasteLean("Corner", ["ice_cream"])?.sweet ?? 0) >= 8);
  assert.ok((stallTasteLean("Green Bowl Salad")?.rich ?? 9) < 5);
});

test("cues add up but stay inside the 1 to 9 scale", () => {
  const lean = stallTasteLean("Mala Sichuan Chilli Spicy Hotpot");
  assert.ok(lean);
  assert.equal(lean.spicy, 9);
  const mild = stallTasteLean("Porridge and Fish Soup", ["vegetarian"]);
  assert.ok(mild && mild.rich >= 1 && mild.spicy >= 1);
});

test("a stall whose name and tags say nothing about taste stays unknown", () => {
  assert.equal(stallTasteLean("Stall 12"), undefined);
  assert.equal(stallTasteLean("Kopitiam 88", ["asian"]), undefined);
});

test("a word inside another word is not a cue", () => {
  // "pho" inside "Phoenix", "cake" inside "Cakery Lane" is fine as a word boundary miss.
  assert.equal(stallTasteLean("Phoenix Trading"), undefined);
});

test("cuisine tags read as words, and the lean's trust is too low to show a match", () => {
  assert.equal(stallText("Joe", ["coffee_shop", "steak-house"]), "joe coffee shop steak house");
  assert.ok(STALL_LEAN_CONFIDENCE < 0.7);
});
