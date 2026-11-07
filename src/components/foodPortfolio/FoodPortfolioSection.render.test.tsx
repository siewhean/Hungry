// The Food Portfolio section on a profile (its data comes from the useFoodPortfolio hook), the Following feed screen, and the profile entry
// points, rendered and pressed against stubbed service reads.
// Run with `node scripts/test-render.mjs src/components/foodPortfolio/FoodPortfolioSection.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { FollowingFeedScreen } from "@/app/screens/profile/FollowingFeedScreen";
import { ProfileHomeScreen } from "@/app/screens/profile/ProfileHomeScreen";
import { FoodPortfolioSection } from "@/components/foodPortfolio/FoodPortfolioSection";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite, FoodPortfolioStall } from "@/lib/services/types";
import {
  cleanup,
  createFakeNavigation,
  render,
  renderScreen,
  type FakeNavigation,
} from "@/test/render";
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

/** The arguments of the last navigate() call. */
function lastNavigate(navigation: FakeNavigation) {
  return navigation.calls.filter((call) => call.method === "navigate").at(-1)?.args;
}

const OWNER = "22222222-2222-4222-8222-222222222222";

function bite(id: string, overrides: Partial<Bite> = {}): Bite {
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
    photoUrl: `https://example.com/${id}.jpg`,
    caption: `Caption ${id}`,
    tags: [],
    cravingCount: 0,
    savedCount: 0,
    rating: 0,
    price: 0,
    expiresAt: "2026-11-06T10:00:00Z",
    createdAt: "2026-11-06T10:00:00Z",
    ...overrides,
  } as Bite;
}

const STALLS: FoodPortfolioStall[] = [
  { venueId: "venue-1", venueName: "Hill Street", buildingName: "Chinatown Complex", dishCount: 2 },
  { venueId: "venue-2", venueName: "Tian Tian", dishCount: 1 },
];

function stubPortfolio({
  posts = [bite("a"), bite("b"), bite("c"), bite("d")],
  top = { posts: [bite("b"), bite("a")], pinnedPostIds: ["b"] },
  stalls = STALLS,
}: {
  posts?: Bite[];
  top?: { posts: Bite[]; pinnedPostIds: string[] };
  stalls?: FoodPortfolioStall[];
} = {}) {
  const service = getHungryService();
  const calls = { pins: [] as string[][], postReads: 0 };
  stub(service.social, "listUserPosts", async () => {
    calls.postReads += 1;
    return posts;
  });
  stub(service.foodPortfolio, "getTopPosts", async () => top);
  stub(service.foodPortfolio, "listStalls", async () => stalls);
  stub(service.foodPortfolio, "setPinnedPosts", async (ids: string[]) => {
    calls.pins.push(ids);
    return ids;
  });
  return calls;
}

beforeEach(async () => {
  await enterScenario("user");
  flags.foodPortfolioEnabled = true;
  flags.activityEnabled = true;
  flags.followConnectionsEnabled = true;
  flags.socialFeedEnabled = false;
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
});

test("another person's portfolio: top three, dish grid, stalls tab, taps open the post and stall", async () => {
  stubPortfolio();
  const navigation = createFakeNavigation();
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: false,
      navigation,
    }),
  );
  assert.ok(view.findByText("Food Portfolio"));
  assert.equal(view.findByTestId("food-portfolio-count")?.textContent, "4 dishes");
  assert.ok(view.findByTestId("food-portfolio-top-three"));
  assert.ok(view.findByTestId("food-portfolio-top-b"), "the pinned dish leads the top three");
  assert.equal(view.findByText("Post a dish"), null, "no posting on someone else's portfolio");
  assert.equal(view.findByLabel("Edit top three"), null);

  await view.press(view.findByTestId("food-portfolio-tile-c"));
  assert.deepEqual(lastNavigate(navigation), ["ActivityPostDetail", { postId: "c" }]);

  await view.press(view.findByLabel("Show stalls"));
  assert.ok(view.findByTestId("food-portfolio-stalls"));
  assert.ok(view.findByText("Hill Street"));
  assert.ok(view.findByText("1 dish"));
  await view.press(view.findByLabel("Tian Tian, 1 dish posted"));
  assert.deepEqual(lastNavigate(navigation), ["StallDetail", { venueId: "venue-2" }]);
});

test("your own portfolio: Post a dish opens the composer and Edit top three saves the picks in order", async () => {
  const calls = stubPortfolio();
  const navigation = createFakeNavigation();
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: true,
      navigation,
    }),
  );
  await view.press(view.findByText("Post a dish"));
  assert.deepEqual(lastNavigate(navigation), ["Post"]);

  await view.press(view.findByLabel("Edit top three"));
  assert.ok(view.findByTestId("food-portfolio-pin-bar"));
  // The current pin (b) starts selected; tap it off, then pick d and a.
  await view.press(view.findByLabel("Unpin Dish b"));
  await view.press(view.findByLabel("Pin Dish d"));
  await view.press(view.findByLabel("Pin Dish a"));
  await view.press(view.findByText("Save"));
  assert.deepEqual(calls.pins, [["d", "a"]]);
  assert.equal(view.findByTestId("food-portfolio-pin-bar"), null, "back to the portfolio");
});

test("an empty own portfolio invites the first post; an empty other one says so", async () => {
  stubPortfolio({ posts: [], top: { posts: [], pinnedPostIds: [] }, stalls: [] });
  const navigation = createFakeNavigation();
  let view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: true,
      navigation,
    }),
  );
  assert.ok(view.findByText("Post your first dish"));
  assert.equal(view.findByTestId("food-portfolio-top-three"), null);
  await view.unmount();

  view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: false,
      navigation,
    }),
  );
  assert.ok(view.findByText("No dishes yet"));
  assert.ok(view.findByText("Mei hasn't posted a dish yet."));
});

test("a failed dish read shows Retry and reads again", async () => {
  const service = getHungryService();
  let reads = 0;
  stub(service.social, "listUserPosts", async () => {
    reads += 1;
    if (reads === 1) throw new Error("offline");
    return [bite("a")];
  });
  stub(service.foodPortfolio, "getTopPosts", async () => ({ posts: [], pinnedPostIds: [] }));
  stub(service.foodPortfolio, "listStalls", async () => []);
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: false,
      navigation: createFakeNavigation(),
    }),
  );
  assert.ok(view.findByText("Couldn't load dishes"));
  await view.press(view.findByText("Retry"));
  assert.ok(view.findByTestId("food-portfolio-tile-a"));
});

test("with the Food Portfolio off the section renders nothing and reads nothing", async () => {
  flags.foodPortfolioEnabled = false;
  const calls = stubPortfolio();
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: false,
      navigation: createFakeNavigation(),
    }),
  );
  assert.equal(view.findByTestId("food-portfolio-section"), null);
  assert.equal(calls.postReads, 0);
});

test("own Profile shows the Food Portfolio and the Following row only with the flag", async () => {
  stubPortfolio();
  stub(getHungryService().social, "getFollowCounts", async () => ({
    followersCount: 1,
    followingCount: 2,
  }));
  let view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.ok(view.findByTestId("food-portfolio-section"));
  await view.press(view.findByTestId("profile-following-feed-row"));
  assert.ok(
    view.navigation.calls.some(
      (call) => call.method === "navigate" && call.args[0] === "FollowingFeed",
    ),
    "opens the Following feed",
  );
  await view.unmount();

  flags.foodPortfolioEnabled = false;
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("food-portfolio-section"), null);
  assert.equal(view.findByTestId("profile-following-feed-row"), null);
});

test("Following feed: rows open the post and the author, Load more pages from the last post", async () => {
  const pages: unknown[] = [];
  const firstPage = Array.from({ length: 20 }, (_, index) =>
    bite(`p${index}`, { authorId: "author-1", authorName: "Ahmad" }),
  );
  stub(getHungryService().foodPortfolio, "getFollowingFeed", async (page) => {
    pages.push(page);
    return pages.length === 1 ? firstPage : [bite("p20", { authorName: "Ahmad" })];
  });
  const view = await renderScreen(FollowingFeedScreen as never, { name: "FollowingFeed" });
  assert.ok(view.findByTestId("following-feed-post-p0"));
  await view.press(view.findByLabel("Open Dish p0 at Hill Street"));
  assert.deepEqual(lastNavigate(view.navigation), ["ActivityPostDetail", { postId: "p0" }]);
  await view.press(
    view.findByTestId("following-feed-post-p1")?.querySelector("[role=button]") as HTMLElement,
  );
  assert.equal(lastNavigate(view.navigation)?.[0], "UserProfile");

  await view.press(view.findByText("Load more"));
  assert.deepEqual(pages[1], {
    limit: 20,
    cursor: { createdAt: firstPage[19].createdAt, postId: "p19" },
  });
  assert.ok(view.findByTestId("following-feed-post-p20"));
});

test("Following feed with nobody followed offers Find people", async () => {
  stub(getHungryService().foodPortfolio, "getFollowingFeed", async () => []);
  const view = await renderScreen(FollowingFeedScreen as never, { name: "FollowingFeed" });
  assert.ok(view.findByText("No dishes yet"));
  await view.press(view.findByText("Find people"));
  assert.deepEqual(lastNavigate(view.navigation), [
    "MainTabs",
    { screen: "Profile", params: { screen: "Following" } },
  ]);
});
