import assert from "node:assert/strict";
import test from "node:test";

import { computeWeeklyStreak, singaporeWeekIndex, streakLabel } from "./weeklyStreak";

// Wednesday 2026-11-11 12:00 SGT.
const NOW = new Date("2026-11-11T04:00:00Z");
const weeksAgo = (n: number) => new Date(NOW.getTime() - n * 7 * 86_400_000).toISOString();

test("Singapore weeks start on Monday at midnight SGT", () => {
  const sunday = Date.parse("2026-11-08T15:59:00Z"); // Sun 23:59 SGT
  const monday = Date.parse("2026-11-08T16:00:00Z"); // Mon 00:00 SGT
  assert.equal(singaporeWeekIndex(monday) - singaporeWeekIndex(sunday), 1);
});

test("no tries: no streak, first milestone is two weeks", () => {
  const streak = computeWeeklyStreak([], NOW);
  assert.equal(streak.weeks, 0);
  assert.equal(streak.nextMilestone, 2);
  assert.equal(streakLabel(streak), null);
});

test("the week in progress does not break the streak before it is kept", () => {
  const streak = computeWeeklyStreak([weeksAgo(1), weeksAgo(2)], NOW);
  assert.equal(streak.weeks, 2);
  assert.equal(streak.keptThisWeek, false);
  assert.match(streakLabel(streak) ?? "", /keep it/);
  const kept = computeWeeklyStreak([NOW.toISOString(), weeksAgo(1), weeksAgo(2)], NOW);
  assert.equal(kept.weeks, 3);
  assert.equal(kept.keptThisWeek, true);
  assert.equal(streakLabel(kept), "3-week streak");
});

test("a missed week with no rest week ends the streak", () => {
  const streak = computeWeeklyStreak([NOW.toISOString(), weeksAgo(2), weeksAgo(3)], NOW);
  assert.equal(streak.weeks, 1);
  assert.equal(streak.longest, 2);
});

test("four weeks in a row earn a rest week that covers a missed week", () => {
  const tried = [weeksAgo(2), weeksAgo(3), weeksAgo(4), weeksAgo(5)];
  const streak = computeWeeklyStreak(tried, NOW);
  assert.equal(streak.weeks, 4);
  assert.equal(streak.restWeeks, 0);
  assert.equal(streak.restWeekUsedLastWeek, true);
  assert.equal(streak.keptThisWeek, false);
});

test("rest weeks are capped at two and milestones are reached on the week they are kept", () => {
  const tried = Array.from({ length: 12 }, (_, n) => weeksAgo(n));
  const streak = computeWeeklyStreak(tried, NOW);
  assert.equal(streak.weeks, 12);
  assert.equal(streak.restWeeks, 2);
  assert.equal(streak.milestoneReached, 12);
  assert.equal(streak.nextMilestone, 26);
});

test("future and unreadable dates are ignored", () => {
  const streak = computeWeeklyStreak(["not a date", weeksAgo(-1)], NOW);
  assert.equal(streak.weeks, 0);
});
