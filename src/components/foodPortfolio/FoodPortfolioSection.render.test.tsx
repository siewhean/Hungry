// The Food Portfolio section on a profile (top picks, bests by dish type, the diary and its entry sheet; its data comes from the useFoodPortfolio hook), the Following feed screen, and the profile entry
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
import type {
  Bite,
  FoodPortfolioStall,
  PortfolioDiaryEntry,
  PortfolioPicks,
} from "@/lib/services/types";
import { notifyChoiceSheetClosed, useChoiceSheetStore } from "@/store/useChoiceSheetStore";
import { useUIStore } from "@/store/useUIStore";
import {
  cleanup,
  createFakeNavigation,
  render,
  renderScreen,
  type FakeNavigation,
} from "@/test/render";
import { resetWeeklyRanks } from "@/features/leaderboard/boardRanks";
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

function entry(post: Bite, overrides: Partial<PortfolioDiaryEntry> = {}): PortfolioDiaryEntry {
  return { post, visibility: "public", dishFoodType: "Laksa", pickKinds: [], ...overrides };
}

const DIARY = [
  entry(bite("a"), { pickKinds: ["overall"], dishFoodType: "Chicken Rice" }),
  entry(bite("b"), { pickKinds: ["overall", "dish_type"] }),
  entry(bite("c")),
  entry(bite("d"), { visibility: "private" }),
];
const PICKS: PortfolioPicks = {
  topThree: [
    { place: 1, post: bite("b") },
    { place: 2, post: bite("a") },
  ],
  bests: [{ foodType: "Laksa", post: bite("b") }],
};

function stubPortfolio({
  diary = DIARY,
  picks = PICKS,
  stalls = STALLS,
}: {
  diary?: PortfolioDiaryEntry[];
  picks?: PortfolioPicks;
  stalls?: FoodPortfolioStall[];
} = {}) {
  const service = getHungryService();
  const calls = {
    picks: [] as unknown[][],
    removed: [] as unknown[][],
    visibility: [] as unknown[][],
    diaryReads: 0,
    picksReads: 0,
  };
  stub(service.foodPortfolio, "getDiary", async () => {
    calls.diaryReads += 1;
    return diary;
  });
  stub(service.foodPortfolio, "getPicks", async () => {
    calls.picksReads += 1;
    return picks;
  });
  stub(service.foodPortfolio, "listStalls", async () => stalls);
  stub(service.foodPortfolio, "setPick", async (postId, kind, place) => {
    calls.picks.push([postId, kind, place]);
    return {
      kind,
      slot: kind === "overall" ? String(place) : "Laksa",
      postId,
      replacedPostId: kind === "overall" ? "a" : "b",
    };
  });
  stub(service.foodPortfolio, "removePick", async (postId, kind) => {
    calls.removed.push([postId, kind]);
    return 1;
  });
  stub(service.foodPortfolio, "setEntryVisibility", async (postId, visibility) => {
    calls.visibility.push([postId, visibility]);
    return visibility;
  });
  // Mei is 7th on this week's board; your own summary has no rank yet.
  stub(service.leaderboard, "getLeaderboard", async () => [
    { rank: 7, userId: OWNER, displayName: "Mei", score: 40, isMe: false },
  ]);
  stub(service.leaderboard, "getMySummary", async () => null);
  return calls;
}

/** Answers the open choice sheet and waits for the next step. */
async function answerChoice(view: { settle: () => Promise<void> }, id: string | null) {
  useChoiceSheetStore.getState().settle(id);
  notifyChoiceSheetClosed();
  await new Promise((resolve) => setTimeout(resolve, 120));
  await view.settle();
}

function sheet() {
  const request = useChoiceSheetStore.getState().request;
  return {
    title: request?.title,
    message: request?.message,
    labels: request?.options.map((option) => option.label) ?? [],
  };
}

beforeEach(async () => {
  await enterScenario("user");
  resetWeeklyRanks();
  flags.foodPortfolioEnabled = true;
  flags.activityEnabled = true;
  flags.followConnectionsEnabled = true;
  flags.socialFeedEnabled = false;
});

afterEach(async () => {
  await cleanup();
  useChoiceSheetStore.getState().settle(null);
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
});

test("another person's portfolio: top picks, bests, diary, stalls tab, taps open the post and stall", async () => {
  stubPortfolio({ diary: DIARY.filter((item) => item.visibility !== "private") });
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
  // Dishes, Stalls and Rank sit under the header; Rank opens the Leaderboard.
  assert.ok(view.findByLabel("Dishes 3"));
  assert.ok(view.findByLabel("Stalls 2"));
  await view.press(view.findByLabel("Rank #7"));
  assert.deepEqual(lastNavigate(navigation), ["Leaderboard"]);
  assert.equal(view.findByTestId("food-portfolio-top-empty-2"), null, "no slots to fill on theirs");
  assert.ok(view.findByText("Top picks"));
  assert.ok(view.findByTestId("food-portfolio-top-b"), "the first place leads the top picks");
  assert.ok(view.findByText("Bests"));
  assert.ok(view.findByText("Best laksa"));
  await view.press(view.findByTestId("food-portfolio-best-b"));
  assert.deepEqual(lastNavigate(navigation), ["ActivityPostDetail", { postId: "b" }]);
  assert.equal(view.findByText("Post a dish"), null, "no posting on someone else's portfolio");
  assert.equal(view.findByTestId("food-portfolio-edit"), null, "no editing someone else's picks");

  await view.press(view.findByTestId("food-portfolio-tile-c"));
  assert.deepEqual(lastNavigate(navigation), ["ActivityPostDetail", { postId: "c" }]);

  await view.press(view.findByLabel("Show stalls"));
  assert.ok(view.findByTestId("food-portfolio-stalls"));
  assert.ok(view.findByText("Hill Street"));
  assert.ok(view.findByText("1 dish"));
  await view.press(view.findByLabel("Tian Tian, 1 dish posted"));
  assert.deepEqual(lastNavigate(navigation), ["StallDetail", { venueId: "venue-2" }]);
});

test("your own portfolio: Only me shows a lock, Post a dish opens the composer, the share card leaves Only me out", async () => {
  stubPortfolio();
  const navigation = createFakeNavigation();
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: true,
      navigation,
    }),
  );
  assert.ok(view.findByText("My bests"));
  assert.ok(view.findByLabel("Dishes 4"), "your own diary counts Only me entries");
  assert.ok(view.findByLabel("Open Dish d at Hill Street, Only me"));
  await view.press(view.findByTestId("food-portfolio-post"));
  assert.deepEqual(lastNavigate(navigation), ["Post"]);
  // Not on the board yet: the Rank stat shows a dash.
  assert.ok(view.findByLabel("Rank, unavailable"));
  // Two of three places filled: the third is a dotted slot that starts choosing.
  await view.press(view.findByTestId("food-portfolio-top-empty-2"));
  assert.ok(view.findByTestId("food-portfolio-edit-bar"));
  await view.press(view.findByLabel("Done choosing"));
  assert.equal(view.findByTestId("food-portfolio-edit-bar"), null);
});

test("Edit: make an entry your best of its dish type, naming the dish it replaces", async () => {
  const calls = stubPortfolio();
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: true,
      navigation: createFakeNavigation(),
    }),
  );
  const picksBefore = calls.picksReads;
  await view.press(view.findByLabel("Edit your picks"));
  await view.press(view.findByLabel("Choose for Dish c"));
  assert.deepEqual(sheet(), {
    title: "Dish c at Hill Street",
    message: "It replaces Dish b at Hill Street, which stays in your diary.",
    labels: ["Make this my best laksa", "Put in my top three", "Make it Only me"],
  });
  await answerChoice(view, "best");
  assert.deepEqual(calls.picks, [["c", "dish_type", undefined]]);
  assert.ok(calls.picksReads > picksBefore, "the picks are read again");
  assert.ok(view.findByTestId("food-portfolio-tile-b"), "the old best stays in the diary");
});

test("Edit: put an entry in the top three at a place that names what it replaces, and take one out", async () => {
  const calls = stubPortfolio();
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: true,
      navigation: createFakeNavigation(),
    }),
  );
  await view.press(view.findByLabel("Edit your picks"));
  await view.press(view.findByLabel("Choose for Dish c"));
  await answerChoice(view, "top_three");
  assert.deepEqual(sheet().labels, [
    "#1, replaces Dish b at Hill Street",
    "#2, replaces Dish a at Hill Street",
    "#3",
  ]);
  await answerChoice(view, "2");
  assert.deepEqual(calls.picks, [["c", "overall", 2]]);

  // b is your best laksa and #1: its sheet offers to undo both.
  await view.press(view.findByLabel("Choose for Dish b"));
  assert.deepEqual(sheet().labels, [
    "Stop being my best laksa",
    "Move in my top three",
    "Take out of my top three",
    "Make it Only me",
  ]);
  await answerChoice(view, "remove_top_three");
  assert.deepEqual(calls.removed, [["b", "overall"]]);
});

test("Edit: Only me and back to public; an Only me entry offers no picks", async () => {
  const calls = stubPortfolio();
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: true,
      navigation: createFakeNavigation(),
    }),
  );
  await view.press(view.findByLabel("Edit your picks"));
  await view.press(view.findByLabel("Choose for Dish d"));
  assert.deepEqual(sheet().labels, ["Make it public"]);
  await answerChoice(view, "public");
  await view.press(view.findByLabel("Choose for Dish c"));
  await answerChoice(view, "private");
  assert.deepEqual(calls.visibility, [
    ["d", "public"],
    ["c", "private"],
  ]);
  await view.press(view.findByLabel("Done choosing"));
  assert.ok(view.findByLabel("Open Dish c at Hill Street, Only me"));
  assert.ok(view.findByLabel("Open Dish d at Hill Street"));
});

test("a refused change shows an error and leaves the entry as it was", async () => {
  stubPortfolio();
  stub(getHungryService().foodPortfolio, "setEntryVisibility", async () => {
    throw new Error("rate limited");
  });
  const view = await render(
    createElement(FoodPortfolioSection, {
      userId: OWNER,
      ownerName: "Mei",
      isSelf: true,
      navigation: createFakeNavigation(),
    }),
  );
  await view.press(view.findByLabel("Edit your picks"));
  await view.press(view.findByLabel("Choose for Dish c"));
  await answerChoice(view, "private");
  assert.equal(useUIStore.getState().toast?.message, "Couldn't save that. Try again.");
  await view.press(view.findByLabel("Done choosing"));
  assert.ok(view.findByLabel("Open Dish c at Hill Street"));
});

test("an empty own portfolio invites the first post; an empty other one says so", async () => {
  stubPortfolio({ diary: [], picks: { topThree: [], bests: [] }, stalls: [] });
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
  assert.equal(view.findByTestId("food-portfolio-bests"), null);
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

test("a failed diary read shows Retry and reads again", async () => {
  const service = getHungryService();
  let reads = 0;
  stub(service.foodPortfolio, "getDiary", async () => {
    reads += 1;
    if (reads === 1) throw new Error("offline");
    return [entry(bite("a"))];
  });
  stub(service.foodPortfolio, "getPicks", async () => ({ topThree: [], bests: [] }));
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
  assert.equal(calls.diaryReads, 0);
});

test("own Profile shows the Food Portfolio only with the flag; Followers opens People", async () => {
  stubPortfolio();
  stub(getHungryService().social, "getFollowCounts", async () => ({
    followersCount: 1,
    followingCount: 2,
  }));
  let view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.ok(view.findByTestId("food-portfolio-section"));
  assert.equal(view.findByTestId("profile-following-feed-row"), null, "the Feed lives in People");
  await view.press(view.findByLabel("Follower 1"));
  assert.ok(
    view.navigation.calls.some(
      (call) => call.method === "navigate" && call.args[0] === "Followers",
    ),
  );
  await view.unmount();

  flags.foodPortfolioEnabled = false;
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("food-portfolio-section"), null);
});

test("Following feed: tiles open the post and the author, grouped by day, Load more pages from the last post", async () => {
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
  await view.press(view.findByLabel("Open Ahmad's Food Portfolio"));
  assert.equal(lastNavigate(view.navigation)?.[0], "UserProfile");
  // The FollowingFeed route is your own People, on its Feed tab, with the posts under a day.
  assert.ok(view.findByTestId("people-screen"));
  assert.ok(view.findByText("Feed"));
  assert.ok(view.findByTestId("following-feed-day-2026-11-6"));

  await view.press(view.findByText("Load more"));
  assert.deepEqual(pages[1], {
    limit: 20,
    cursor: { createdAt: firstPage[19].createdAt, postId: "p19" },
  });
  assert.ok(view.findByTestId("following-feed-post-p20"));
});

test("Following feed with nobody followed offers Find people on the Following tab", async () => {
  stub(getHungryService().foodPortfolio, "getFollowingFeed", async () => []);
  const view = await renderScreen(FollowingFeedScreen as never, { name: "FollowingFeed" });
  assert.ok(view.findByText("Follow someone to see their dishes"));
  assert.ok(view.findByTestId("following-feed-empty-art"));
  await view.press(view.findByText("Find people"));
  assert.equal(view.findByTestId("following-feed"), null, "left the Feed tab");
  assert.ok(view.findByLabel("Search following"));
});

test("Following feed from a stall page shows only that stall's dishes, and the chip clears it", async () => {
  stub(getHungryService().foodPortfolio, "getFollowingFeed", async () => [
    bite("x1", { venueId: "venue-1", venueName: "Hill Street" }),
    bite("x2", { venueId: "venue-2", venueName: "Tian Tian" }),
  ]);
  const view = await renderScreen(FollowingFeedScreen as never, {
    name: "FollowingFeed",
    params: { venueId: "venue-2", venueName: "Tian Tian" },
  });
  assert.ok(view.findByTestId("following-feed-post-x2"));
  assert.equal(view.findByTestId("following-feed-post-x1"), null);
  await view.press(view.findByLabel("Showing dishes at Tian Tian. Show all dishes"));
  assert.ok(view.findByTestId("following-feed-post-x1"));
});
