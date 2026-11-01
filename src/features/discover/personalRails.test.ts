import assert from "node:assert/strict";
import test from "node:test";

import type { Bite } from "@/lib/services/types";

import { bitesForMealPeriod, bitesLikeDish, mealPeriodForHour, toTitleCase } from "./personalRails";

const bite = (id: string, dishName: string) => ({ id, dishId: id, dishName }) as unknown as Bite;

test("the hour picks the part of the day", () => {
  assert.equal(mealPeriodForHour(7), "breakfast");
  assert.equal(mealPeriodForHour(12), "lunch");
  assert.equal(mealPeriodForHour(16), "teaTime");
  assert.equal(mealPeriodForHour(19), "dinner");
  assert.equal(mealPeriodForHour(23), "lateNight");
  assert.equal(mealPeriodForHour(2), "lateNight");
});

test("a meal rail keeps the dishes that suit the time of day", () => {
  const bites = [bite("a", "Kaya Toast"), bite("b", "Chicken Rice"), bite("c", "Bak Kut Teh")];
  assert.deepEqual(
    bitesForMealPeriod(bites, "breakfast").map((b) => b.id),
    ["a"],
  );
  assert.deepEqual(
    bitesForMealPeriod(bites, "dinner").map((b) => b.id),
    ["b", "c"],
  );
  assert.deepEqual(bitesForMealPeriod(bites, "lateNight"), []);
});

test("'more like' matches the same kind of dish and leaves the dish itself out", () => {
  const bites = [bite("a", "Laksa"), bite("b", "Prawn Laksa"), bite("c", "Chicken Rice")];
  assert.deepEqual(
    bitesLikeDish(bites, "Laksa").map((b) => b.id),
    ["b"],
  );
  assert.deepEqual(
    bitesLikeDish(bites, "Curry Laksa").map((b) => b.id),
    ["a", "b"],
  );
  assert.deepEqual(bitesLikeDish(bites, ""), []);
});

test("dish names are title-cased for rail titles", () => {
  assert.equal(toTitleCase("prawn laksa"), "Prawn Laksa");
});
