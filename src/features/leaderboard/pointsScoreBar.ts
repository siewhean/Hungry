// The score bar that slides in after you earn points: what you earned, your place in this week's
// league and the points to promotion (or, before leagues, your Most active rank and the points
// to pass the next person up).
import { create } from "zustand";

import { reportError } from "@/lib/monitoring/reportError";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LeaderboardRow, LeagueStatus } from "@/lib/services/types";

import { leagueGoalLabel, leagueProgress, leaguePlaceLabel } from "./leagues";

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
  /** "Gold league · #4", or "#4 this week" on the Most active board. */
  placeText: string;
  /** "12 points to promotion · 2d 5h left", or "12 points to reach #3". */
  goalText: string;
  /** 0-1 for the bar's fill. */
  progress: number;
};

/** The bar's lines: the league when you are in one, else the Most active board. */
export function scoreBarLines(
  league: LeagueStatus | null,
  rows: readonly LeaderboardRow[],
  rank: number | null,
  weekPoints: number,
  now: Date = new Date(),
): Pick<ScoreBarState, "placeText" | "goalText" | "progress"> {
  if (league) {
    return {
      placeText: leaguePlaceLabel(league),
      goalText: leagueGoalLabel(league, now),
      progress: leagueProgress(league),
    };
  }
  const goal = nextRankGoal(rows, rank, weekPoints);
  return {
    placeText: rank ? `#${rank} this week` : "This week",
    goalText: nextRankLabel(goal, rank),
    progress: goal?.progress ?? 1,
  };
}

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
      const [summary, rows, league] = await Promise.all([
        leaderboard.getMySummary(),
        leaderboard.getLeaderboard({ board: "active", period: "week", limit: 100 }),
        // A league read that fails falls back to the Most active board.
        leaderboard.getMyLeagueStatus().catch((error: unknown) => {
          reportError(error, { screen: "points_score_bar", action: "load_league" });
          return null;
        }),
      ]);
      if (!summary) return;
      set({
        bar: {
          earned,
          weekPoints: league?.weekPoints ?? summary.weekPoints,
          ...scoreBarLines(league, rows, summary.activeWeekRank, summary.weekPoints),
        },
      });
    } catch (error) {
      reportError(error, { screen: "points_score_bar", action: "load_board" });
    }
  },
}));
