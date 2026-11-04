import assert from "node:assert/strict";
import test from "node:test";

import { formatDishPrice, parseDishPrice } from "@/features/merchant/dishPrice";

test("parseDishPrice accepts up to two decimals and an optional S$", () => {
  assert.equal(parseDishPrice("5.50"), 5.5);
  assert.equal(parseDishPrice(" S$6 "), 6);
  assert.equal(parseDishPrice("$0.05"), 0.05);
});

test("parseDishPrice refuses zero, negatives, text, three decimals and over S$9,999", () => {
  for (const bad of ["", "0", "0.00", "-1", "abc", "5.555", "10000", "1,000"]) {
    assert.equal(parseDishPrice(bad), null, bad);
  }
  assert.equal(parseDishPrice("9999"), 9999);
});

test("formatDishPrice always shows two decimals", () => {
  assert.equal(formatDishPrice(5), "S$5.00");
});
