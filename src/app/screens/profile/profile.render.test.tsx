// Own and other-user profile, Review history and Edit profile, rendered and pressed.
// Run with `node scripts/test-render.mjs src/app/screens/profile/profile.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import { Alert } from "react-native";
import test, { afterEach, beforeEach } from "node:test";

import { EditProfileScreen } from "@/app/screens/profile/EditProfileScreen";
import { ProfileHomeScreen } from "@/app/screens/profile/ProfileHomeScreen";
import { ReviewHistoryScreen } from "@/app/screens/profile/ReviewHistoryScreen";
import { UserProfileContent } from "@/app/screens/profile/UserProfileContent";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import {
  getDataRepository,
  getHungryService,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import { similarityScore } from "@/lib/ai/similarityScore";
import { useProfileStore } from "@/store/useProfileStore";
import { useStallInteractionStore } from "@/store/useStallInteractionStore";
import { useStallSubmissionStore } from "@/store/useStallSubmissionStore";
import { useSessionStore } from "@/store/useSessionStore";
import {
  cleanup,
  createFakeNavigation,
  render,
  renderScreen,
  type FakeNavigation,
} from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { Review } from "@/types/domain";

const flags = FEATURE_FLAGS as unknown as Record<string, boolean>;
const savedFlags = { ...flags };
const restores: (() => void)[] = [];

/** Swaps one method on an object for the test; put back in afterEach. */
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

/** Production defaults: the posts feed, Activity and the Passport are off. */
function productionFlags() {
  flags.socialFeedEnabled = false;
  flags.activityEnabled = false;
  flags.gamificationEnabled = false;
  flags.storiesEnabled = false;
  flags.merchantCentreEnabled = false;
}

function review(index: number, overrides: Partial<Review> = {}): Review {
  return {
    id: `review-${index}`,
    dishId: undefined,
    authorName: "Wei Ming",
    rating: 4,
    createdAt: new Date(2026, 0, 1 + (index % 28)).toISOString(),
    text: `Notes ${index}`,
    tags: [],
    wouldRecommend: true,
    photos: [],
    ...overrides,
  };
}

/** A navigation whose focus can be toggled, firing focus/blur listeners like a stack would. */
function focusableNavigation() {
  const navigation = createFakeNavigation() as FakeNavigation & {
    setFocused(value: boolean): void;
  };
  let focused = true;
  const listeners = new Map<string, Set<() => void>>();
  Object.assign(navigation, {
    isFocused: () => focused,
    addListener: (event: string, callback: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(callback);
      return () => listeners.get(event)?.delete(callback);
    },
    setFocused(value: boolean) {
      focused = value;
      for (const callback of listeners.get(value ? "focus" : "blur") ?? []) callback();
    },
  });
  return navigation;
}

function fakeFlags(flagsByKey: Record<string, string>) {
  const state = { exposures: 0 };
  const source: ExperimentFlagSource = {
    peek: (key) => flagsByKey[key],
    expose: (key) => {
      state.exposures += 1;
      return flagsByKey[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  setExperimentFlagSource(source);
  return state;
}

beforeEach(async () => {
  await enterScenario("user");
  productionFlags();
  clearTrackedAnalyticsEvents();
  const social = getHungryService().social;
  stub(social, "getFollowCounts", async () => ({ followersCount: 3, followingCount: 5 }));
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

test("own profile in production: no dead Badges tile or post loads, follower lists reachable", async () => {
  flags.followConnectionsEnabled = true;
  const social = getHungryService().social;
  let postReads = 0;
  stub(social, "listUserPosts", async () => {
    postReads += 1;
    return [];
  });
  const interactionLoads: string[] = [];
  useStallInteractionStore.setState({
    loadInteractions: async (userId: string) => {
      interactionLoads.push(userId);
    },
  });

  const navigation = createFakeNavigation();
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome", navigation });

  assert.ok(view.findByText("Profile"), "the header says Profile, not Hungry");
  assert.equal(
    view.findByText("Hungry Passport"),
    null,
    "Passport is not registered in production",
  );
  assert.equal(view.findByLabel("Show profile posts"), null, "no Posts tab with the feed archived");
  assert.equal(postReads, 0, "no post reads for an archived feed");
  assert.deepEqual(interactionLoads, [], "tried stalls load only for the Passport");
  assert.ok(view.findByText("Taste Fingerprint"), "the taste section is titled Taste Fingerprint");
  assert.equal(view.text().includes("Palate Fingerprint"), false, "the old Palate name is gone");

  await view.press(view.findByLabel("Followers 3"));
  await view.press(view.findByLabel("Following 5"));
  assert.deepEqual(
    navigation.calls.filter((call) => call.method === "navigate").map((call) => call.args[0]),
    ["Followers", "Following"],
  );
});

test("PROF-V1: a failed follower-count read shows the tiles as unavailable, not loading, and reports it", async () => {
  flags.followConnectionsEnabled = true;
  const social = getHungryService().social;
  stub(social, "getFollowCounts", async () => {
    throw new Error("rate limited");
  });
  const reported: unknown[] = [];
  const originalConsoleError = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  // reportError logs to the console in development; that is what this test reads.
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reported.push(args[2]);
  };
  try {
    const navigation = createFakeNavigation();
    const view = await renderScreen(ProfileHomeScreen as never, {
      name: "ProfileHome",
      navigation,
    });
    await view.settle();
    assert.equal(view.findByLabel("Followers, loading"), null);
    assert.ok(view.findByLabel("Followers, unavailable"));
    assert.ok(view.findByLabel("Following, unavailable"));
    // The lists load on their own, so the tiles still open them.
    await view.press(view.findByLabel("Followers, unavailable"));
    assert.equal(navigation.calls.at(-1)?.args[0], "Followers");
    assert.ok(
      reported.some((context) => (context as { action?: string })?.action === "load_follow_counts"),
    );
  } finally {
    console.error = originalConsoleError;
    globals.__DEV__ = previousDev;
  }
});

test("Followers and Following are archived: no tiles and no count read until a build opts in", async () => {
  let countReads = 0;
  stub(getHungryService().social, "getFollowCounts", async () => {
    countReads += 1;
    return { followersCount: 3, followingCount: 5 };
  });
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  await view.settle();
  assert.equal(view.findByLabel("Followers 3"), null);
  assert.equal(view.findByLabel("Following 5"), null);
  assert.equal(view.findByText("Following"), null);
  assert.equal(countReads, 0);
});

test("own profile shows the Passport card only with the Passport", async () => {
  flags.gamificationEnabled = true;
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.ok(view.findByText("Hungry Passport"));
  assert.equal(view.findByText("Badges"), null, "the old Badges tile is gone");
});

test("the taste radar is capped at 260 and shrinks with its card", async () => {
  useProfileStore.setState((state) => ({
    profile: {
      ...state.profile,
      tasteVector: { ...state.profile.tasteVector, spicy: 9, sweet: 2 },
    },
  }));
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  const radar = view.findByTestId("profile-taste-radar");
  assert.ok(radar, "radar rendered");
  assert.equal(radar.style.maxWidth, "260px");
  assert.equal(radar.style.width, "100%");
  assert.doesNotMatch(radar.innerHTML, /width="260"/);
});

test("a restored session with the guest placeholder id makes no account reads", async () => {
  flags.gamificationEnabled = true;
  const reads: string[] = [];
  const reviews = getHungryService().reviews;
  stub(reviews, "getUserReviews", async (userId: string) => {
    reads.push(`reviews:${userId}`);
    return [];
  });
  useStallInteractionStore.setState({
    loadInteractions: async (userId: string) => {
      reads.push(`interactions:${userId}`);
    },
  });
  useStallSubmissionStore.setState({
    loadSubmissions: async () => {
      reads.push("submissions");
    },
  });
  useProfileStore.setState((state) => ({ profile: { ...state.profile, id: "guest-user" } }));
  useSessionStore.setState({ isAuthenticated: true });
  await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.deepEqual(reads, []);
});

test("first-review nudge: a user with no reviews in the test arm sees it and is exposed once", async () => {
  const exposure = fakeFlags({ profile_first_review_nudge_v1: "test" });
  stub(getHungryService().reviews, "getUserReviews", async () => []);
  const navigation = createFakeNavigation();
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome", navigation });
  assert.ok(view.findByTestId("profile-first-review-nudge"));
  assert.equal(exposure.exposures, 1);

  await view.press(view.findByText("Write a review"));
  assert.ok(
    navigation.calls.some((call) => call.method === "navigate" && call.args[0] === "ReviewStack"),
  );
  assert.ok(getTrackedAnalyticsEvents().some((e) => e.event === "profile_review_nudge_tapped"));
});

test("first-review nudge: control sees no card", async () => {
  const exposure = fakeFlags({ profile_first_review_nudge_v1: "control" });
  stub(getHungryService().reviews, "getUserReviews", async () => []);
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("profile-first-review-nudge"), null);
  assert.equal(exposure.exposures, 1);
});

test("first-review nudge: people with reviews, a failed load or no account are never exposed", async () => {
  const exposure = fakeFlags({ profile_first_review_nudge_v1: "test" });
  stub(getHungryService().reviews, "getUserReviews", async () => [review(1)]);
  let view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("profile-first-review-nudge"), null);
  await view.unmount();

  stub(getHungryService().reviews, "getUserReviews", async () => {
    throw new Error("offline");
  });
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("profile-first-review-nudge"), null);
  await view.unmount();

  await enterScenario("guest");
  productionFlags();
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.equal(view.findByTestId("profile-first-review-nudge"), null);
  assert.equal(exposure.exposures, 0);
});

const OTHER_ID = "22222222-2222-4222-8222-222222222222";

async function renderOtherProfile() {
  return render(
    createElement(UserProfileContent, {
      navigation: createFakeNavigation(),
      authorName: "",
      authorId: OTHER_ID,
    }),
  );
}

test("another profile in production: Reviews only, one Load more, the server's review count", async () => {
  let postReads = 0;
  stub(getHungryService().social, "listUserPosts", async () => {
    postReads += 1;
    return [];
  });
  stub(getHungryService().profile, "getPublicProfile", async () => ({
    id: OTHER_ID,
    displayName: "Ahmad",
    dishesReviewed: 73,
    stallsVisited: 9,
  }));
  stub(getHungryService().reviews, "getUserReviews", async () =>
    Array.from({ length: 50 }, (_, index) => review(index)),
  );
  const view = await renderOtherProfile();
  assert.equal(view.findByLabel("Show posts"), null, "no Posts tab");
  assert.ok(view.findByText("Notes 0"), "Reviews show by default");
  assert.equal(postReads, 0);
  assert.equal(
    Array.from(document.body.querySelectorAll('[role="button"]')).filter(
      (element) => element.textContent?.trim() === "Load more",
    ).length,
    1,
  );
  assert.ok(view.findByLabel("Reviews 73"), "server counter instead of 50+");
});

test("profile_viewed fires once the other profile has loaded, never for a missing one", async () => {
  let resolveProfile: (value: unknown) => void = () => undefined;
  stub(
    getHungryService().profile,
    "getPublicProfile",
    (() => new Promise((resolve) => (resolveProfile = resolve))) as never,
  );
  stub(getHungryService().reviews, "getUserReviews", async () => []);
  const view = await renderOtherProfile();
  const viewed = () => getTrackedAnalyticsEvents().filter((e) => e.event === "profile_viewed");
  assert.equal(viewed().length, 0, "not while loading");
  resolveProfile({ id: OTHER_ID, displayName: "Ahmad" });
  await view.settle();
  assert.equal(viewed().length, 1);
  assert.equal(viewed()[0].properties.is_private_locked, false);
  await view.unmount();

  clearTrackedAnalyticsEvents();
  stub(getHungryService().profile, "getPublicProfile", async () => undefined);
  const missing = await renderOtherProfile();
  assert.ok(missing.findByText("Profile not found"));
  assert.equal(viewed().length, 0);
});

/** Review history reads the server only outside mock mode. */
function useServerReviews() {
  setServiceProvider({
    mode: "supabase",
    service: getHungryService(),
    repository: getDataRepository(),
    similarityScore,
  });
}

test("Review history keeps loaded pages after visiting a dish and coming back", async () => {
  const offsets: number[] = [];
  const server = Array.from({ length: 60 }, (_, index) => review(index));
  stub(getHungryService().reviews, "getUserReviews", async (_id: string, page) => {
    offsets.push(page?.offset ?? 0);
    const start = page?.offset ?? 0;
    return server.slice(start, start + (page?.limit ?? 50));
  });
  useServerReviews();
  const navigation = focusableNavigation();
  const view = await renderScreen(ReviewHistoryScreen as never, {
    name: "ReviewHistory",
    navigation,
  });
  assert.ok(view.findByText("Notes 49"));
  await view.press(view.findByText("Load more"));
  assert.ok(view.findByText("Notes 59"), "second page loaded");

  navigation.setFocused(false);
  await view.settle();
  navigation.setFocused(true);
  await view.settle();
  // Load more re-reads the last 5 rows (offset 45) so a shifted row is never skipped.
  assert.deepEqual(offsets, [0, 45, 0], "page 1 refreshed on return");
  assert.ok(view.findByText("Notes 59"), "the second page is still there");
});

test("PROF-V3: a review deleted elsewhere does not make Load more skip the next one", async () => {
  let server = Array.from({ length: 120 }, (_, index) => review(index));
  stub(getHungryService().reviews, "getUserReviews", async (_id: string, page) => {
    const start = page?.offset ?? 0;
    return server.slice(start, start + (page?.limit ?? 50));
  });
  useServerReviews();
  const navigation = focusableNavigation();
  const view = await renderScreen(ReviewHistoryScreen as never, {
    name: "ReviewHistory",
    navigation,
  });
  await view.press(view.findByText("Load more"));
  assert.ok(view.findByText("Notes 99"), "two pages loaded");

  // Deleted on another device while this screen was in the background.
  server = server.filter((item) => item.id !== "review-10");
  navigation.setFocused(false);
  await view.settle();
  navigation.setFocused(true);
  await view.settle();

  await view.press(view.findByText("Load more"));
  assert.ok(view.findByText("Notes 100"), "the review after the old page end is not skipped");
});

test("Review history on a backend without review stats shows the server count while more pages exist", async () => {
  stub(getHungryService().reviews, "getMyReviewStats", async () => undefined);
  stub(getHungryService().reviews, "getUserReviews", async () =>
    Array.from({ length: 50 }, (_, index) => review(index)),
  );
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, stats: { ...state.profile.stats, dishesReviewed: 51 } },
  }));
  useServerReviews();
  const view = await renderScreen(ReviewHistoryScreen as never, { name: "ReviewHistory" });
  assert.equal(view.findByTestId("review-history-count")?.textContent, "51");
});

test("Review history: the review menu is outside the card's button, so a screen reader reaches it", async () => {
  stub(getHungryService().reviews, "getUserReviews", async () => [
    review(1, { dishId: "dish-chicken-rice" }),
  ]);
  useServerReviews();
  const view = await renderScreen(ReviewHistoryScreen as never, { name: "ReviewHistory" });
  const menu = view.findByLabel("Manage your review");
  assert.ok(menu, "menu shown");
  const card = view.findByLabel(/^Review of /);
  assert.ok(card);
  assert.equal(card.contains(menu), false);
});

test("PROF-18a: saving an edit to your own review marks it Edited straight away", async () => {
  const reviews = getHungryService().reviews;
  const updates: { id: string; patch: unknown }[] = [];
  stub(reviews, "getUserReviews", async () => [review(1, { dishId: "dish-chicken-rice" })]);
  stub(reviews, "updateReview", async (id: string, patch) => {
    updates.push({ id, patch });
  });
  type AlertButton = { text?: string; onPress?: () => void };
  const prompts: AlertButton[][] = [];
  stub(Alert, "alert", ((_title: string, _message?: string, buttons?: AlertButton[]) => {
    prompts.push(buttons ?? []);
  }) as typeof Alert.alert);
  useServerReviews();
  const view = await renderScreen(ReviewHistoryScreen as never, { name: "ReviewHistory" });
  assert.equal(view.text().includes("Edited"), false, "not edited yet");

  await view.press(view.findByLabel("Manage your review"));
  prompts
    .at(-1)
    ?.find((button) => button.text === "Edit review")
    ?.onPress?.();
  await view.settle();
  const textarea = document.body.querySelector("textarea") as HTMLTextAreaElement;
  assert.ok(textarea, "the editor opened");
  await view.type(textarea, "Better on a second visit");
  await view.press(view.findByLabel("Save"));

  assert.deepEqual(
    updates.map((update) => update.id),
    ["review-1"],
  );
  assert.ok(view.findByText("Better on a second visit"), "the card shows the new text");
  assert.ok(view.text().includes("Edited"), "the card says Edited without a reload");
});

test("Edit profile keeps a typed bio after a trip to the taste quiz", async () => {
  const navigation = focusableNavigation();
  const view = await renderScreen(EditProfileScreen as never, { name: "EditProfile", navigation });
  const bioInput = Array.from(document.body.querySelectorAll("textarea, input")).find(
    (element) =>
      (element as HTMLInputElement).value === (useProfileStore.getState().profile.bio ?? ""),
  ) as HTMLInputElement | undefined;
  const inputs = Array.from(
    document.body.querySelectorAll("textarea, input"),
  ) as HTMLInputElement[];
  const target = inputs.find((input) => input.tagName === "TEXTAREA") ?? bioInput ?? inputs[1];
  await view.type(target, "Laksa hunter");
  navigation.setFocused(false);
  await view.settle();
  navigation.setFocused(true);
  await view.settle();
  assert.equal(target.value, "Laksa hunter");
});
