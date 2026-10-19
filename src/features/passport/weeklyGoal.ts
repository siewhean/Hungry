// Passport weekly goal: try a few new dishes or stalls each Singapore week
// (Monday to Sunday). It is a goal, not a streak: a missed week costs nothing
// and weeks already completed always count toward the milestones.
// It awards no Food Cred, so nothing here needs server validation.

import { getWeeklyPicksKey } from "@/features/home/weeklyPicks";

export const WEEKLY_GOAL_TARGET = 3;

export const WEEKLY_GOAL_MILESTONES = [
  { weeks: 1, title: "First goal met" },
  { weeks: 4, title: "Four weeks of discovery" },
  { weeks: 12, title: "Twelve weeks of discovery" },
] as const;

export interface WeeklyGoalProgress {
  weekKey: string;
  count: number;
  target: number;
  completed: boolean;
  /** Weeks, this one included, in which the goal was met. */
  weeksCompleted: number;
  nextMilestone: (typeof WEEKLY_GOAL_MILESTONES)[number] | null;
}

/** `triedAt` timestamps of tried stalls and tried dishes, one per item. */
export function computeWeeklyGoal(triedAt: string[], now = new Date()): WeeklyGoalProgress {
  const weekKey = getWeeklyPicksKey(now);
  const perWeek = new Map<string, number>();
  for (const value of triedAt) {
    const time = Date.parse(value);
    if (Number.isNaN(time) || time > now.getTime()) continue;
    const key = getWeeklyPicksKey(new Date(time));
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
  }

  const count = perWeek.get(weekKey) ?? 0;
  const weeksCompleted = [...perWeek.values()].filter((n) => n >= WEEKLY_GOAL_TARGET).length;
  return {
    weekKey,
    count,
    target: WEEKLY_GOAL_TARGET,
    completed: count >= WEEKLY_GOAL_TARGET,
    weeksCompleted,
    nextMilestone: WEEKLY_GOAL_MILESTONES.find((m) => m.weeks > weeksCompleted) ?? null,
  };
}

/** The milestone reached by completing this week's goal, if any. */
export function milestoneReachedThisWeek(progress: WeeklyGoalProgress) {
  if (!progress.completed) return null;
  return WEEKLY_GOAL_MILESTONES.find((m) => m.weeks === progress.weeksCompleted) ?? null;
}
