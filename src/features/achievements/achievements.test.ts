import assert from "node:assert/strict";
import test from "node:test";

import {
  ACHIEVEMENT_DEFINITIONS,
  computeAchievements,
  type AchievementInput,
} from "./achievements";

const empty: AchievementInput = {
  triedDishes: 0,
  distinctCentres: 0,
  stallsVisited: 0,
  spicyDishes: 0,
  sweetDishes: 0,
  budgetDishes: 0,
  reviewsWritten: 0,
  dishesSaved: 0,
};

const byId = (rows: ReturnType<typeof computeAchievements>, id: string) =>
  rows.find((row) => row.id === id)!;

test("a new diner starts every achievement at level 0 with the first tier as the target", () => {
  const rows = computeAchievements(empty);
  assert.equal(rows.length, ACHIEVEMENT_DEFINITIONS.length);
  for (const row of rows) {
    assert.equal(row.level, 0);
    assert.equal(row.completed, false);
    assert.equal(row.fraction, 0);
  }
  assert.equal(byId(rows, "dish-collector").target, 10);
});

test("the 100 dishes achievement tops out at 100 and reports progress to each tier", () => {
  const half = byId(computeAchievements({ ...empty, triedDishes: 17 }), "dish-collector");
  assert.equal(half.level, 1);
  assert.equal(half.target, 25);
  assert.equal(Math.round(half.fraction * 100), 47);
  const done = byId(computeAchievements({ ...empty, triedDishes: 140 }), "dish-collector");
  assert.equal(done.completed, true);
  assert.equal(done.level, 4);
  assert.equal(done.target, 100);
  assert.equal(done.fraction, 1);
});

test("centre hopper, spice chaser and critic read their own counts", () => {
  const rows = computeAchievements({
    ...empty,
    distinctCentres: 5,
    spicyDishes: 3,
    reviewsWritten: 1,
  });
  assert.equal(byId(rows, "centre-hopper").level, 2);
  assert.match(byId(rows, "centre-hopper").description, /different hawker centres/);
  assert.equal(byId(rows, "spice-chaser").level, 1);
  assert.equal(byId(rows, "critic").level, 1);
});

test("negative or fractional counts never break a row", () => {
  const row = byId(computeAchievements({ ...empty, triedDishes: -4 }), "dish-collector");
  assert.equal(row.progress, 0);
  const fractional = byId(computeAchievements({ ...empty, triedDishes: 10.9 }), "dish-collector");
  assert.equal(fractional.level, 1);
});
