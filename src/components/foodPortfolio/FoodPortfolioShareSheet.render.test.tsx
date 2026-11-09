// Food Portfolio PR C on screen: the Portfolio and Rank share cards, and the Activity bell
// (ActivityBellButton) on your
// own Profile. Run with
// `node scripts/test-render.mjs src/components/foodPortfolio/FoodPortfolioShareSheet.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { LeaderboardScreen } from "@/app/screens/profile/LeaderboardScreen";
import { ProfileHomeScreen } from "@/app/screens/profile/ProfileHomeScreen";
import { FoodPortfolioSection } from "@/components/foodPortfolio/FoodPortfolioSection";
import { FoodPortfolioShareCard } from "@/components/foodPortfolio/FoodPortfolioShareSheet";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import {
  clearTrackedAnalyticsEvents,
  getTrackedAnalyticsEvents,
} from "@/lib/analytics/mockAnalytics";
import { setShareCardNativeForTests, type ShareCardNative } from "@/features/share/shareCardImage";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite, LeaderboardSummary } from "@/lib/services/types";
import { cleanup, createFakeNavigation, render, renderScreen } from "@/test/render";
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

const OWNER = "22222222-2222-4222-8222-222222222222";

function bite(id: string): Bite {
  return {
    id,
    authorId: OWNER,
    authorName: "Mei",
    dishId: `dish-${id}`,
    dishName: `Dish ${id}`,
    venueId: "venue-1",
    venueName: "Hill Street",
    unitNumber: "",
    buildingId: "b1",
    buildingName: "Chinatown Complex",
    // No photo, so the card is ready to share at once (image loads never fire in tests).
    photoUrl: "",
    caption: "",
    tags: [],
    cravingCount: 0,
    savedCount: 0,
    rating: 0,
    price: 0,
    expiresAt: "2026-11-06T10:00:00Z",
    createdAt: "2026-11-06T10:00:00Z",
  } as unknown as Bite;
}

const SUMMARY: LeaderboardSummary = {
  totalPoints: 85,
  weekPoints: 23,
  activeWeekRank: 4,
  activeAllRank: 12,
  trendingRank: null,
  creditedPostsToday: 2,
  dailyCap: 6,
};

function fakeNative() {
  const captured: { width: number; height: number; format: string }[] = [];
  const shared: string[] = [];
  const native: ShareCardNative = {
    captureRef: async (_target, options) => {
      captured.push({ width: options.width, height: options.height, format: options.format });
      return `file:///tmp/card.${options.format}`;
    },
    isAvailableAsync: async () => true,
    shareAsync: async (url) => {
      shared.push(url);
    },
  };
  return { native, captured, shared };
}

const events = (name: string) =>
  getTrackedAnalyticsEvents().filter((event) => event.event === name);

function stubPortfolio() {
  const service = getHungryService();
  stub(service.social, "listUserPosts", async () => [bite("a"), bite("b"), bite("c")]);
  stub(service.foodPortfolio, "getTopPosts", async () => ({ posts: [], pinnedPostIds: [] }));
  stub(service.foodPortfolio, "listStalls", async () => [
    { venueId: "venue-1", venueName: "Hill Street", dishCount: 3 },
  ]);
}

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
  flags.foodPortfolioEnabled = true;
  flags.activityEnabled = true;
  flags.followConnectionsEnabled = true;
  flags.socialFeedEnabled = false;
});

afterEach(async () => {
  await cleanup();
  setShareCardNativeForTests(undefined);
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
});

test("the cards print the owner, the grid or the rank, and the Hungry address", async () => {
  let view = await render(
    createElement(FoodPortfolioShareCard, {
      card: {
        kind: "portfolio",
        ownerId: OWNER,
        ownerName: "Mei",
        photos: [],
        statLine: "3 dishes · 1 stall",
      },
    }),
  );
  assert.match(view.text(), /My Food Portfolio/);
  assert.match(view.text(), /Mei/);
  assert.match(view.text(), /3 dishes · 1 stall/);
  assert.match(view.text(), /Follow me on Hungry · usehungry\.com/);
  await view.unmount();

  view = await render(
    createElement(FoodPortfolioShareCard, {
      card: {
        kind: "rank",
        ownerId: OWNER,
        ownerName: "Mei",
        rank: {
          rank: 4,
          period: "week",
          headline: "#4",
          periodLabel: "this week",
          detail: "Most active · 23 pts",
        },
      },
    }),
  );
  assert.match(view.text(), /Hungry leaderboard/);
  assert.match(view.text(), /#4/);
  assert.match(view.text(), /on the board this week/);
  assert.match(view.text(), /Most active · 23 pts/);
});

test("your own portfolio shares a Story picture; someone else's has no Share", async () => {
  stubPortfolio();
  const { native, captured, shared } = fakeNative();
  setShareCardNativeForTests(native);
  const navigation = createFakeNavigation();
  let view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: true,
      navigation,
    }),
  );
  await view.press(view.findByTestId("food-portfolio-share"));
  assert.ok(view.findByTestId("food-portfolio-share-sheet"));
  assert.ok(view.findByText("Share your Food Portfolio"));
  assert.match(view.text(), /3 dishes · 1 stall/);
  await view.press(view.findByTestId("food-portfolio-share-button"));
  assert.equal(captured.length, 1);
  assert.equal(captured[0].format, "jpg");
  assert.equal(shared.length, 1);
  const sent = events("food_portfolio_card_shared");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].properties, { kind: "portfolio", as: "picture" });
  await view.press(view.findByLabel("Close"));
  assert.equal(view.findByTestId("food-portfolio-share-sheet"), null);
  await view.unmount();

  view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: false,
      navigation,
    }),
  );
  assert.equal(view.findByTestId("food-portfolio-share"), null);
});

test("Share my rank appears once you are ranked and shares the Rank card", async () => {
  const service = getHungryService();
  stub(service.leaderboard, "getLeaderboard", async () => []);
  stub(service.leaderboard, "getMySummary", async () => SUMMARY);
  stub(service.leaderboard, "listMyPoints", async () => []);
  const { native, captured } = fakeNative();
  setShareCardNativeForTests(native);
  const view = await renderScreen(LeaderboardScreen as never, { name: "Leaderboard" });
  await view.press(view.findByTestId("leaderboard-share-rank"));
  assert.ok(view.findByText("Share your rank"));
  assert.match(view.text(), /#4/);
  assert.match(view.text(), /Most active · 23 pts/);
  await view.press(view.findByTestId("food-portfolio-share-button"));
  assert.equal(captured.length, 1);
  assert.equal(events("food_portfolio_card_shared")[0]?.properties.kind, "rank");
});

test("no Share my rank before you are on the board", async () => {
  const service = getHungryService();
  stub(service.leaderboard, "getLeaderboard", async () => []);
  stub(service.leaderboard, "getMySummary", async () => ({
    ...SUMMARY,
    activeWeekRank: null,
    activeAllRank: null,
  }));
  stub(service.leaderboard, "listMyPoints", async () => []);
  const view = await renderScreen(LeaderboardScreen as never, { name: "Leaderboard" });
  assert.ok(view.findByTestId("leaderboard-summary"));
  assert.equal(view.findByTestId("leaderboard-share-rank"), null);
});

test("own Profile shows the Activity bell with the Food Portfolio on, and it opens Updates", async () => {
  stubPortfolio();
  const service = getHungryService();
  stub(service.social, "getFollowCounts", async () => ({ followersCount: 0, followingCount: 0 }));
  let view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  await view.press(view.findByTestId("profile-activity-bell"));
  assert.ok(
    view.navigation.calls.some(
      (call) =>
        call.method === "navigate" &&
        call.args[0] === "ActivityInbox" &&
        (call.args[1] as { initialTab?: string })?.initialTab === "updates",
    ),
  );
  await view.unmount();

  flags.foodPortfolioEnabled = false;
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("profile-activity-bell"), null);
  await view.unmount();

  flags.foodPortfolioEnabled = true;
  flags.socialFeedEnabled = true;
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("profile-activity-bell"), null, "Home's bell covers it");
});
