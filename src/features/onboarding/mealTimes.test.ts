import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MEAL_TIME,
  MEAL_KEYS,
  MEAL_TIME_OPTIONS,
  formatMealTime,
  previewMeal,
  pushTimeFor,
  setMealTime,
  toggleMeal,
} from "./mealTimes";

test("every meal offers its default time among its options", () => {
  for (const meal of MEAL_KEYS)
    assert.ok(MEAL_TIME_OPTIONS[meal].includes(DEFAULT_MEAL_TIME[meal]), meal);
});

test("times read the way people say them", () => {
  assert.equal(formatMealTime("12:00"), "12:00 pm");
  assert.equal(formatMealTime("18:30"), "6:30 pm");
  assert.equal(formatMealTime("07:00"), "7:00 am");
  assert.equal(formatMealTime("00:30"), "12:30 am");
});

test("the push comes 45 minutes before the usual time", () => {
  assert.equal(pushTimeFor("12:00"), "11:15");
  assert.equal(pushTimeFor("18:30"), "17:45");
  assert.equal(pushTimeFor("00:30"), "23:45", "wraps back past midnight");
});

test("tapping a meal on gives it a default time and tapping again removes it", () => {
  const on = toggleMeal({}, "lunch");
  assert.deepEqual(on, { lunch: "12:00" });
  assert.deepEqual(toggleMeal(on, "lunch"), {});
  assert.deepEqual(toggleMeal(on, "dinner"), { lunch: "12:00", dinner: "18:30" });
});

test("a time can only be one of the offered ones", () => {
  assert.deepEqual(setMealTime({ lunch: "12:00" }, "lunch", "13:00"), { lunch: "13:00" });
  assert.deepEqual(setMealTime({ lunch: "12:00" }, "lunch", "03:00"), { lunch: "12:00" });
});

test("the notification preview uses lunch, then dinner, never breakfast or supper", () => {
  assert.deepEqual(previewMeal({ lunch: "12:30", dinner: "19:00" }), {
    meal: "lunch",
    time: "12:30",
  });
  assert.deepEqual(previewMeal({ dinner: "19:00", supper: "22:30" }), {
    meal: "dinner",
    time: "19:00",
  });
  assert.equal(previewMeal({ breakfast: "08:00", supper: "22:30" }), null);
});
