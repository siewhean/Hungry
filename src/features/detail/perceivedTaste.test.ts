import assert from "node:assert/strict";
import test from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  palateSummary,
  perceivedTasteAxes,
  perceivedDirection,
  perceivedTasteLevel,
  perceivedTasteRows,
  perceivedTasteSentence,
} from "./perceivedTaste";

test("a neutral diner feels the standard level", () => {
  assert.equal(perceivedTasteLevel(5, 5), 5);
  assert.equal(perceivedTasteLevel(5, undefined), 5);
});

test("a diner who is sensitive to sweet feels a 50% drink as 100% and one who loves it feels less", () => {
  assert.equal(perceivedTasteLevel(5, 0), 10);
  assert.equal(perceivedTasteLevel(5, 10), 2.5);
  assert.ok(perceivedTasteLevel(5, 8) < 5);
  assert.ok(perceivedTasteLevel(5, 2) > 5);
});

test("the perceived level stays on the 0-10 scale", () => {
  assert.equal(perceivedTasteLevel(9, 0), 10);
  assert.equal(perceivedTasteLevel(0, 0), 0);
  assert.equal(perceivedTasteLevel(5, 99), 2.5);
  assert.equal(perceivedTasteLevel(5, -4), 10);
});

test("direction ignores small differences", () => {
  assert.equal(perceivedDirection(5, 5.4), "same");
  assert.equal(perceivedDirection(5, 7), "stronger");
  assert.equal(perceivedDirection(5, 3), "milder");
});

test("rows list only the axes a dish is strong on, strongest for this diner first", () => {
  const dish = {
    ...NEUTRAL_TASTE_VECTOR,
    spicy: 8,
    sweet: 1,
    sour: 0,
    salty: 1,
    rich: 3,
    aromatic: 1,
  };
  const diner = { ...NEUTRAL_TASTE_VECTOR, spicy: 1 };
  const rows = perceivedTasteRows(dish, diner);
  assert.equal(rows[0]?.key, "spicy");
  assert.equal(rows[0]?.perceived, 10);
  assert.equal(rows[0]?.direction, "stronger");
  assert.ok(rows.every((row) => row.standard >= 2 || row.perceived >= 2));
  assert.ok(rows.length <= 4);
});

test("an untagged dish has no rows and a missing diner vector falls back to neutral", () => {
  assert.deepEqual(perceivedTasteRows(undefined, NEUTRAL_TASTE_VECTOR), []);
  const rows = perceivedTasteRows({ ...NEUTRAL_TASTE_VECTOR, spicy: 6 }, undefined);
  assert.equal(rows.find((row) => row.key === "spicy")?.perceived, 6);
});

test("the sentence names the axis and the direction", () => {
  const sentence = perceivedTasteSentence({
    key: "spicy",
    label: "Spicy",
    standard: 5,
    perceived: 9,
    direction: "stronger",
  });
  assert.match(sentence, /more spicy to you/);
});

test("palate summary splits strong likes from mild ones", () => {
  const summary = palateSummary({ ...NEUTRAL_TASTE_VECTOR, spicy: 9, sweet: 2, rich: 8 });
  assert.deepEqual(summary.loves, ["Spicy", "Rich"]);
  assert.deepEqual(summary.mild, ["Sweet"]);
  assert.deepEqual(palateSummary(undefined), { loves: [], mild: [] });
});

test("radar axes cover every taste and add the diner's level only with a palette", () => {
  const dish = { ...NEUTRAL_TASTE_VECTOR, spicy: 8, sweet: 2 };
  const plain = perceivedTasteAxes(dish, undefined);
  assert.equal(plain.length, Object.keys(NEUTRAL_TASTE_VECTOR).length);
  assert.ok(plain.every((axis) => axis.yours === undefined));
  assert.equal(plain.find((axis) => axis.key === "spicy")?.standard, 8);
  const forDiner = perceivedTasteAxes(dish, { ...NEUTRAL_TASTE_VECTOR, spicy: 2 });
  const spicy = forDiner.find((axis) => axis.key === "spicy");
  assert.equal(spicy?.yours, 2);
  assert.equal(spicy?.standard, 8);
  assert.equal(
    perceivedTasteSentence({
      key: "sweet",
      label: "Sweet",
      standard: 4,
      perceived: 4,
      direction: "same",
    }),
    "About as sweet as it is for most people",
  );
  assert.deepEqual(palateSummary(undefined), { loves: [], mild: [] });
});
