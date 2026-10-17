import test from "node:test";
import assert from "node:assert/strict";

import { dishes, userProfile } from "@/lib/services/mock/data";
import { buildWeeklyPicks, getWeeklyPicksKey } from "./weeklyPicks";

test("weekly key follows Singapore Mondays", () => {
  // Sunday 23:30 SGT is still the previous week; Monday 00:30 SGT starts a new one.
  assert.equal(getWeeklyPicksKey(new Date("2026-10-18T15:30:00Z")), "2026-W42");
  assert.equal(getWeeklyPicksKey(new Date("2026-10-18T16:30:00Z")), "2026-W43");
});

test("weekly picks are one per stall, skip tried dishes and are stable within a week", () => {
  const profile = { ...userProfile, reviewedDishIds: [dishes[0].id] };
  const picks = buildWeeklyPicks(dishes, profile, "2026-W42");

  assert.ok(picks.length > 0 && picks.length <= 5);
  assert.equal(new Set(picks.map((pick) => pick.dish.venueId)).size, picks.length);
  assert.ok(!picks.some((pick) => pick.dish.id === dishes[0].id));
  assert.deepEqual(
    buildWeeklyPicks(dishes, profile, "2026-W42").map((pick) => pick.dish.id),
    picks.map((pick) => pick.dish.id),
  );
});

test("weekly picks return fewer dishes instead of padding when the pool is small", () => {
  const picks = buildWeeklyPicks(dishes.slice(0, 2), { ...userProfile, reviewedDishIds: [] }, "w");
  assert.ok(picks.length <= 2);
});
