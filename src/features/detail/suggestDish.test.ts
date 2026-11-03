import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDishSuggestionNote,
  dishSuggestionProblem,
  parseSuggestedPrice,
} from "@/features/detail/suggestDish";

test("prices parse with or without S$ and reject anything else", () => {
  assert.equal(parseSuggestedPrice("4.5"), 4.5);
  assert.equal(parseSuggestedPrice("S$4.50"), 4.5);
  assert.equal(parseSuggestedPrice(" $ 12 "), 12);
  assert.equal(parseSuggestedPrice("free"), null);
  assert.equal(parseSuggestedPrice("0"), null);
  assert.equal(parseSuggestedPrice("4.555"), null);
  assert.equal(parseSuggestedPrice("1000"), null);
});

test("a dish needs a name; the price is optional but must be a number", () => {
  assert.match(dishSuggestionProblem({ name: "  ", price: "", details: "" }) ?? "", /dish name/);
  assert.equal(dishSuggestionProblem({ name: "Laksa", price: "", details: "" }), null);
  assert.match(dishSuggestionProblem({ name: "Laksa", price: "abc", details: "" }) ?? "", /price/);
  assert.equal(dishSuggestionProblem({ name: "Laksa", price: "S$5", details: "" }), null);
});

test("the note starts New dish and joins name, price and details", () => {
  assert.equal(
    buildDishSuggestionNote({ name: "  Chicken   rice ", price: "4.5", details: "Half or whole" }),
    "New dish: Chicken rice · S$4.50 · Half or whole",
  );
  assert.equal(
    buildDishSuggestionNote({ name: "Laksa", price: "", details: "" }),
    "New dish: Laksa",
  );
});

test("the note stays within the 500 characters the server keeps", () => {
  const note = buildDishSuggestionNote({ name: "Laksa", price: "", details: "x".repeat(900) });
  assert.ok(note.length <= 500);
});
