import assert from "node:assert/strict";
import test from "node:test";
import { isWithinBudget, resolveBudgetMaximum } from "./budget";

test("maximum respects a stricter profile without clamping higher selections to eight dollars", () => {
  assert.equal(resolveBudgetMaximum(10), 10);
  assert.equal(resolveBudgetMaximum(10, 6.5), 6.5);
  assert.equal(resolveBudgetMaximum(5, 10), 5);
  assert.equal(resolveBudgetMaximum(Number.NaN), 0);
  for (const invalid of [0, -1, Number.NaN, Infinity]) {
    assert.equal(resolveBudgetMaximum(5, invalid), 0);
  }
});

test("budget includes exact cap but excludes unknown, non-finite and invalid prices", () => {
  assert.equal(isWithinBudget(8, 8), true);
  assert.equal(isWithinBudget(8.01, 8), false);
  for (const price of [0, -1, Number.NaN, Infinity, -Infinity]) {
    assert.equal(isWithinBudget(price, 8), false);
  }
  assert.equal(isWithinBudget(5, 0), false);
});
