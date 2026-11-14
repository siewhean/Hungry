// WeeklyRecapCard: shown on Sunday when something new was tried, closed for the week on tap.
// Run with `npm run test:render`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { WeeklyGoalCard } from "@/components/gamification/WeeklyGoalCard";
import { WeeklyRecapCard } from "@/components/gamification/WeeklyRecapCard";
import { computeWeeklyGoal } from "@/features/passport/weeklyGoal";
import { computeWeeklyStreak } from "@/features/passport/weeklyStreak";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useWeeklyRecapStore } from "@/store/useWeeklyRecapStore";
import { cleanup, render } from "@/test/render";
import type { StallInteraction } from "@/types/domain";

afterEach(cleanup);

const SUNDAY = new Date("2026-11-15T10:00:00Z");
const WEDNESDAY = "2026-11-11T04:00:00Z";

beforeEach(() => {
  useWeeklyRecapStore.setState({ dismissedWeek: null });
  useStallInteractionStore.setState({
    interactions: {
      v1: { stallId: "v1", isTried: true, triedAt: WEDNESDAY, isSaved: false } as StallInteraction,
    },
  });
});

test("the recap shows the week's places, opens the Passport and closes for the week", async () => {
  let opened = 0;
  const view = await render(
    createElement(WeeklyRecapCard, { onOpenPassport: () => (opened += 1), now: SUNDAY }),
  );
  assert.ok(view.findByText("Your week in food"));
  assert.ok(view.findByText(/You tried 1 new place this week/));
  await view.press(view.findByLabel(/^Your week in food/));
  assert.equal(opened, 1);
  await view.press(view.findByLabel("Close the week's recap"));
  assert.equal(view.findByText("Your week in food"), null);
  assert.notEqual(useWeeklyRecapStore.getState().dismissedWeek, null);
});

test("no recap midweek", async () => {
  const view = await render(
    createElement(WeeklyRecapCard, {
      onOpenPassport: () => undefined,
      now: new Date("2026-11-12T04:00:00Z"),
    }),
  );
  assert.equal(view.findByText("Your week in food"), null);
});

test("the weekly goal card shows the streak and its rest weeks", async () => {
  const now = new Date("2026-11-11T05:00:00Z");
  const tried = Array.from({ length: 4 }, (_, n) =>
    new Date(now.getTime() - n * 7 * 86_400_000).toISOString(),
  );
  const view = await render(
    createElement(WeeklyGoalCard, {
      progress: computeWeeklyGoal(tried, now),
      streak: computeWeeklyStreak(tried, now),
      celebrating: false,
      reduceMotion: true,
    }),
  );
  assert.ok(view.findByText("4-week streak"));
  assert.ok(view.findByText("1 rest week saved for a busy week"));
});
