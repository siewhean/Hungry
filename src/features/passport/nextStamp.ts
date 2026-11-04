// What the "next stamp" card and the Profile tab ring say. Pure: the screens pass in the
// closest stamp (getNextPassportStamp) and this week's goal, this picks the one thing that is
// closest to done so there is always something within reach.

import type { WeeklyGoalProgress } from "@/features/passport/weeklyGoal";
import type { PassportNextStamp } from "@/types/domain";

/** A stamp this many tries away (or fewer) leads; further out, an unmet weekly goal leads. */
export const NEXT_STAMP_NEAR = 3;

export interface NextStampSummary {
  kind: "stamp" | "weekly-goal";
  /** 0 to 1, the fill of the ring. */
  fraction: number;
  headline: string;
  detail: string;
}

function stallWord(count: number): string {
  return count === 1 ? "stall" : "stalls";
}

function stampSummary(next: PassportNextStamp): NextStampSummary {
  const remaining = Math.max(0, next.remainingCount);
  const headline =
    next.triedCount === 0
      ? "Earn your first stamp"
      : `${remaining} more ${stallWord(remaining)} to your next stamp`;
  return {
    kind: "stamp",
    fraction: Math.max(0, Math.min(1, next.progressFraction)),
    headline,
    detail:
      next.triedCount === 0
        ? `Mark a stall tried for ${next.category.name}`
        : `${next.category.name}, ${next.triedCount} of ${next.triedCount + remaining} tried`,
  };
}

function goalSummary(goal: WeeklyGoalProgress): NextStampSummary {
  const remaining = Math.max(0, goal.target - goal.count);
  return {
    kind: "weekly-goal",
    fraction: Math.max(0, Math.min(1, goal.count / goal.target)),
    headline: `${remaining} more ${remaining === 1 ? "try" : "tries"} to meet this week's goal`,
    detail: `${goal.count} of ${goal.target} this week`,
  };
}

/**
 * The stamp when it is within reach, otherwise the weekly goal when it is still open, otherwise
 * the stamp however far away, otherwise nothing (every stamp earned and the goal met).
 */
export function summariseNextStamp(
  next: PassportNextStamp | null,
  goal: WeeklyGoalProgress | null,
): NextStampSummary | null {
  const goalOpen = goal !== null && !goal.completed;
  if (next && next.remainingCount <= NEXT_STAMP_NEAR) return stampSummary(next);
  if (goalOpen) return goalSummary(goal);
  if (next) return stampSummary(next);
  return null;
}
