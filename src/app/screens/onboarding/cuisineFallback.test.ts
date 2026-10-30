import assert from "node:assert/strict";
import test from "node:test";

import { cuisineImageKeyFor } from "./cuisineFallback";

test("a dish gets the example photo of its kind of food", () => {
  assert.equal(cuisineImageKeyFor({ name: "Hainanese Chicken Rice" }), "chickenRice");
  assert.equal(cuisineImageKeyFor({ name: "Curry Laksa" }), "laksa");
  assert.equal(cuisineImageKeyFor({ name: "Chicken Satay (10 sticks)" }), "satay");
  assert.equal(
    cuisineImageKeyFor({ name: "Fried Kway Teow", foodTypeTag: "Char Kway Teow" }),
    "charKwayTeow",
  );
  assert.equal(cuisineImageKeyFor({ name: "Nasi Biryani" }), "nasiBriyani");
  assert.equal(cuisineImageKeyFor({ name: "Japanese Curry Rice" }), "japaneseCurry");
});

test("asam laksa does not borrow the coconut laksa photo", () => {
  assert.equal(cuisineImageKeyFor({ name: "Asam Laksa" }), undefined);
});

test("a dish with no matching example has none", () => {
  assert.equal(cuisineImageKeyFor({ name: "Hokkien Mee" }), undefined);
  assert.equal(cuisineImageKeyFor({ name: "" }), undefined);
});
