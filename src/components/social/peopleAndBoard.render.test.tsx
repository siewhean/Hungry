// People in Discover search, Home's weekly board card and the stall page's "posted here" row.
// Run with `node scripts/test-render.mjs src/components/social/peopleAndBoard.render.test.tsx`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { WeeklyBoardCard, shouldShowWeeklyBoard } from "@/components/discover/home/WeeklyBoardCard";
import { PeopleSearchResults } from "@/components/social/PeopleSearchResults";
import {
  FollowsPostedHere,
  postedHereLabel,
  postersAt,
} from "@/components/stall/FollowsPostedHere";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite, LeaderboardSummary } from "@/lib/services/types";
import { useSocialStore } from "@/store/useSocialStore";
import { cleanup, render } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

beforeEach(async () => {
  await enterScenario("user");
  useSocialStore.setState({ followedUserIds: {}, requestedUserIds: {} });
});
afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
});

/** Waits past the search debounce, then lets the mock service settle. */
async function afterDebounce(view: { settle(): Promise<void> }) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  await view.settle();
}

function bite(id: string, overrides: Partial<Bite> = {}): Bite {
  return {
    id,
    authorId: "u-mei",
    authorName: "Mei",
    dishId: `dish-${id}`,
    dishName: `Dish ${id}`,
    venueId: "venue-1",
    venueName: "Hill Street",
    photoUrl: `https://example.com/${id}.jpg`,
    caption: "",
    tags: [],
    createdAt: "2026-11-06T10:00:00Z",
    ...overrides,
  } as Bite;
}

const SUMMARY: LeaderboardSummary = {
  totalPoints: 60,
  weekPoints: 25,
  activeWeekRank: 5,
  activeAllRank: 9,
  trendingRank: null,
  creditedPostsToday: 1,
  dailyCap: 6,
};

// ─── People in search ────────────────────────────────────────────────────────

test("PeopleSearchResults lists up to three matching people with a Follow pill", async () => {
  const queries: string[] = [];
  stub(getHungryService().social, "searchProfiles", async (query: string) => {
    queries.push(query);
    return [
      { userId: "u-1", displayName: "Mei Tan" },
      { userId: "u-2", displayName: "Mei Ling" },
      { userId: "u-3", displayName: "Meiyi" },
      { userId: "u-4", displayName: "Meilan" },
    ];
  });
  const opened: string[] = [];
  const view = await render(
    createElement(PeopleSearchResults, {
      query: "mei",
      enabled: true,
      onOpen: (person) => opened.push(person.userId),
    }),
  );
  await afterDebounce(view);
  assert.deepEqual(queries, ["mei"]);
  assert.ok(view.findByTestId("search-people-results"));
  assert.ok(view.findByLabel("Follow Mei Tan"));
  assert.equal(view.findByLabel("Open Meilan's Food Portfolio"), null, "three at most");
  await view.press(view.findByLabel("Open Mei Ling's Food Portfolio"));
  assert.deepEqual(opened, ["u-2"]);
});

test("PeopleSearchResults stays hidden when off, for one letter, or when nobody matches", async () => {
  let calls = 0;
  stub(getHungryService().social, "searchProfiles", async () => {
    calls += 1;
    return [];
  });
  const view = await render(
    createElement(PeopleSearchResults, { query: "mei", enabled: false, onOpen: () => undefined }),
  );
  await afterDebounce(view);
  await view.rerender(
    createElement(PeopleSearchResults, { query: "m", enabled: true, onOpen: () => undefined }),
  );
  await afterDebounce(view);
  assert.equal(calls, 0);
  await view.rerender(
    createElement(PeopleSearchResults, { query: "zz", enabled: true, onOpen: () => undefined }),
  );
  await afterDebounce(view);
  assert.equal(calls, 1);
  assert.equal(view.findByTestId("search-people-results"), null);
});

// ─── Home weekly board ───────────────────────────────────────────────────────

test("shouldShowWeeklyBoard waits for a board and a follow or points of your own", () => {
  const rows = [{ rank: 1, userId: "a", displayName: "A", score: 30, isMe: false }];
  assert.equal(shouldShowWeeklyBoard(1, null, []), false);
  assert.equal(shouldShowWeeklyBoard(0, null, rows), false);
  assert.equal(shouldShowWeeklyBoard(1, null, rows), true);
  assert.equal(shouldShowWeeklyBoard(0, SUMMARY, rows), true);
});

test("WeeklyBoardCard shows your rank and opens the Leaderboard; before a post it invites one", async () => {
  const leaderboard = getHungryService().leaderboard;
  stub(leaderboard, "getLeaderboard", async () => [
    { rank: 1, userId: "a", displayName: "Arun", score: 40, isMe: false },
    { rank: 2, userId: "b", displayName: "Bee", score: 30, isMe: false },
  ]);
  let summary: LeaderboardSummary | null = SUMMARY;
  stub(leaderboard, "getMySummary", async () => summary);
  let opened = 0;
  const view = await render(
    createElement(WeeklyBoardCard, { enabled: true, followCount: 1, onOpen: () => (opened += 1) }),
  );
  await view.settle();
  assert.ok(view.findByTestId("home-weekly-board"));
  assert.match(view.text(), /You #5 · 25 pts this week/);
  await view.press(view.findByTestId("home-weekly-board"));
  assert.equal(opened, 1);
  await view.unmount();

  summary = null;
  const fresh = await render(
    createElement(WeeklyBoardCard, { enabled: true, followCount: 1, onOpen: () => undefined }),
  );
  await fresh.settle();
  assert.match(fresh.text(), /Post a dish to join/);
  assert.ok(fresh.findByTestId("home-weekly-board-art"));
});

test("WeeklyBoardCard shows nothing while off", async () => {
  const view = await render(
    createElement(WeeklyBoardCard, { enabled: false, followCount: 3, onOpen: () => undefined }),
  );
  await view.settle();
  assert.equal(view.findByTestId("home-weekly-board"), null);
});

// ─── Stall page: people you follow posted here ───────────────────────────────

test("postersAt keeps each person once, for this stall only, and postedHereLabel reads well", () => {
  const posts = [
    bite("1"),
    bite("2"),
    bite("3", { authorId: "u-arun", authorName: "Arun" }),
    bite("4", { authorId: "u-bee", authorName: "Bee", venueId: "venue-2" }),
  ];
  const people = postersAt(posts, "venue-1");
  assert.deepEqual(
    people.map((person) => person.name),
    ["Mei", "Arun"],
  );
  assert.equal(postedHereLabel([]), "");
  assert.equal(postedHereLabel(people.slice(0, 1)), "Mei posted here");
  assert.equal(postedHereLabel(people), "Mei and Arun posted here");
  assert.equal(
    postedHereLabel([...people, { userId: "x", name: "Xin" }]),
    "Mei and 2 others you follow posted here",
  );
});

test("FollowsPostedHere reads one feed page, shows who posted here and opens the feed", async () => {
  const limits: (number | undefined)[] = [];
  stub(getHungryService().foodPortfolio, "getFollowingFeed", async (page) => {
    limits.push(page?.limit);
    return [bite("1"), bite("2", { authorId: "u-arun", authorName: "Arun" })];
  });
  let opened = 0;
  const view = await render(
    createElement(FollowsPostedHere, {
      venueId: "venue-1",
      enabled: true,
      onOpen: () => (opened += 1),
    }),
  );
  await view.settle();
  assert.deepEqual(limits, [50]);
  await view.press(view.findByLabel("Mei and Arun posted here"));
  assert.equal(opened, 1);

  await view.rerender(
    createElement(FollowsPostedHere, {
      venueId: "venue-9",
      enabled: true,
      onOpen: () => undefined,
    }),
  );
  assert.equal(view.findByTestId("stall-follows-posted-here"), null, "nobody posted at venue-9");
});
