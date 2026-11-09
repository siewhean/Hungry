// Leaderboard display helpers, and the mock leaderboard service that screens use without Supabase.

import assert from "node:assert/strict";
import test from "node:test";

import {
  boardScoreLabel,
  dailyCreditLabel,
  movementLabel,
  portfolioPointsLabel,
  portfolioPointsValue,
  rankLabel,
  shouldPinOwnRow,
  summaryRankFor,
} from "@/features/leaderboard/leaderboardDisplay";
import { hungryService } from "@/lib/services/mock/mockService";
import type { LeaderboardSummary, PortfolioPointsEntry } from "@/lib/services/types";

const SUMMARY: LeaderboardSummary = {
  totalPoints: 85,
  weekPoints: 83,
  activeWeekRank: 4,
  activeAllRank: 12,
  trendingRank: null,
  creditedPostsToday: 2,
  dailyCap: 6,
};

function entry(overrides: Partial<PortfolioPointsEntry>): PortfolioPointsEntry {
  return {
    id: "e",
    kind: "post",
    points: 10,
    createdAt: "2026-11-07T05:00:00Z",
    voided: false,
    ...overrides,
  };
}

test("scores read as points on Most active and one decimal on Trending", () => {
  assert.equal(boardScoreLabel("active", 83), "83 pts");
  assert.equal(boardScoreLabel("active", 1), "1 pt");
  assert.equal(boardScoreLabel("trending", 2.96), "3.0 trending");
});

test("ranks read as #n, or not ranked yet", () => {
  assert.equal(rankLabel(4), "#4");
  assert.equal(rankLabel(null), "Not ranked yet");
  assert.equal(rankLabel(0), "Not ranked yet");
});

test("your rank follows the board and period shown", () => {
  assert.equal(summaryRankFor(SUMMARY, "active", "week"), 4);
  assert.equal(summaryRankFor(SUMMARY, "active", "all"), 12);
  assert.equal(summaryRankFor(SUMMARY, "trending", "all"), null);
  assert.equal(summaryRankFor(null, "active", "week"), null);
});

test("your row is pinned only when you are ranked and not already listed", () => {
  const rows = [{ rank: 1, userId: "a", displayName: "A", score: 9, isMe: false }];
  assert.equal(shouldPinOwnRow(rows, 51), true);
  assert.equal(shouldPinOwnRow(rows, null), false);
  assert.equal(shouldPinOwnRow([{ ...rows[0], isMe: true }], 1), false);
});

test("points history labels each kind and marks removed points", () => {
  assert.equal(portfolioPointsLabel(entry({ kind: "post" })), "Dish posted");
  assert.equal(
    portfolioPointsLabel(entry({ kind: "off_board_post" })),
    "Dish posted (off the board)",
  );
  assert.equal(portfolioPointsLabel(entry({ kind: "new_stall" })), "New stall");
  assert.equal(
    portfolioPointsLabel(entry({ kind: "first_dish_photo" })),
    "First photo of this dish",
  );
  assert.equal(portfolioPointsLabel(entry({ kind: "rich_post" })), "Detailed post");
  assert.equal(
    portfolioPointsLabel(
      entry({ kind: "achievement", achievementId: "weekly-contender", tier: 2 }),
    ),
    "Weekly contender, tier 2",
  );
  assert.equal(
    portfolioPointsLabel(entry({ kind: "achievement", achievementId: "unknown" })),
    "Achievement",
  );
  assert.equal(portfolioPointsValue(entry({ points: 15 })), "+15");
  assert.equal(portfolioPointsValue(entry({ voided: true })), "Removed");
});

test("the daily credit line counts down to the cap", () => {
  assert.equal(dailyCreditLabel(SUMMARY), "2 of 6 credited posts today");
  assert.equal(
    dailyCreditLabel({ ...SUMMARY, creditedPostsToday: 6 }),
    "All 6 credited posts used today",
  );
});

test("mock leaderboard: ranked by score, following scope narrows it, summary and points answer", async () => {
  const everyone = await hungryService.leaderboard.getLeaderboard({ board: "active" });
  assert.ok(everyone.length > 0);
  for (let i = 1; i < everyone.length; i += 1) {
    assert.ok(everyone[i - 1].score >= everyone[i].score, "highest score first");
    assert.ok(everyone[i - 1].rank <= everyone[i].rank);
  }
  const trending = await hungryService.leaderboard.getLeaderboard({ board: "trending", limit: 2 });
  assert.ok(trending.length <= 2);

  const following = await hungryService.leaderboard.getLeaderboard({
    board: "active",
    scope: "following",
  });
  assert.ok(
    following.every((row) => row.isMe),
    "nobody followed yet: only you, if anyone",
  );
  await hungryService.social.followUser(everyone[0].userId);
  const followed = await hungryService.leaderboard.getLeaderboard({
    board: "active",
    scope: "following",
  });
  assert.ok(followed.some((row) => row.userId === everyone[0].userId));
  await hungryService.social.unfollowUser(everyone[0].userId);

  const summary = await hungryService.leaderboard.getMySummary();
  assert.ok(summary);
  assert.equal(summary.dailyCap, 6);
  assert.ok(summary.creditedPostsToday <= summary.dailyCap);
  const points = await hungryService.leaderboard.listMyPoints(3);
  assert.ok(points.length <= 3);
  assert.ok(points.every((item) => item.points === 10 || item.points === 2));
});

test("movementLabel says how far you moved since Monday and where you finished last week", () => {
  assert.equal(movementLabel(null), null);
  assert.equal(movementLabel({ lastWeekRank: null, weekStartAllRank: 4, allRank: 4 }), null);
  assert.equal(
    movementLabel({ lastWeekRank: 5, weekStartAllRank: 9, allRank: 6 }),
    "Up 3 places since Monday · Last week #5",
  );
  assert.equal(
    movementLabel({ lastWeekRank: null, weekStartAllRank: 2, allRank: 3 }),
    "Down 1 place since Monday",
  );
  assert.equal(
    movementLabel({ lastWeekRank: 1, weekStartAllRank: null, allRank: 7 }),
    "Last week #1",
  );
});
