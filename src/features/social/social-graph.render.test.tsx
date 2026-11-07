// Followers and following back on: "Follows you", "Followed by…", taste match on lists, People
// with your taste, the Taste Palette and Compare palates pages, and Home's "Loved by people you
// follow". Run with `node scripts/test-render.mjs src/features/social/social-graph.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { FollowingScreen } from "@/app/screens/profile/ProfileConnectionsScreen";
import { TasteCompareScreen } from "@/app/screens/profile/TasteCompareScreen";
import { TastePaletteScreen } from "@/app/screens/profile/TastePaletteScreen";
import { UserProfileContent } from "@/app/screens/profile/UserProfileContent";
import { NetworkPicksSection } from "@/components/discover/home/NetworkPicksSection";
import { PeopleSuggestionsSection } from "@/components/social/PeopleSuggestionsSection";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useNetworkStallPicks } from "@/features/discover/useNetworkStallPicks";
import { useProfileRelationship } from "@/features/social/useProfileRelationship";
import { useTasteMatches } from "@/features/social/useTasteMatches";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { NetworkStallPick, ProfileRelationship } from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";
import { useSessionStore } from "@/store/useSessionStore";
import { cleanup, createFakeNavigation, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { TasteVector } from "@/types/domain";

const flags = FEATURE_FLAGS as unknown as Record<string, boolean>;
const savedFlags = { ...flags };
const restores: (() => void)[] = [];
const OTHER_ID = "22222222-2222-4222-8222-222222222222";

function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

function captureReports() {
  const reported: { action?: string; screen?: string }[] = [];
  const originalConsoleError = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reported.push(args[2] as { action?: string });
  };
  restores.push(() => {
    console.error = originalConsoleError;
    globals.__DEV__ = previousDev;
  });
  return reported;
}

const palate = (overrides: Partial<TasteVector> = {}): TasteVector => ({
  sweet: 5,
  spicy: 5,
  sour: 5,
  salty: 5,
  rich: 5,
  aromatic: 5,
  ...overrides,
});

beforeEach(async () => {
  await enterScenario("user");
  flags.followConnectionsEnabled = true;
  flags.socialFeedEnabled = false;
  flags.activityEnabled = false;
  flags.gamificationEnabled = false;
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
});

// --- Hooks ----------------------------------------------------------------------------

test("useTasteMatches asks once per new id and merges later pages; a failure is reported", async () => {
  const asked: string[][] = [];
  stub(getHungryService().social, "getTasteMatches", async (ids: string[]) => {
    asked.push([...ids]);
    return Object.fromEntries(ids.map((id) => [id, 80]));
  });
  let seen: Record<string, number> = {};
  function Probe({ ids }: { ids: string[] }) {
    seen = useTasteMatches(ids, true);
    return createElement("span", null, Object.keys(seen).length);
  }
  const view = await render(createElement(Probe, { ids: ["b", "a", "a"] }));
  assert.deepEqual(asked, [["a", "b"]]);
  await view.rerender(createElement(Probe, { ids: ["a", "b", "c"] }));
  await view.settle();
  assert.deepEqual(asked, [["a", "b"], ["c"]]);
  assert.deepEqual(seen, { a: 80, b: 80, c: 80 });
  await view.unmount();

  const reported = captureReports();
  stub(getHungryService().social, "getTasteMatches", async () => {
    throw new Error("down");
  });
  await render(createElement(Probe, { ids: ["x"] }));
  assert.deepEqual(seen, {});
  assert.ok(reported.some((r) => r.action === "load_taste_matches"));
});

test("useTasteMatches stays quiet while disabled", async () => {
  let calls = 0;
  stub(getHungryService().social, "getTasteMatches", async () => {
    calls += 1;
    return {};
  });
  function Probe() {
    useTasteMatches(["a"], false);
    return null;
  }
  await render(createElement(Probe));
  assert.equal(calls, 0);
});

test("useProfileRelationship: the value for this person only, null when off, failures reported", async () => {
  const value: ProfileRelationship = { followsYou: true, mutualCount: 0, mutuals: [] };
  stub(getHungryService().social, "getProfileRelationship", async () => value);
  let seen: ProfileRelationship | null = null;
  function Probe({ userId, enabled }: { userId: string; enabled: boolean }) {
    seen = useProfileRelationship(userId, enabled);
    return null;
  }
  const view = await render(createElement(Probe, { userId: OTHER_ID, enabled: true }));
  assert.deepEqual(seen, value);
  await view.rerender(createElement(Probe, { userId: OTHER_ID, enabled: false }));
  assert.equal(seen, null);
  await view.unmount();

  const reported = captureReports();
  stub(getHungryService().social, "getProfileRelationship", async () => {
    throw new Error("down");
  });
  await render(createElement(Probe, { userId: OTHER_ID, enabled: true }));
  assert.equal(seen, null);
  assert.ok(reported.some((r) => r.action === "load_profile_relationship"));
});

test("useNetworkStallPicks reads once when enabled and reports a failure", async () => {
  const picks: NetworkStallPick[] = [
    {
      venueId: "v1",
      source: "following",
      peopleCount: 1,
      people: [{ userId: "a", displayName: "Mei" }],
    },
  ];
  let calls = 0;
  stub(getHungryService().social, "listNetworkStallPicks", async () => {
    calls += 1;
    return picks;
  });
  let seen: NetworkStallPick[] = [];
  function Probe({ enabled }: { enabled: boolean }) {
    seen = useNetworkStallPicks(enabled);
    return null;
  }
  const view = await render(createElement(Probe, { enabled: false }));
  assert.equal(calls, 0);
  await view.rerender(createElement(Probe, { enabled: true }));
  await view.settle();
  assert.equal(calls, 1);
  assert.deepEqual(seen, picks);
  await view.unmount();

  const reported = captureReports();
  stub(getHungryService().social, "listNetworkStallPicks", async () => {
    throw new Error("down");
  });
  await render(createElement(Probe, { enabled: true }));
  assert.deepEqual(seen, []);
  assert.ok(reported.some((r) => r.action === "load_network_stall_picks"));
});

// --- People with your taste -------------------------------------------------------------

test("people suggestions: rows with a reason, people already shown left out, hidden when empty", async () => {
  stub(getHungryService().social, "listPeopleSuggestions", async () => [
    {
      userId: "s1",
      displayName: "Mei",
      tasteMatch: 91,
      mutualCount: 0,
      recentActivity: 0,
      reason: "taste" as const,
    },
    {
      userId: "s2",
      displayName: "Arun",
      mutualCount: 2,
      recentActivity: 0,
      reason: "mutual" as const,
    },
    {
      userId: "s3",
      displayName: "Known",
      mutualCount: 0,
      recentActivity: 1,
      reason: "active" as const,
    },
  ]);
  const opened: string[] = [];
  const view = await render(
    createElement(PeopleSuggestionsSection, {
      excludeUserIds: new Set(["s3"]),
      onOpen: (person) => opened.push(person.userId),
    }),
  );
  assert.ok(view.findByText("People with your taste"));
  assert.ok(view.text().includes("91% taste match"));
  assert.ok(view.text().includes("Followed by 2 people you follow"));
  assert.equal(view.findByTestId("people-suggestion-s3"), null);
  await view.press(view.findByText("Mei"));
  assert.deepEqual(opened, ["s1"]);
  await view.unmount();

  const reported = captureReports();
  stub(getHungryService().social, "listPeopleSuggestions", async () => {
    throw new Error("down");
  });
  const failed = await render(createElement(PeopleSuggestionsSection, { onOpen: () => undefined }));
  assert.equal(failed.findByTestId("people-suggestions"), null);
  assert.ok(reported.some((r) => r.action === "load_people_suggestions"));
});

test("people suggestions are not asked for when signed out", async () => {
  useSessionStore.setState({ isAuthenticated: false });
  let calls = 0;
  stub(getHungryService().social, "listPeopleSuggestions", async () => {
    calls += 1;
    return [];
  });
  const view = await render(createElement(PeopleSuggestionsSection, { onOpen: () => undefined }));
  assert.equal(calls, 0);
  assert.equal(view.findByTestId("people-suggestions"), null);
});

// --- Profiles and lists ----------------------------------------------------------------

test("other profile: Follows you, Follow back and Followed by open the followers list", async () => {
  stub(getHungryService().profile, "getPublicProfile", async () => ({
    id: OTHER_ID,
    displayName: "Ahmad",
  }));
  stub(getHungryService().profile, "getTasteMatch", async () => 64);
  stub(getHungryService().reviews, "getUserReviews", async () => []);
  stub(getHungryService().social, "getFollowStatus", async () => "none" as const);
  stub(getHungryService().social, "getFollowCounts", async () => ({
    followersCount: 4,
    followingCount: 2,
  }));
  stub(getHungryService().social, "getProfileRelationship", async () => ({
    followsYou: true,
    mutualCount: 3,
    mutuals: [
      { userId: "m1", displayName: "Mei" },
      { userId: "m2", displayName: "Sam" },
    ],
  }));
  const navigation = createFakeNavigation();
  const view = await render(
    createElement(UserProfileContent, { navigation, authorName: "", authorId: OTHER_ID }),
    { navigation },
  );
  assert.ok(view.findByTestId("user-profile-follows-you"));
  assert.ok(view.findByLabel("Follow back Ahmad"));
  assert.equal(
    view.findByTestId("user-profile-followed-by")?.textContent,
    "Followed by Mei, Sam and 1 other you follow",
  );
  assert.match(
    view.findByTestId("user-profile-taste-match")?.textContent ?? "",
    /64% · Good match/,
  );
  await view.press(view.findByTestId("user-profile-taste-match"));
  assert.ok(
    navigation.calls.some((call) => call.method === "navigate" && call.args[0] === "TasteCompare"),
  );
});

test("following list shows each person's taste match and the suggestions below", async () => {
  stub(getHungryService().social, "listFollowing", async () => [
    { userId: "f1", displayName: "Mei" },
    { userId: "f2", displayName: "Arun" },
  ]);
  stub(getHungryService().social, "getTasteMatches", async () => ({ f1: 88 }));
  stub(getHungryService().social, "listPeopleSuggestions", async () => [
    {
      userId: "f1",
      displayName: "Mei",
      mutualCount: 0,
      recentActivity: 1,
      reason: "active" as const,
    },
    {
      userId: "s9",
      displayName: "Lin",
      tasteMatch: 79,
      mutualCount: 0,
      recentActivity: 0,
      reason: "taste" as const,
    },
  ]);
  const view = await renderScreen(FollowingScreen as never, { name: "Following" });
  assert.ok(view.text().includes("88% · Great match"));
  assert.ok(view.findByTestId("people-suggestions"));
  assert.ok(view.findByTestId("people-suggestion-s9"));
  assert.equal(view.findByTestId("people-suggestion-f1"), null, "people you follow are left out");
});

// --- Taste Palette and Compare palates -------------------------------------------------

test("taste palette: words per taste, confidence, drift and Try next opens a search", async () => {
  const now = Date.now();
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, tasteVector: palate({ spicy: 8.5, sweet: 2 }) },
    tasteInteractionEvents: [
      {
        id: "e1",
        type: "dish_like",
        surface: "home",
        dishId: "dish-unknown-1",
        createdAt: new Date(now - 2 * 86_400_000).toISOString(),
        userVectorBefore: palate({ spicy: 7 }),
        userVectorAfter: palate({ spicy: 8.5 }),
        applied: true,
      },
    ],
    foodHistory: [
      {
        dishId: "d1",
        foodType: "laksa",
        evidence: 3,
        absEvidence: 3,
        lastEventAt: new Date(now).toISOString(),
      },
    ],
  }));
  stub(getHungryService().discovery, "getItemDetails", async (input) =>
    input.dishIds.map((dishId) => ({ dishId, name: "Mala bowl", stallName: "Stall" })),
  );
  const view = await renderScreen(TastePaletteScreen as never, { name: "TastePalette" });
  assert.ok(view.findByText("Just getting to know you"));
  assert.ok(view.findByLabel(/^Spicy: Love, 8.5 out of 10/));
  assert.ok(view.findByLabel(/^Sweet: Avoid/));
  assert.ok(view.findByTestId("taste-palette-drift"));
  assert.ok(view.findByTestId("taste-palette-loves-laksa"));
  assert.ok(view.text().includes("Liked: Mala bowl"));
  const tryNext = view.findByTestId("taste-palette-try-next");
  assert.ok(tryNext);
  const firstChip = tryNext?.querySelector(
    "[data-testid^='taste-palette-try-next-']",
  ) as HTMLElement | null;
  await view.press(firstChip);
  const search = view.navigation.calls.find(
    (call) => call.method === "navigate" && call.args[0] === "SearchResults",
  );
  assert.ok(search, "Try next opens a search");
});

test("taste palette: a neutral palate asks for the quiz", async () => {
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, tasteVector: palate() },
    tasteInteractionEvents: [],
    foodHistory: [],
  }));
  const view = await renderScreen(TastePaletteScreen as never, { name: "TastePalette" });
  assert.ok(view.findByTestId("taste-palette-empty"));
  await view.press(view.findByText("Take the taste quiz"));
  assert.ok(view.navigation.calls.some((call) => call.args[0] === "OnboardingStack"));
});

test("compare palates: the band, what you share, and the biggest gap first", async () => {
  stub(getHungryService().social, "getTasteComparison", async () => ({
    score: 74,
    mine: palate({ spicy: 3, sweet: 8 }),
    theirs: palate({ spicy: 9, sweet: 8.2 }),
  }));
  const view = await renderScreen(TasteCompareScreen as never, {
    name: "TasteCompare",
    params: { userId: OTHER_ID, userDisplayName: "Mei" },
  });
  assert.ok(view.text().includes("74% · Great match"));
  assert.ok(view.text().includes("You both love sweetness"));
  assert.ok(view.text().includes("Mei likes far more spice"));
  const rows = view.findByTestId("taste-compare-rows");
  const first = rows?.querySelector("[data-testid^='taste-compare-row-']");
  assert.equal(first?.getAttribute("data-testid"), "taste-compare-row-spicy");
});

test("compare palates: nothing to compare, and a failed read offers a retry and is reported", async () => {
  stub(getHungryService().social, "getTasteComparison", async () => null);
  const none = await renderScreen(TasteCompareScreen as never, {
    name: "TasteCompare",
    params: { userId: OTHER_ID },
  });
  assert.ok(none.findByTestId("taste-compare-none"));
  await none.unmount();

  const reported = captureReports();
  let calls = 0;
  stub(getHungryService().social, "getTasteComparison", async () => {
    calls += 1;
    throw new Error("down");
  });
  const failed = await renderScreen(TasteCompareScreen as never, {
    name: "TasteCompare",
    params: { userId: OTHER_ID },
  });
  assert.ok(failed.text().includes("Couldn't compare palates"));
  assert.ok(reported.some((r) => r.action === "load_taste_comparison"));
  await failed.press(failed.findByText("Retry"));
  assert.equal(calls, 2);
});

// --- Home: Loved by people you follow ---------------------------------------------------

test("network picks rail: named stalls with who loved them, hidden when under two", async () => {
  const picks: NetworkStallPick[] = [
    {
      venueId: "v1",
      source: "following",
      peopleCount: 2,
      people: [
        { userId: "a", displayName: "Mei" },
        { userId: "b", displayName: "Arun" },
      ],
    },
    {
      venueId: "v2",
      source: "following",
      peopleCount: 1,
      people: [{ userId: "a", displayName: "Mei" }],
    },
    {
      venueId: "v3",
      source: "following",
      peopleCount: 1,
      people: [{ userId: "a", displayName: "Mei" }],
    },
  ];
  let detailCalls = 0;
  stub(getHungryService().discovery, "getItemDetails", async (input) => {
    detailCalls += 1;
    return input.stallIds
      .filter((stallId) => stallId !== "v3")
      .map((stallId) => ({ stallId, name: `Stall ${stallId}` }));
  });
  const opened: string[] = [];
  const view = await render(
    createElement(NetworkPicksSection, {
      picks,
      cardWidth: 200,
      gap: 8,
      onOpen: (pick) => opened.push(pick.venueId),
    }),
  );
  assert.equal(detailCalls, 1, "one batched read for the whole rail");
  assert.ok(view.findByText("Loved by people you follow"));
  assert.ok(view.text().includes("Mei and Arun loved this"));
  assert.equal(view.findByTestId("home-network-pick-v3"), null, "a stall with no name is left out");
  await view.press(view.findByLabel(/^Open Stall v2/));
  assert.deepEqual(opened, ["v2"]);
  await view.unmount();

  const thin = await render(
    createElement(NetworkPicksSection, {
      picks: picks.slice(2),
      cardWidth: 200,
      gap: 8,
      onOpen: () => undefined,
    }),
  );
  assert.equal(thin.findByTestId("home-network-picks"), null);
});
