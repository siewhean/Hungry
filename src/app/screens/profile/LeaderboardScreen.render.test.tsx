// The Leaderboard screen and its Profile entry row, rendered and pressed against stubbed reads.
// Run with `node scripts/test-render.mjs src/app/screens/profile/LeaderboardScreen.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { LeaderboardScreen } from "@/app/screens/profile/LeaderboardScreen";
import { ProfileHomeScreen } from "@/app/screens/profile/ProfileHomeScreen";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getHungryService } from "@/lib/services/serviceProvider";
import type {
  LeaderboardQuery,
  LeaderboardRow,
  LeaderboardSummary,
  PortfolioPointsEntry,
} from "@/lib/services/types";
import { cleanup, renderScreen, type FakeNavigation } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const flags = FEATURE_FLAGS as unknown as Record<string, boolean>;
const savedFlags = { ...flags };
const restores: (() => void)[] = [];

function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

function lastNavigate(navigation: FakeNavigation) {
  return navigation.calls.filter((call) => call.method === "navigate").at(-1)?.args;
}

const SUMMARY: LeaderboardSummary = {
  totalPoints: 85,
  weekPoints: 23,
  activeWeekRank: 51,
  activeAllRank: 3,
  trendingRank: null,
  creditedPostsToday: 2,
  dailyCap: 6,
};

function row(
  rank: number,
  userId: string,
  overrides: Partial<LeaderboardRow> = {},
): LeaderboardRow {
  return {
    rank,
    userId,
    displayName: `Diner ${userId}`,
    score: 100 - rank,
    isMe: false,
    ...overrides,
  };
}

function stubBoard({
  rows = [row(1, "a"), row(2, "b")],
  summary = SUMMARY,
  points = [
    { id: "e1", kind: "post", points: 10, createdAt: "2026-11-07T05:00:00Z", voided: false },
    {
      id: "e2",
      kind: "achievement",
      points: 15,
      achievementId: "posted",
      tier: 1,
      createdAt: "2026-11-07T05:01:00Z",
      voided: false,
    },
  ] as PortfolioPointsEntry[],
  fail = false,
}: {
  rows?: LeaderboardRow[];
  summary?: LeaderboardSummary | null;
  points?: PortfolioPointsEntry[];
  fail?: boolean;
} = {}) {
  const service = getHungryService();
  const queries: LeaderboardQuery[] = [];
  let failNext = fail;
  stub(service.leaderboard, "getLeaderboard", async (query: LeaderboardQuery) => {
    queries.push(query);
    if (failNext) {
      failNext = false;
      throw new Error("offline");
    }
    return rows;
  });
  stub(service.leaderboard, "getMySummary", async () => summary);
  stub(service.leaderboard, "listMyPoints", async () => points);
  return queries;
}

beforeEach(async () => {
  await enterScenario("user");
  flags.foodPortfolioEnabled = true;
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
});

test("shows your points, the board, your pinned row and how points work; a row opens the person", async () => {
  const queries = stubBoard();
  const view = await renderScreen(LeaderboardScreen as never, { name: "Leaderboard" });
  assert.ok(view.findByText("85"), "total Portfolio points");
  assert.ok(view.findByText("2 of 6 credited posts today"));
  assert.deepEqual(queries[0], { board: "active", period: "week", scope: "everyone", limit: 50 });
  assert.ok(view.findByTestId("leaderboard-row-a"));
  assert.ok(view.findByTestId("leaderboard-own-row"), "you are #51, outside the rows shown");
  assert.ok(view.findByTestId("leaderboard-be-first"), "fewer than 10 people on the board");
  assert.ok(view.findByText("How points work"));
  assert.ok(view.findByText("Posted, tier 1"));

  await view.press(view.findByTestId("leaderboard-row-a"));
  assert.deepEqual(lastNavigate(view.navigation), [
    "UserProfile",
    { authorId: "a", authorName: "Diner a", authorAvatarUrl: undefined },
  ]);
});

test("switching board, period and scope reads the matching board", async () => {
  const queries = stubBoard();
  const view = await renderScreen(LeaderboardScreen as never, { name: "Leaderboard" });
  await view.press(view.findByText("All time"));
  assert.deepEqual(queries.at(-1), {
    board: "active",
    period: "all",
    scope: "everyone",
    limit: 50,
  });
  await view.press(view.findByText("Following"));
  assert.equal(queries.at(-1)?.scope, "following");
  await view.press(view.findByText("Trending"));
  assert.equal(queries.at(-1)?.board, "trending");
  assert.equal(view.findByText("All time"), null, "Trending is always the last 7 days");
  assert.ok(view.findByText(/each person counts once a day/));
});

test("a failed read shows Retry and reads again", async () => {
  const queries = stubBoard({ fail: true });
  const view = await renderScreen(LeaderboardScreen as never, { name: "Leaderboard" });
  assert.ok(view.findByText("Couldn't load the leaderboard"));
  await view.press(view.findByText("Retry"));
  assert.ok(view.findByTestId("leaderboard-row-a"));
  assert.ok(queries.length >= 2);
});

test("your own row is not tappable and not pinned twice", async () => {
  stubBoard({ rows: [row(1, "me", { isMe: true })], summary: { ...SUMMARY, activeWeekRank: 1 } });
  const view = await renderScreen(LeaderboardScreen as never, { name: "Leaderboard" });
  assert.ok(view.findByText("You"));
  assert.equal(view.findByTestId("leaderboard-own-row"), null);
});

test("own Profile opens the Leaderboard only with the Food Portfolio on", async () => {
  stubBoard();
  const service = getHungryService();
  stub(service.social, "getFollowCounts", async () => ({ followersCount: 0, followingCount: 0 }));
  stub(service.social, "listUserPosts", async () => []);
  stub(service.foodPortfolio, "getTopPosts", async () => ({ posts: [], pinnedPostIds: [] }));
  stub(service.foodPortfolio, "listStalls", async () => []);
  let view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  await view.press(view.findByTestId("profile-leaderboard-row"));
  assert.ok(
    view.navigation.calls.some(
      (call) => call.method === "navigate" && call.args[0] === "Leaderboard",
    ),
  );
  await view.unmount();

  flags.foodPortfolioEnabled = false;
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("profile-leaderboard-row"), null);
});
