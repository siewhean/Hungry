import assert from "node:assert/strict";
import test from "node:test";

import {
  encodeDietaryFlags,
  filterSafeDishes,
  getAllFlagBits,
  getViolatedRestrictions,
  hasConflict,
  isDishSafe,
} from "@/lib/ai/dietaryGate";
import type { DietaryFlag, DishSummary } from "@/types/domain";

function dish(id: string, dietaryFlags: DietaryFlag[]): DishSummary {
  return { id, dietaryFlags } as unknown as DishSummary;
}

test("every dietary flag owns a unique bit that fits a 32-bit mask", () => {
  const bits = getAllFlagBits();
  assert.ok(bits.length >= 29);
  assert.equal(new Set(bits.map((entry) => entry.bit)).size, bits.length);
  for (const { bit } of bits) {
    assert.ok(bit >= 0 && bit < 31, `bit ${bit} must stay within a signed 32-bit mask`);
  }
});

test("encodeDietaryFlags sets one bit per flag and ignores duplicates and unknown flags", () => {
  assert.equal(encodeDietaryFlags([]), 0);
  const halal = encodeDietaryFlags(["halal"]);
  assert.equal(halal, 1);
  assert.equal(encodeDietaryFlags(["halal", "halal"]), halal);
  assert.equal(encodeDietaryFlags(["not_a_flag" as DietaryFlag]), 0);
  assert.equal(
    encodeDietaryFlags(["halal", "vegetarian"]),
    encodeDietaryFlags(["halal"]) | encodeDietaryFlags(["vegetarian"]),
  );
});

test("hasConflict is true only when the user needs a flag the dish lacks", () => {
  const halal = encodeDietaryFlags(["halal"]);
  const halalVeg = encodeDietaryFlags(["halal", "vegetarian"]);
  assert.equal(hasConflict(0, 0), false);
  assert.equal(hasConflict(0, halal), false);
  assert.equal(hasConflict(halal, halalVeg), false);
  assert.equal(hasConflict(halalVeg, halal), true);
  assert.equal(hasConflict(halal, 0), true);
});

test("isDishSafe treats no restrictions as safe and rejects a dish missing a required flag", () => {
  assert.equal(isDishSafe(dish("a", []), []), true);
  assert.equal(isDishSafe(dish("a", ["halal"]), ["halal"]), true);
  assert.equal(isDishSafe(dish("a", []), ["halal"]), false);
  assert.equal(isDishSafe(dish("a", ["halal"]), ["halal", "nut_free"]), false);
});

test("filterSafeDishes never lets an unsafe dish through and keeps the input untouched", () => {
  const dishes = [
    dish("safe", ["halal", "nut_free"]),
    dish("halal-only", ["halal"]),
    dish("none", []),
  ];
  const snapshot = dishes.map((entry) => entry.id);

  assert.deepEqual(
    filterSafeDishes(dishes, ["halal", "nut_free"]).map((entry) => entry.id),
    ["safe"],
  );
  assert.deepEqual(
    filterSafeDishes(dishes, ["halal"]).map((entry) => entry.id),
    ["safe", "halal-only"],
  );
  assert.equal(filterSafeDishes(dishes, []).length, 3);
  assert.deepEqual(
    dishes.map((entry) => entry.id),
    snapshot,
  );
  // A flag the gate cannot encode must never make a dish look safer.
  assert.deepEqual(filterSafeDishes(dishes, ["made_up" as DietaryFlag]).length, 3);
});

test("getViolatedRestrictions names exactly the flags the dish lacks", () => {
  assert.deepEqual(getViolatedRestrictions(dish("a", ["halal"]), ["halal", "vegan"]), ["vegan"]);
  assert.deepEqual(getViolatedRestrictions(dish("a", ["halal"]), ["halal"]), []);
  assert.deepEqual(getViolatedRestrictions(dish("a", []), []), []);
});
