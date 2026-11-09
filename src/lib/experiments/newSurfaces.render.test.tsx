// The A/B tests added on 2026-11-07 for surfaces that had none: the Leaderboard's opening board
// and the Profile Activity bell's unread mark. Each serves today's
// design as its fallback, and each variant is checked through a QA override.
// Run with `node scripts/test-render.mjs src/lib/experiments/newSurfaces.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { LeaderboardScreen } from "@/app/screens/profile/LeaderboardScreen";
import { ProfileHomeScreen } from "@/app/screens/profile/ProfileHomeScreen";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
} from "@/lib/analytics/mockAnalytics";
import {
  EXPERIMENTS,
  clearExperimentOverrides,
  setExperimentOverride,
} from "@/lib/experiments/experiments";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { LeaderboardQuery } from "@/lib/services/types";
import { useActivityStore } from "@/store/useActivityStore";
import { cleanup, render, renderScreen } from "@/test/render";
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

function stubLeaderboard() {
  const service = getHungryService();
  const queries: LeaderboardQuery[] = [];
  stub(service.leaderboard, "getLeaderboard", async (query: LeaderboardQuery) => {
    queries.push(query);
    return [];
  });
  stub(service.leaderboard, "getMySummary", async () => null);
  stub(service.leaderboard, "listMyPoints", async () => []);
  return queries;
}

function stubProfile() {
  const service = getHungryService();
  stub(service.social, "getFollowCounts", async () => ({ followersCount: 0, followingCount: 0 }));
  stub(service.social, "listUserPosts", async () => []);
  stub(service.foodPortfolio, "getTopPosts", async () => ({ posts: [], pinnedPostIds: [] }));
  stub(service.foodPortfolio, "listStalls", async () => []);
  stubLeaderboard();
}

beforeEach(async () => {
  await enterScenario("user");
  flags.foodPortfolioEnabled = true;
  flags.activityEnabled = true;
  flags.socialFeedEnabled = false;
  clearTrackedAnalyticsEvents();
});

afterEach(async () => {
  await cleanup();
  clearExperimentOverrides();
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
});

test("the new tests start as drafts on today's design", () => {
  for (const key of ["leaderboard_default_board_v1", "activity_bell_badge_v1"] as const) {
    assert.equal(EXPERIMENTS[key].status, "draft", key);
    assert.equal(EXPERIMENTS[key].fallback, "control", key);
  }
});

test("the Leaderboard opens on Most active, or on Trending in the test arm, and a pick wins", async () => {
  let queries = stubLeaderboard();
  let view = await renderScreen(LeaderboardScreen as never, { name: "Leaderboard" });
  assert.equal(queries[0]?.board, "active");
  await view.unmount();
  while (restores.length) restores.pop()!();

  setExperimentOverride("leaderboard_default_board_v1", "trending_first");
  queries = stubLeaderboard();
  view = await renderScreen(LeaderboardScreen as never, { name: "Leaderboard" });
  assert.equal(queries[0]?.board, "trending");
  await view.press(view.findByText("Most active"));
  assert.equal(queries.at(-1)?.board, "active", "the diner's pick replaces the opening board");
});

test("the Activity bell shows a count, or a dot in the test arm, and logs the open", async () => {
  stubProfile();
  const unreadLike = {
    id: "ab-test-like",
    kind: "like" as const,
    postId: "post-1",
    actorName: "Mei",
    text: "liked your dish",
    target: "Chicken rice",
    time: "1m",
    unread: true,
  };
  useActivityStore.setState({ readActivityIds: [], activityUpdates: [unreadLike] });
  let view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  const bell = view.findByTestId("profile-activity-bell");
  assert.ok(bell);
  assert.ok(view.findByTestId("profile-activity-badge"), "a count by default");
  assert.equal(view.findByTestId("profile-activity-dot"), null);
  await view.press(bell);
  const opened = getTrackedAnalyticsEvents().find(
    (event) => event.event === "profile_item_opened" && event.properties.kind === "activity_bell",
  );
  assert.ok(opened, "the bell tap is the test's primary metric");
  await view.unmount();

  setExperimentOverride("activity_bell_badge_v1", "dot");
  useActivityStore.setState({ readActivityIds: [], activityUpdates: [unreadLike] });
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.ok(view.findByTestId("profile-activity-dot"));
  assert.equal(view.findByTestId("profile-activity-badge"), null);
  useActivityStore.setState({ activityUpdates: [] });
});
