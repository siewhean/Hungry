import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  PRICE_STOPS,
  budgetForSliderValue,
  priceBubble,
  priceStopForBudget,
  sliderValueForBudget,
} from "./priceStops";

test("the price slider has five stops that reuse existing food pictures", () => {
  assert.deepEqual(
    PRICE_STOPS.map((stop) => stop.budget),
    [3, 6, 10, 15, undefined],
  );
  for (const stop of PRICE_STOPS) {
    assert.ok(existsSync(`src/assets/onboarding/sliders/${stop.slug}.webp`), stop.slug);
  }
});

test("a saved budget lands on the closest stop, and no budget is the last one", () => {
  assert.equal(priceStopForBudget(undefined), 4);
  assert.equal(priceStopForBudget(6), 1);
  assert.equal(priceStopForBudget(12), 2, "the old S$12 chip sits at S$10");
  assert.equal(priceStopForBudget(99), 3);
  assert.equal(sliderValueForBudget(15), 7.5);
});

test("a slider value means a budget, and the bubble names it", () => {
  assert.equal(budgetForSliderValue(0), 3);
  assert.equal(budgetForSliderValue(5.2), 10);
  assert.equal(budgetForSliderValue(10), undefined);
  assert.equal(priceBubble(2.5), "S$6");
  assert.equal(priceBubble(10), "Any");
});
