import assert from "node:assert/strict";
import test from "node:test";

import { nextRankGoal, nextRankLabel } from "./pointsScoreBar";
import type { LeaderboardRow } from "@/lib/services/types";

const row = (rank: number, score: number, isMe = false): LeaderboardRow => ({
  rank,
  userId: `u${rank}`,
  displayName: `Diner ${rank}`,
  score,
  isMe,
});
const board = [row(1, 90), row(2, 60), row(3, 41), row(4, 40, true), row(5, 12)];

test("the goal is one point past the person just above you", () => {
  const goal = nextRankGoal(board, 4, 40);
  assert.deepEqual(goal && { rank: goal.rank, pointsNeeded: goal.pointsNeeded }, {
    rank: 3,
    pointsNeeded: 2,
  });
  assert.ok(goal && goal.progress > 0.9 && goal.progress < 1);
  assert.equal(nextRankLabel(goal, 4), "2 points to reach #3");
});

test("at #1 there is no one to chase", () => {
  assert.equal(nextRankGoal(board, 1, 90), null);
  assert.equal(nextRankLabel(null, 1), "You're #1 this week");
});

test("off the board, the goal is the last listed place", () => {
  const goal = nextRankGoal(board.slice(0, 3), null, 5);
  assert.equal(goal?.rank, 3);
  assert.equal(goal?.pointsNeeded, 37);
  assert.equal(nextRankLabel(nextRankGoal([], null, 5), null), "You're on the board");
});

test("one point needed reads in the singular", () => {
  assert.equal(
    nextRankLabel({ rank: 2, pointsNeeded: 1, progress: 0.98 }, 3),
    "1 point to reach #2",
  );
});

test("the bar prefers the league line and falls back to the Most active board", async () => {
  const { scoreBarLines } = await import("./pointsScoreBar");
  const rows = [
    { rank: 3, userId: "a", displayName: "A", score: 45, isMe: false },
    { rank: 4, userId: "me", displayName: "Me", score: 40, isMe: true },
  ];
  const board = scoreBarLines(null, rows, 4, 40);
  assert.equal(board.placeText, "#4 this week");
  assert.equal(board.goalText, "6 points to reach #3");
  const league = scoreBarLines(
    {
      tier: 1,
      isMember: true,
      cohortSize: 12,
      rank: 2,
      weekPoints: 40,
      promotionLinePoints: 30,
      pointsToPromotion: 0,
      promoteCount: 7,
      relegateCount: 5,
      weekStart: "2026-11-23",
      weekEndsAt: "2026-11-27T09:00:00Z",
    },
    rows,
    4,
    40,
    new Date("2026-11-27T04:00:00Z"),
  );
  assert.deepEqual(league, {
    placeText: "Bronze league · #2",
    goalText: "In the promotion zone · 5h left",
    progress: 1,
  });
});

test("celebrate shows the league line, falls back to the board when the league read fails, and skips zero", async () => {
  const { usePointsScoreBar } = await import("./pointsScoreBar");
  const { getHungryService } = await import("@/lib/services/serviceProvider");
  const leaderboard = getHungryService().leaderboard;
  const original = { ...leaderboard };
  leaderboard.getMySummary = async () => ({
    totalPoints: 90,
    weekPoints: 40,
    activeWeekRank: 4,
    activeAllRank: 9,
    trendingRank: null,
    creditedPostsToday: 1,
    dailyCap: 6,
  });
  leaderboard.getLeaderboard = async () => [
    { rank: 3, userId: "a", displayName: "A", score: 45, isMe: false },
    { rank: 4, userId: "me", displayName: "Me", score: 40, isMe: true },
  ];
  try {
    leaderboard.getMyLeagueStatus = async () => ({
      tier: 4,
      isMember: true,
      cohortSize: 30,
      rank: 12,
      weekPoints: 55,
      promotionLinePoints: 70,
      pointsToPromotion: 16,
      promoteCount: 7,
      relegateCount: 5,
      weekStart: "2026-11-23",
      weekEndsAt: new Date(Date.now() + 3 * 60 * 60 * 1000 + 60_000).toISOString(),
    });
    await usePointsScoreBar.getState().celebrate(10);
    let bar = usePointsScoreBar.getState().bar;
    assert.equal(bar?.placeText, "Platinum league · #12");
    assert.equal(bar?.goalText, "16 points to promotion · 3h left");
    assert.equal(bar?.weekPoints, 55);

    leaderboard.getMyLeagueStatus = async () => {
      throw new Error("offline");
    };
    await usePointsScoreBar.getState().celebrate(5);
    bar = usePointsScoreBar.getState().bar;
    assert.equal(bar?.placeText, "#4 this week");
    assert.equal(bar?.goalText, "6 points to reach #3");

    usePointsScoreBar.getState().dismiss();
    await usePointsScoreBar.getState().celebrate(0);
    assert.equal(usePointsScoreBar.getState().bar, null);

    leaderboard.getMySummary = async () => {
      throw new Error("down");
    };
    await usePointsScoreBar.getState().celebrate(3);
    assert.equal(usePointsScoreBar.getState().bar, null);
  } finally {
    Object.assign(leaderboard, original);
  }
});
