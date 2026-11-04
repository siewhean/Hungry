import assert from "node:assert/strict";
import test from "node:test";

import {
  ALL_PASSPORT_CATEGORIES,
  getNextPassportStamp,
  computePassportProgress,
} from "@/constants/passportConfig";
import { NEXT_STAMP_NEAR, summariseNextStamp } from "@/features/passport/nextStamp";
import { computeWeeklyGoal } from "@/features/passport/weeklyGoal";
import type { UserPassportProgress } from "@/types/domain";

function progressWith(counts: Record<string, number>) {
  const map: Record<string, UserPassportProgress> = {};
  for (const category of ALL_PASSPORT_CATEGORIES) {
    map[category.id] = computePassportProgress(category, counts[category.id] ?? 0);
  }
  return map;
}

const NOW = new Date("2026-11-04T04:00:00Z");
const openGoal = computeWeeklyGoal([], NOW);
const metGoal = computeWeeklyGoal(
  ["2026-11-02T01:00:00Z", "2026-11-03T01:00:00Z", "2026-11-03T05:00:00Z"],
  NOW,
);

test("a new diner is invited to earn the first stamp", () => {
  const summary = summariseNextStamp(getNextPassportStamp(progressWith({})), openGoal);
  assert.equal(summary?.kind, "stamp");
  assert.equal(summary?.headline, "Earn your first stamp");
  assert.equal(summary?.fraction, 0);
});

test("a stamp within reach leads and counts the stalls left", () => {
  // 2 of 3 Malay stalls tried: one more earns the second stamp.
  const next = getNextPassportStamp(progressWith({ "cuisine-malay": 2 }));
  const summary = summariseNextStamp(next, openGoal);
  assert.equal(summary?.kind, "stamp");
  assert.equal(summary?.headline, "1 more stall to your next stamp");
  assert.match(summary?.detail ?? "", /Malay Food Explorer, 2 of 3 tried/);
  assert.ok((summary?.fraction ?? 0) > 0.6 && (summary?.fraction ?? 0) < 0.7);
});

test("when the nearest stamp is far off the open weekly goal leads", () => {
  const far = progressWith(
    Object.fromEntries(ALL_PASSPORT_CATEGORIES.map((category) => [category.id, 5])),
  );
  const next = getNextPassportStamp(far);
  assert.ok(next && next.remainingCount > NEXT_STAMP_NEAR);
  const goal = computeWeeklyGoal(["2026-11-03T01:00:00Z"], NOW);
  const summary = summariseNextStamp(next, goal);
  assert.equal(summary?.kind, "weekly-goal");
  assert.equal(summary?.headline, "2 more tries to meet this week's goal");
  assert.equal(summary?.detail, "1 of 3 this week");
});

test("a far stamp still shows once the weekly goal is met", () => {
  const far = progressWith(
    Object.fromEntries(ALL_PASSPORT_CATEGORIES.map((category) => [category.id, 5])),
  );
  const summary = summariseNextStamp(getNextPassportStamp(far), metGoal);
  assert.equal(summary?.kind, "stamp");
});

test("nothing shows when every stamp is earned and the goal is met", () => {
  const all = progressWith(
    Object.fromEntries(ALL_PASSPORT_CATEGORIES.map((category) => [category.id, 10])),
  );
  assert.equal(getNextPassportStamp(all), null);
  assert.equal(summariseNextStamp(null, metGoal), null);
});

test("with no stamp data the open weekly goal still gives something to aim at", () => {
  const summary = summariseNextStamp(null, openGoal);
  assert.equal(summary?.kind, "weekly-goal");
  assert.equal(summary?.headline, "3 more tries to meet this week's goal");
});
