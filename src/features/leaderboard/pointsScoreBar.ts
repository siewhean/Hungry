// The score bar that slides in after you earn points: what you earned, your place on this week's
// Most active board, and how many more points pass the next person up.
import { create } from "zustand";

import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LeaderboardRow } from "@/lib/services/types";

export type NextRankGoal = {
  /** The rank you move up to. */
  rank: number;
  /** Points still needed to pass whoever holds it. */
  pointsNeeded: number;
  /** 0-1: how far your points are toward that goal. */
  progress: number;
};

/**
 * Points to pass the person one place above you this week. Off the board, it is the points to
 * reach its last listed place. Null at #1, or when there is no one to chase.
 */
export function nextRankGoal(
  rows: readonly LeaderboardRow[],
  myRank: number | null,
  myPoints: number,
): NextRankGoal | null {
  if (myRank === 1) return null;
  const target = myRank
    ? rows.find((row) => row.rank === myRank - 1)
    : rows.filter((row) => !row.isMe).at(-1);
  if (!target) return null;
  const pointsNeeded = Math.max(1, target.score - myPoints + 1);
  const goal = myPoints + pointsNeeded;
  return {
    rank: target.rank,
    pointsNeeded,
    progress: goal > 0 ? Math.min(1, Math.max(0, myPoints / goal)) : 0,
  };
}

/** "12 points to reach #6", "You're #1 this week", or the first-post nudge. */
export function nextRankLabel(goal: NextRankGoal | null, myRank: number | null): string {
  if (myRank === 1) return "You're #1 this week";
  if (!goal) return myRank ? `#${myRank} this week` : "You're on the board";
  const unit = goal.pointsNeeded === 1 ? "point" : "points";
  return `${goal.pointsNeeded} ${unit} to reach #${goal.rank}`;
}

export type ScoreBarState = {
  earned: number;
  weekPoints: number;
  rank: number | null;
  goal: NextRankGoal | null;
};

type Store = {
  bar: ScoreBarState | null;
  celebrate: (earned: number) => Promise<void>;
  dismiss: () => void;
};

/** Reads your summary and this week's board, then shows the bar. A failed read shows nothing. */
export const usePointsScoreBar = create<Store>((set) => ({
  bar: null,
  dismiss: () => set({ bar: null }),
  celebrate: async (earned) => {
    if (earned <= 0) return;
    const leaderboard = getHungryService().leaderboard;
    try {
      const [summary, rows] = await Promise.all([
        leaderboard.getMySummary(),
        leaderboard.getLeaderboard({ board: "active", period: "week", limit: 100 }),
      ]);
      if (!summary) return;
      const rank = summary.activeWeekRank;
      set({
        bar: {
          earned,
          weekPoints: summary.weekPoints,
          rank,
          goal: nextRankGoal(rows, rank, summary.weekPoints),
        },
      });
    } catch (error) {
      reportError(error, { screen: "points_score_bar", action: "load_board" });
    }
  },
}));
