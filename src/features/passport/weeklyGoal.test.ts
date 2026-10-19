import assert from "node:assert/strict";
import test from "node:test";

import { computeWeeklyGoal, milestoneReachedThisWeek, WEEKLY_GOAL_TARGET } from "./weeklyGoal";

// Wednesday 2026-10-21, 12:00 SGT. The Singapore week started Monday 2026-10-19.
const NOW = new Date("2026-10-21T04:00:00Z");

test("counts items tried this Singapore week toward the goal", () => {
  const progress = computeWeeklyGoal(
    [
      "2026-10-18T16:30:00Z", // Monday 00:30 SGT: this week
      "2026-10-20T05:00:00Z",
      "2026-10-18T15:00:00Z", // Sunday 23:00 SGT: last week
    ],
    NOW,
  );
  assert.equal(progress.count, 2);
  assert.equal(progress.target, WEEKLY_GOAL_TARGET);
  assert.equal(progress.completed, false);
  assert.equal(progress.weeksCompleted, 0);
  assert.equal(progress.nextMilestone?.weeks, 1);
});

test("a missed week costs nothing: completed weeks keep counting", () => {
  const twoWeeksAgo = ["2026-10-06T04:00:00Z", "2026-10-07T04:00:00Z", "2026-10-08T04:00:00Z"];
  const thisWeek = ["2026-10-19T04:00:00Z", "2026-10-20T04:00:00Z", "2026-10-21T03:00:00Z"];
  const progress = computeWeeklyGoal([...twoWeeksAgo, ...thisWeek], NOW);
  assert.equal(progress.completed, true);
  assert.equal(progress.weeksCompleted, 2);
  assert.equal(milestoneReachedThisWeek(progress), null);
  assert.equal(progress.nextMilestone?.weeks, 4);
});

test("the first completed week reaches the first milestone", () => {
  const progress = computeWeeklyGoal(
    ["2026-10-19T04:00:00Z", "2026-10-20T04:00:00Z", "2026-10-21T03:00:00Z"],
    NOW,
  );
  assert.equal(milestoneReachedThisWeek(progress)?.title, "First goal met");
});

test("ignores bad and future timestamps", () => {
  const progress = computeWeeklyGoal(["not a date", "2026-10-22T04:00:00Z"], NOW);
  assert.equal(progress.count, 0);
});
