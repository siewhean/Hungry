import assert from "node:assert/strict";
import test from "node:test";

import { buildWeeklyRecap, recapWeekAt } from "./weeklyRecap";
import { singaporeWeekIndex } from "./weeklyStreak";

const SUNDAY = new Date("2026-11-15T10:00:00Z"); // Sun 18:00 SGT
const MONDAY_MORNING = new Date("2026-11-16T01:00:00Z"); // Mon 09:00 SGT
const MONDAY_AFTERNOON = new Date("2026-11-16T06:00:00Z"); // Mon 14:00 SGT
const WEDNESDAY = new Date("2026-11-11T04:00:00Z");
const DAY = 86_400_000;

test("the recap shows on Sunday for this week and on Monday morning for last week", () => {
  const week = singaporeWeekIndex(SUNDAY.getTime());
  assert.equal(recapWeekAt(SUNDAY), week);
  assert.equal(recapWeekAt(MONDAY_MORNING), week);
  assert.equal(recapWeekAt(MONDAY_AFTERNOON), null);
  assert.equal(recapWeekAt(WEDNESDAY), null);
});

test("no recap for a week with nothing new tried", () => {
  assert.equal(buildWeeklyRecap([], SUNDAY), null);
  const lastWeek = new Date(SUNDAY.getTime() - 7 * DAY).toISOString();
  assert.equal(buildWeeklyRecap([lastWeek], SUNDAY), null);
});

test("the recap counts the week's places and names the streak", () => {
  const tried = [
    WEDNESDAY.toISOString(),
    new Date(WEDNESDAY.getTime() + DAY).toISOString(),
    new Date(SUNDAY.getTime() - 7 * DAY).toISOString(),
  ];
  const recap = buildWeeklyRecap(tried, SUNDAY);
  assert.ok(recap);
  assert.equal(recap.places, 2);
  assert.equal(recap.streak.weeks, 2);
  assert.match(recap.body, /2 new places/);
  assert.match(recap.body, /2-week streak, a new milestone/);
  // Monday morning still recaps the same week, with the streak as it stood on Sunday night.
  const monday = buildWeeklyRecap(tried, MONDAY_MORNING);
  assert.equal(monday?.week, recap.week);
  assert.equal(monday?.streak.weeks, 2);
});

test("a first week invites a streak instead of claiming one", () => {
  const recap = buildWeeklyRecap([WEDNESDAY.toISOString()], SUNDAY);
  assert.match(recap?.body ?? "", /starts a streak/);
});
