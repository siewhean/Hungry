import assert from "node:assert/strict";
import test from "node:test";

import { orderHawkerClassics } from "./hawkerClassics";

const classics = ["laksa", "chicken-rice", "satay", "nasi-lemak", "roti-prata"];
const had = new Set(["satay", "roti-prata"]);
const isFamiliar = (id: string) => had.has(id);

test("favourites puts the dishes the user already had first", () => {
  assert.deepEqual(orderHawkerClassics(classics, { openness: "favourites", isFamiliar }), [
    "satay",
    "roti-prata",
    "laksa",
    "chicken-rice",
    "nasi-lemak",
  ]);
});

test("adventurous puts new dishes first", () => {
  assert.deepEqual(orderHawkerClassics(classics, { openness: "adventurous", isFamiliar }), [
    "laksa",
    "chicken-rice",
    "nasi-lemak",
    "satay",
    "roti-prata",
  ]);
});

test("mix, or no answer yet, alternates familiar and new and keeps every dish", () => {
  const expected = ["satay", "laksa", "roti-prata", "chicken-rice", "nasi-lemak"];
  assert.deepEqual(orderHawkerClassics(classics, { openness: "mix", isFamiliar }), expected);
  assert.deepEqual(orderHawkerClassics(classics, { openness: undefined, isFamiliar }), expected);
});
