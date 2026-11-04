import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { TASTE_DIMENSIONS } from "@/constants/taste";
import {
  STOP_COUNT,
  STOP_VALUES,
  TASTE_SLIDER_AXES,
  TASTE_SLIDER_ORDER,
  clampSliderValue,
  describeStop,
  formatSliderValue,
  nearestStopIndex,
  snapToStop,
  stopForSavedAnswer,
} from "./tasteSliderStops";

test("every taste has a slider with five foods, and the order covers all six tastes once", () => {
  assert.equal(STOP_COUNT, 5);
  assert.deepEqual([...TASTE_SLIDER_ORDER].sort(), TASTE_DIMENSIONS.map((d) => d.key).sort());
  const slugs: string[] = [];
  for (const key of TASTE_SLIDER_ORDER) {
    const axis = TASTE_SLIDER_AXES[key];
    assert.equal(axis.stops.length, 5, key);
    for (const stop of axis.stops) {
      slugs.push(stop.slug);
      assert.ok(existsSync(`src/assets/onboarding/sliders/${stop.slug}.webp`), stop.slug);
    }
  }
  assert.equal(new Set(slugs).size, 30, "no food is used twice");
  const foodMap = readFileSync("src/features/onboarding/tasteSliderFoods.ts", "utf8");
  for (const slug of slugs)
    assert.ok(foodMap.includes(`sliders/${slug}.webp`), `${slug} is not in tasteSliderFoods.ts`);
});

test("a value snaps to the nearest of the five stops, halfway rounding up", () => {
  assert.deepEqual(
    [0, 1, 1.25, 2, 4, 6.2, 6.3, 9, 10].map(snapToStop),
    [0, 0, 2.5, 2.5, 5, 5, 7.5, 10, 10],
  );
  assert.equal(nearestStopIndex(-3), 0);
  assert.equal(nearestStopIndex(42), 4);
  assert.equal(nearestStopIndex(Number.NaN), 2);
  assert.equal(clampSliderValue(Number.POSITIVE_INFINITY), 5);
  for (const stop of STOP_VALUES) assert.equal(snapToStop(stop), stop);
});

test("old quiz answers (2, 5, 8) move to the nearest new stop", () => {
  assert.deepEqual([2, 5, 8].map(stopForSavedAnswer), [2.5, 5, 7.5]);
});

test("a stop reads out its number, word and dish for a screen reader", () => {
  assert.equal(describeStop("spicy", 3), "7.5, Hot, Sambal stingray");
  assert.equal(describeStop("spicy", 99), "10, Bring the fire, Mala xiang guo");
  assert.equal(describeStop("spicy", -4), "0, Skip the chilli, Fish soup");
});

test("the bubble shows a stop as 5 or 7.5 and a value in between with one decimal", () => {
  assert.equal(formatSliderValue(5, true), "5");
  assert.equal(formatSliderValue(7.5, true), "7.5");
  assert.equal(formatSliderValue(6.34, false), "6.3");
  assert.equal(formatSliderValue(5, false), "5.0");
});
