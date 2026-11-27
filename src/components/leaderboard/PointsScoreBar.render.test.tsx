// After a post, a score bar slides in with the points and the gap to the next rank.
// Run with `node scripts/test-render.mjs src/components/leaderboard/PointsScoreBar.render.test.tsx`.
import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { PointsScoreBar } from "@/components/leaderboard/PointsScoreBar";
import { usePointsScoreBar } from "@/features/leaderboard/pointsScoreBar";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LeagueStatus } from "@/lib/services/types";
import { cleanup, render, settle } from "@/test/render";

afterEach(() => {
  usePointsScoreBar.getState().dismiss();
  cleanup();
});

function stubBoard(league: LeagueStatus | null = null) {
  const leaderboard = getHungryService().leaderboard;
  const original = { ...leaderboard };
  leaderboard.getMySummary = async () => ({
    totalPoints: 120,
    weekPoints: 40,
    activeWeekRank: 4,
    activeAllRank: 9,
    trendingRank: null,
    creditedPostsToday: 1,
    dailyCap: 5,
  });
  leaderboard.getMyLeagueStatus = async () => league;
  leaderboard.getLeaderboard = async () => [
    { rank: 3, userId: "a", displayName: "A", score: 45, isMe: false },
    { rank: 4, userId: "me", displayName: "Me", score: 40, isMe: true },
  ];
  return () => Object.assign(leaderboard, original);
}

test("nothing shows until points are earned", async () => {
  const view = await render(<PointsScoreBar onOpenLeaderboard={() => undefined} />);
  assert.equal(view.findByLabel(/points\./), null);
});

test("earning points shows the bar with the rank and the points to the next place", async () => {
  const restore = stubBoard();
  try {
    let opened = 0;
    const view = await render(<PointsScoreBar onOpenLeaderboard={() => (opened += 1)} />);
    await usePointsScoreBar.getState().celebrate(13);
    await settle();
    const bar = view.findByLabel(/^Plus 13 points\. #4 this week\. 6 points to reach #3\./);
    assert.ok(bar, "the bar names the points, the rank and the next goal");
    assert.match(view.text(), /6 points to reach #3/);
    await view.press(bar!);
    assert.equal(opened, 1);
    assert.equal(usePointsScoreBar.getState().bar, null);
  } finally {
    restore();
  }
});

test("zero points shows nothing", async () => {
  const restore = stubBoard();
  try {
    await usePointsScoreBar.getState().celebrate(0);
    assert.equal(usePointsScoreBar.getState().bar, null);
  } finally {
    restore();
  }
});

test("in a league, the bar shows the tier, place and points to promotion with the time left", async () => {
  const restore = stubBoard({
    tier: 2,
    isMember: true,
    cohortSize: 30,
    rank: 9,
    weekPoints: 40,
    promotionLinePoints: 52,
    pointsToPromotion: 13,
    promoteCount: 7,
    relegateCount: 5,
    weekStart: "2026-11-23",
    weekEndsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString(),
  });
  try {
    const view = await render(<PointsScoreBar onOpenLeaderboard={() => undefined} />);
    await usePointsScoreBar.getState().celebrate(10);
    await settle();
    assert.ok(
      view.findByLabel(
        /^Plus 10 points\. Silver league · #9\. 13 points to promotion · 2d 0h left\./,
      ),
    );
  } finally {
    restore();
  }
});
