// People (ProfileConnectionsScreen): Followers, Following and Feed tabs with counts, the follow
// requests banner, taste match and this week's rank on each row, and Best match sorting. Run with
// `node scripts/test-render.mjs src/app/screens/profile/People.render.test.tsx`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import {
  FollowersScreen,
  FollowingScreen,
  peopleTabLabel,
  personSubtitle,
} from "@/app/screens/profile/ProfileConnectionsScreen";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { resetWeeklyRanks } from "@/features/leaderboard/boardRanks";
import { getHungryService } from "@/lib/services/serviceProvider";
import { cleanup, renderScreen } from "@/test/render";
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

function stubPeople({ requests = 0 }: { requests?: number } = {}) {
  const social = getHungryService().social;
  stub(social, "listFollowing", async () => [
    { userId: "f1", displayName: "Mei" },
    { userId: "f2", displayName: "Arun" },
    { userId: "f3", displayName: "Lin" },
  ]);
  stub(social, "listFollowers", async () => [{ userId: "f9", displayName: "Siti" }]);
  stub(social, "getFollowCounts", async () => ({ followersCount: 12, followingCount: 3 }));
  stub(social, "getFollowRequestCount", async () => requests);
  stub(social, "getTasteMatches", async () => ({ f1: 40, f2: 91 }));
  stub(social, "listPeopleSuggestions", async () => []);
  stub(getHungryService().leaderboard, "getLeaderboard", async () => [
    { rank: 4, userId: "f2", displayName: "Arun", score: 50, isMe: false },
    { rank: 80, userId: "f1", displayName: "Mei", score: 3, isMe: false },
  ]);
  stub(getHungryService().foodPortfolio, "getFollowingFeed", async () => []);
}

beforeEach(async () => {
  await enterScenario("user");
  resetWeeklyRanks();
  flags.foodPortfolioEnabled = true;
  flags.followConnectionsEnabled = true;
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
});

test("labels: counts in the tabs, taste match and a top-50 rank on the row", () => {
  assert.equal(peopleTabLabel("Followers", 12), "Followers 12");
  assert.equal(peopleTabLabel("Following", null), "Following");
  assert.equal(personSubtitle(91, 4), "91% · Great match · #4 this week");
  assert.equal(personSubtitle(undefined, 80), undefined, "below 50 there is no chip");
  assert.equal(personSubtitle(undefined, 7), "#7 this week");
});

test("your People: one screen, three tabs with counts, best match first, ranks on rows", async () => {
  stubPeople();
  const view = await renderScreen(FollowingScreen as never, { name: "Following" });
  assert.ok(view.findByText("People"), "the header is the title alone");
  assert.ok(view.findByText("Followers 12"));
  assert.ok(view.findByText("Following 3"));
  assert.ok(view.findByText("Feed"));
  assert.match(view.text(), /91% · Great match · #4 this week/);

  // Best match first: Arun (91) before Mei (40) before Lin (no score).
  const order = ["Arun", "Mei", "Lin"].map((name) => view.text().indexOf(name));
  assert.ok(order[0] < order[1] && order[1] < order[2], "sorted by taste match");
  await view.press(view.findByText("Newest"));
  const newest = ["Mei", "Arun", "Lin"].map((name) => view.text().indexOf(name));
  assert.ok(newest[0] < newest[1] && newest[1] < newest[2], "the server's order");

  await view.press(view.findByText("Followers 12"));
  assert.ok(view.findByText("Siti"));
  assert.equal(view.findByText("Lin"), null);

  await view.press(view.findByText("Feed"));
  assert.ok(view.findByTestId("following-feed"));
});

test("pending follow requests show as a banner that opens them", async () => {
  stubPeople({ requests: 2 });
  const view = await renderScreen(FollowersScreen as never, { name: "Followers" });
  await view.press(view.findByTestId("people-requests-banner"));
  assert.ok(view.findByText("2 follow requests"));
  assert.ok(
    view.navigation.calls.some(
      (call) => call.method === "navigate" && call.args[0] === "FollowRequests",
    ),
  );
});

test("someone else's lists: their name as the title and no Feed tab", async () => {
  stubPeople({ requests: 5 });
  stub(getHungryService().social, "canViewFollowLists", async () => true);
  const view = await renderScreen(FollowersScreen as never, {
    name: "UserFollowers",
    params: { userId: "33333333-3333-4333-8333-333333333333", userDisplayName: "Ahmad" },
  });
  assert.ok(view.findByText("Ahmad"));
  assert.equal(view.findByText("Feed"), null);
  assert.equal(view.findByTestId("people-requests-banner"), null);
});

test("FollowingFeedList on its own: day groups, a stall filter chip that clears, avatar to profile", async () => {
  const { createElement } = await import("react");
  const { FollowingFeedList } = await import("@/components/social/FollowingFeedList");
  const { createFakeNavigation, render } = await import("@/test/render");
  stub(getHungryService().foodPortfolio, "getFollowingFeed", async () => {
    return [
      {
        id: "p1",
        authorId: "f1",
        authorName: "Mei",
        dishId: "d1",
        dishName: "Laksa",
        venueId: "venue-1",
        venueName: "Hill Street",
        photoUrl: "https://example.com/p1.jpg",
        caption: "",
        tags: [],
        createdAt: new Date().toISOString(),
      } as never,
    ];
  });
  let cleared = 0;
  const navigation = createFakeNavigation();
  const view = await render(
    createElement(FollowingFeedList, {
      navigation: navigation as never,
      venueId: "venue-1",
      venueName: "Hill Street",
      onClearVenue: () => (cleared += 1),
      onFindPeople: () => undefined,
    }),
  );
  await view.settle();
  assert.ok(view.findByText("Today"));
  await view.press(view.findByLabel("Showing dishes at Hill Street. Show all dishes"));
  assert.equal(cleared, 1);
  await view.press(view.findByLabel("Open Mei's Food Portfolio"));
  const opened = navigation.calls.filter((call) => call.method === "navigate").at(-1)?.args;
  assert.equal(opened?.[0], "UserProfile");
});
