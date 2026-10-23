import assert from "node:assert/strict";
import test from "node:test";

import {
  applyContextModifier,
  computeContextModifier,
  getTimeGreeting,
  getTimeHint,
  getTimeSegment,
  type TimeSegment,
} from "@/lib/ai/contextEngine";
import type { TasteVector } from "@/types/domain";

const NEUTRAL: TasteVector = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

test("getTimeSegment maps every hour of the day to a segment with exact boundaries", () => {
  const expected: Record<number, TimeSegment> = {
    0: "late_night",
    5: "late_night",
    6: "morning",
    9: "morning",
    10: "lunch",
    13: "lunch",
    14: "afternoon",
    16: "afternoon",
    17: "dinner",
    20: "dinner",
    21: "late_night",
    23: "late_night",
  };
  for (const [hour, segment] of Object.entries(expected)) {
    assert.equal(getTimeSegment(Number(hour)), segment, `hour ${hour}`);
  }
  for (let hour = 0; hour < 24; hour += 1) {
    assert.ok(getTimeGreeting(getTimeSegment(hour)).length > 0);
    assert.ok(getTimeHint(getTimeSegment(hour)).length > 0);
  }
});

test("computeContextModifier adds weather on top of the time segment", () => {
  assert.deepEqual(computeContextModifier({ timeSegment: "lunch" }), { salty: 1, rich: 1 });
  assert.deepEqual(computeContextModifier({ timeSegment: "lunch", weather: "clear" }), {
    salty: 1,
    rich: 1,
  });
  assert.deepEqual(computeContextModifier({ timeSegment: "lunch", weather: "rain" }), {
    salty: 1,
    rich: 3,
    aromatic: 1,
    sweet: -1,
  });
});

test("context modifiers stay small enough to never override a taste vector", () => {
  const segments: TimeSegment[] = ["morning", "lunch", "afternoon", "dinner", "late_night"];
  for (const timeSegment of segments) {
    for (const weather of [undefined, "clear", "rain", "hot", "cool"] as const) {
      const modifier = computeContextModifier({ timeSegment, weather });
      for (const value of Object.values(modifier)) {
        assert.ok(Math.abs(value ?? 0) <= 4, `${timeSegment}/${weather} is a nudge`);
      }
    }
  }
});

test("applyContextModifier adds the nudge and clamps every axis to 0..10", () => {
  assert.deepEqual(applyContextModifier(NEUTRAL, {}), NEUTRAL);
  assert.deepEqual(applyContextModifier(NEUTRAL, { sweet: 2, rich: -1 }), {
    ...NEUTRAL,
    sweet: 7,
    rich: 4,
  });
  const extremes = applyContextModifier(
    { ...NEUTRAL, sweet: 9.5, spicy: 0.5 },
    { sweet: 2, spicy: -2 },
  );
  assert.equal(extremes.sweet, 10);
  assert.equal(extremes.spicy, 0);
  // The base vector is never mutated.
  assert.equal(NEUTRAL.sweet, 5);
});
