import assert from "node:assert/strict";
import test from "node:test";

import { computeAchievements, type AchievementInput } from "@/features/achievements/achievements";
import { detectAchievementUnlocks } from "@/features/achievements/unlocks";

const EMPTY: AchievementInput = {
  triedDishes: 0,
  distinctCentres: 0,
  stallsVisited: 0,
  spicyDishes: 0,
  sweetDishes: 0,
  budgetDishes: 0,
  reviewsWritten: 0,
  dishesSaved: 0,
};

test("nothing unlocks when no tier is reached", () => {
  const result = detectAchievementUnlocks(computeAchievements(EMPTY), {});
  assert.deepEqual(result.unlocks, []);
  assert.deepEqual(result.levels, {});
});

test("reaching a tier unlocks it once, with what was done to reach it", () => {
  const rows = computeAchievements({ ...EMPTY, triedDishes: 10 });
  const first = detectAchievementUnlocks(rows, {});
  assert.equal(first.unlocks.length, 1);
  assert.equal(first.unlocks[0].achievementId, "dish-collector");
  assert.equal(first.unlocks[0].level, 1);
  assert.equal(first.unlocks[0].totalLevels, 4);
  assert.equal(first.unlocks[0].reached, "Try 10 different dishes");
  assert.equal(first.levels["dish-collector"], 1);

  const again = detectAchievementUnlocks(rows, first.levels);
  assert.deepEqual(again.unlocks, []);
});

test("jumping several tiers reports the highest reached tier", () => {
  const rows = computeAchievements({ ...EMPTY, triedDishes: 60 });
  const result = detectAchievementUnlocks(rows, { "dish-collector": 1 });
  assert.equal(result.unlocks.length, 1);
  assert.equal(result.unlocks[0].level, 3);
  assert.equal(result.unlocks[0].reached, "Try 50 different dishes");
});

test("a level that drops (data still loading) never unlocks and is not forgotten", () => {
  const rows = computeAchievements({ ...EMPTY, triedDishes: 0 });
  const result = detectAchievementUnlocks(rows, { "dish-collector": 2 });
  assert.deepEqual(result.unlocks, []);
  assert.equal(result.levels["dish-collector"], 2);
});

test("several achievements can unlock together", () => {
  const rows = computeAchievements({ ...EMPTY, reviewsWritten: 1, dishesSaved: 5 });
  const result = detectAchievementUnlocks(rows, {});
  assert.deepEqual(result.unlocks.map((unlock) => unlock.achievementId).sort(), [
    "critic",
    "curator",
  ]);
});
