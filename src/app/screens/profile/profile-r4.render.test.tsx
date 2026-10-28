// Round-four profile rework: shared review card, stat row, taste radar, pinned dishes, taste
// match, review stats, Follow back, friendly failures. Run with
// `node scripts/test-render.mjs src/app/screens/profile/profile-r4.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { EditProfileScreen } from "@/app/screens/profile/EditProfileScreen";
import { FollowRequestsScreen } from "@/app/screens/profile/FollowRequestsScreen";
import { FollowersScreen } from "@/app/screens/profile/ProfileConnectionsScreen";
import { ProfileHomeScreen } from "@/app/screens/profile/ProfileHomeScreen";
import { ReviewHistoryScreen } from "@/app/screens/profile/ReviewHistoryScreen";
import { UserProfileContent } from "@/app/screens/profile/UserProfileContent";
import { FavouriteDishesRow } from "@/components/profile/FavouriteDishesRow";
import { ProfileReviewCard } from "@/components/profile/ProfileReviewCard";
import { ProfileStatRow, STAT_UNAVAILABLE } from "@/components/profile/ProfileStatRow";
import { TasteRadar } from "@/components/profile/TasteRadar";
import { Avatar } from "@/components/ui";
import { TASTE_DIMENSIONS } from "@/constants/taste";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { useProfileFavouriteDishes } from "@/features/profile/useProfileFavouriteDishes";
import { useReviewDishDetails } from "@/features/profile/useReviewDishDetails";
import {
  getDataRepository,
  getHungryService,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import { similarityScore } from "@/lib/ai/similarityScore";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, createFakeNavigation, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { Review } from "@/types/domain";

const ImagePicker = require("expo-image-picker") as {
  launchImageLibraryAsync: (...args: unknown[]) => Promise<unknown>;
};

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

/** Collects what reportError logs (it logs to the console in development builds). */
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

function useServerMode() {
  setServiceProvider({
    mode: "supabase",
    service: getHungryService(),
    repository: getDataRepository(),
    similarityScore,
  });
}

function review(index: number, overrides: Partial<Review> = {}): Review {
  return {
    id: `review-${index}`,
    dishId: `unknown-dish-${index}`,
    authorName: "Wei Ming",
    rating: 4,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    text: `Notes ${index}`,
    tags: [],
    wouldRecommend: true,
    photos: [],
    ...overrides,
  };
}

const OTHER_ID = "22222222-2222-4222-8222-222222222222";

beforeEach(async () => {
  await enterScenario("user");
  flags.socialFeedEnabled = false;
  flags.activityEnabled = false;
  flags.gamificationEnabled = false;
  stub(getHungryService().social, "getFollowCounts", async () => ({
    followersCount: 3,
    followingCount: 5,
  }));
});

afterEach(async () => {
  await cleanup();
  while (restores.length) restores.pop()!();
  Object.assign(flags, savedFlags);
});

// --- The shared review card -------------------------------------------------------------

test("review card: your photo when there is one, no empty image box when there is none", async () => {
  const withPhoto = await render(
    createElement(ProfileReviewCard, {
      review: review(1, { photos: ["https://img.test/mine.jpg"] }),
      dish: { status: "ready", name: "Laksa", stallName: "Katong Stall" },
    }),
  );
  assert.equal(document.body.querySelectorAll('[data-stub="expo-image.Image"]').length, 1);
  assert.ok(withPhoto.findByText("Katong Stall"));
  await withPhoto.unmount();

  const withoutPhoto = await render(
    createElement(ProfileReviewCard, {
      review: review(2),
      dish: { status: "ready", name: "Laksa", stallName: "Katong Stall" },
    }),
  );
  assert.equal(document.body.querySelectorAll('[data-stub="expo-image.Image"]').length, 0);
  assert.ok(withoutPhoto.text().includes("2 hours ago"), "relative date");
  assert.ok(withoutPhoto.text().includes("4.0"), "rating shown once");
  assert.equal((withoutPhoto.text().match(/4\.0/g) ?? []).length, 1);
});

test("review card: Loading… then a real name, never the 'Reviewed dish' placeholder", async () => {
  const states = [
    { status: "loading" as const, expect: "Loading…" },
    { status: "unavailable" as const, expect: "Dish no longer available" },
    { status: "failed" as const, expect: "Couldn't load this dish" },
  ];
  for (const state of states) {
    const view = await render(
      createElement(ProfileReviewCard, { review: review(3), dish: { status: state.status } }),
    );
    assert.ok(view.text().includes(state.expect), state.expect);
    assert.equal(view.text().includes("Reviewed dish"), false);
    await view.unmount();
  }
});

test("review card: no star for an unrated on-device entry, and Edited after an edit", async () => {
  const view = await render(
    createElement(ProfileReviewCard, {
      review: review(4, { rating: 0, editedAt: new Date().toISOString() }),
      dish: { status: "ready", name: "Satay" },
    }),
  );
  assert.equal(view.text().includes("★"), false);
  assert.ok(view.text().includes("Edited"));
});

test("review dish lookup: one batched call per list, names fill in after Loading…", async () => {
  const calls: { dishIds: string[] }[] = [];
  stub(getHungryService().discovery, "getItemDetails", async (input) => {
    calls.push({ dishIds: input.dishIds });
    return input.dishIds.map((dishId) => ({
      dishId,
      name: `Name of ${dishId}`,
      stallName: "Stall X",
    }));
  });
  function List() {
    const reviews = [review(1), review(2), review(3)];
    const { infoFor } = useReviewDishDetails(reviews);
    return createElement(
      "div",
      null,
      reviews.map((r) => {
        const info = infoFor(r.dishId);
        return createElement(
          "p",
          { key: r.id, "data-testid": `row-${r.id}` },
          info.status === "ready" ? info.name : info.status,
        );
      }),
    );
  }
  const view = await render(createElement(List));
  assert.equal(calls.length, 1, "one call for the whole list, not one per card");
  assert.deepEqual([...calls[0].dishIds].sort(), [
    "unknown-dish-1",
    "unknown-dish-2",
    "unknown-dish-3",
  ]);
  assert.equal(view.findByTestId("row-review-2")?.textContent, "Name of unknown-dish-2");
});

// --- Stat row, radar, avatar ------------------------------------------------------------

test("stat row: number over label, dash reads as unavailable, loading shows a skeleton", async () => {
  const pressed: string[] = [];
  const view = await render(
    createElement(ProfileStatRow, {
      testID: "stats",
      stats: [
        { key: "a", label: "Reviews", value: 6, onPress: () => pressed.push("a") },
        { key: "b", label: "Followers", value: STAT_UNAVAILABLE },
        { key: "c", label: "Following", value: null },
      ],
    }),
  );
  assert.ok(view.findByLabel("Reviews 6"));
  assert.ok(view.findByLabel("Followers, unavailable"));
  assert.ok(view.findByLabel("Following, loading"));
  await view.press(view.findByLabel("Reviews 6"));
  assert.deepEqual(pressed, ["a"]);
});

test("taste radar: six axis labels and chips in TASTE_DIMENSIONS order, no percent text", async () => {
  const vector = { sweet: 2, spicy: 9, sour: 3, salty: 5, rich: 8, aromatic: 7 } as never;
  const view = await render(createElement(TasteRadar, { vector }));
  const text = view.text();
  let last = -1;
  for (const { label } of TASTE_DIMENSIONS) {
    const index = text.indexOf(`${label} ·`);
    assert.ok(index > last, `${label} chip follows the previous one`);
    last = index;
  }
  assert.equal(text.includes("%"), false);
  assert.ok(text.includes("Spicy · High"));
  assert.ok(text.includes("Sweet · Low"));
});

test("avatar falls back to initials when the photo fails to load", async () => {
  const view = await render(
    createElement(Avatar, { name: "Wei Ming", uri: "https://img.test/broken.jpg", size: 40 }),
  );
  const image = document.body.querySelector('[data-stub="expo-image.Image"]') as
    | (HTMLElement & { __triggerError?: () => void })
    | null;
  assert.ok(image, "the photo renders first");
  const trigger = image.__triggerError;
  assert.ok(trigger, "the photo reports load errors");
  const { act } = await import("react");
  await act(async () => {
    trigger();
  });
  await view.settle();
  assert.ok(view.findByText("WM"), "initials show after the error");
});

// --- Profile home -----------------------------------------------------------------------

test("menu button: badge and count in the label at 2 follow requests, none at 0", async () => {
  stub(getHungryService().social, "getFollowRequestCount", async () => 2);
  let view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.ok(view.findByLabel("Open quick access, 2 follow requests"));
  assert.ok(view.findByTestId("profile-menu-badge"));
  await view.unmount();

  stub(getHungryService().social, "getFollowRequestCount", async () => 0);
  view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  assert.ok(view.findByLabel("Open quick access"));
  assert.equal(view.findByTestId("profile-menu-badge"), null);
});

test("menu open: one accessible Close quick access control, not two", async () => {
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  await view.press(view.findByLabel(/^Open quick access/));
  const closers = Array.from(document.body.querySelectorAll("[aria-label]")).filter(
    (element) => element.getAttribute("aria-label") === "Close quick access",
  );
  assert.equal(closers.length, 1);
});

test("own profile: pin up to four favourite dishes from the dishes you saved or reviewed", async () => {
  const saved = useProfileStore.getState().profile.favouriteDishIds;
  assert.ok(saved.length > 0, "the demo user has saved dishes");
  const stored: string[][] = [];
  stub(getHungryService().profile, "listFavouriteDishIds", async () => []);
  stub(getHungryService().profile, "setFavouriteDishes", async (ids: string[]) => {
    stored.push(ids);
    return ids;
  });
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  await view.press(view.findByLabel("Pin favourite dishes"));
  const boxes = Array.from(document.body.querySelectorAll('[role="checkbox"]')) as HTMLElement[];
  assert.ok(boxes.length > 0, "candidates are listed");
  await view.press(boxes[0]);
  await view.press(view.findByText("Save"));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].length, 1);
});

// --- Pinned dishes row ------------------------------------------------------------------

test("favourite dishes row: shows pins for others, limits picks to four, keeps the picker on a failed save", async () => {
  stub(getHungryService().discovery, "getItemDetails", async (input) =>
    input.dishIds.map((dishId) => ({ dishId, name: `Dish ${dishId}`, stallName: "Stall" })),
  );
  const opened: string[] = [];
  const readOnly = await render(
    createElement(FavouriteDishesRow, {
      dishIds: ["a", "b"],
      onOpenDish: (id: string) => opened.push(id),
    }),
  );
  await readOnly.press(readOnly.findByLabel("Dish a"));
  assert.deepEqual(opened, ["a"]);
  assert.equal(readOnly.findByLabel("Edit favourite dishes"), null, "others cannot edit");
  await readOnly.unmount();

  let attempts = 0;
  const editable = await render(
    createElement(FavouriteDishesRow, {
      dishIds: [],
      candidateDishIds: ["a", "b", "c", "d", "e"],
      onOpenDish: () => undefined,
      onSave: async () => {
        attempts += 1;
        return false;
      },
    }),
  );
  await editable.press(editable.findByLabel("Pin favourite dishes"));
  for (const id of ["a", "b", "c", "d", "e"]) {
    await editable.press(editable.findByLabel(`Dish ${id}`));
  }
  assert.equal(editable.text().split("✓").length - 1, 4, "the fifth tap is ignored");
  await editable.press(editable.findByText("Save"));
  assert.equal(attempts, 1);
  assert.ok(editable.text().includes("Couldn't save your favourite dishes"), "stays open");
});

test("useProfileFavouriteDishes: reads the pins, and a failed read is reported, not shown", async () => {
  const reported = captureReports();
  stub(getHungryService().profile, "listFavouriteDishIds", async () => {
    throw new Error("rate limited");
  });
  function Probe() {
    const { dishIds, isLoaded } = useProfileFavouriteDishes(OTHER_ID);
    return createElement("p", { "data-testid": "probe" }, `${isLoaded}:${dishIds.length}`);
  }
  const view = await render(createElement(Probe));
  assert.equal(view.findByTestId("probe")?.textContent, "true:0");
  assert.ok(reported.some((r) => r.action === "load_favourite_dishes"));
});

// --- Someone else's profile -------------------------------------------------------------

async function renderOtherProfile() {
  return render(
    createElement(UserProfileContent, {
      navigation: createFakeNavigation(),
      authorName: "",
      authorId: OTHER_ID,
    }),
  );
}

test("other profile: taste match, member since and pinned dishes; one stat row component", async () => {
  stub(getHungryService().profile, "getPublicProfile", async () => ({
    id: OTHER_ID,
    displayName: "Ahmad",
    createdAt: "2026-03-14T00:00:00.000Z",
  }));
  stub(getHungryService().profile, "getTasteMatch", async () => 87);
  stub(getHungryService().profile, "listFavouriteDishIds", async () => ["pin-1"]);
  stub(getHungryService().discovery, "getItemDetails", async (input) =>
    input.dishIds.map((dishId) => ({ dishId, name: "Pinned Laksa", stallName: "Stall" })),
  );
  stub(getHungryService().reviews, "getUserReviews", async () => []);
  useServerMode();
  const view = await renderOtherProfile();
  assert.equal(
    view.findByTestId("user-profile-meta")?.textContent,
    "87% taste match · Member since Mar 2026",
  );
  assert.ok(view.findByText("Pinned Laksa"));
  assert.ok(view.findByTestId("user-profile-stats"));
  assert.ok(view.text().includes("Ahmad hasn't reviewed anything yet."));
});

test("other profile: no taste match line when the server has none", async () => {
  stub(getHungryService().profile, "getPublicProfile", async () => ({
    id: OTHER_ID,
    displayName: "Ahmad",
  }));
  stub(getHungryService().profile, "getTasteMatch", async () => null);
  stub(getHungryService().reviews, "getUserReviews", async () => []);
  const view = await renderOtherProfile();
  assert.equal(view.findByTestId("user-profile-meta"), null);
});

test("other profile: a failed counts read still applies the follow status", async () => {
  stub(getHungryService().profile, "getPublicProfile", async () => ({
    id: OTHER_ID,
    displayName: "Ahmad",
  }));
  stub(getHungryService().social, "getFollowCounts", async () => {
    throw new Error("down");
  });
  stub(getHungryService().social, "getFollowStatus", async () => "pending");
  stub(getHungryService().reviews, "getUserReviews", async () => []);
  const reported = captureReports();
  const view = await renderOtherProfile();
  assert.ok(view.findByLabel("Follow request sent to Ahmad"), "Requested from the status read");
  assert.ok(reported.some((r) => r.action === "load_follow_counts"));
});

// --- Review history ---------------------------------------------------------------------

test("review history: 'Your reviews', server totals and histogram from one stats read", async () => {
  useServerMode();
  stub(getHungryService().reviews, "getUserReviews", async () => [review(1), review(2)]);
  stub(getHungryService().reviews, "getMyReviewStats", async () => ({
    reviewCount: 120,
    averageRating: 4.2,
    ratingCounts: [1, 2, 3, 4, 110],
  }));
  stub(getHungryService().discovery, "getItemDetails", async (input) =>
    input.dishIds.map((dishId) => ({ dishId, name: `Dish ${dishId}`, stallName: "Stall" })),
  );
  const view = await renderScreen(ReviewHistoryScreen as never, { name: "ReviewHistory" });
  assert.ok(view.findByText("Your reviews"));
  assert.equal(view.findByTestId("review-history-count")?.textContent, "120");
  assert.ok(view.text().includes("4.2"));
  assert.ok(view.findByTestId("review-history-histogram"));
  assert.ok(
    view
      .findByTestId("review-history-histogram")
      ?.getAttribute("aria-label")
      ?.includes("110 at 5 stars"),
  );
  assert.equal(view.text().includes("No written notes"), false);
  assert.equal(view.text().includes("Reviewed dish"), false);
});

test("review history: a failed stats read is reported and the list still shows", async () => {
  useServerMode();
  const reported = captureReports();
  stub(getHungryService().reviews, "getUserReviews", async () => [review(1)]);
  stub(getHungryService().reviews, "getMyReviewStats", async () => {
    throw new Error("rate limited");
  });
  const view = await renderScreen(ReviewHistoryScreen as never, { name: "ReviewHistory" });
  assert.ok(view.findByText("Notes 1"));
  assert.equal(view.findByTestId("review-history-histogram"), null);
  assert.ok(reported.some((r) => r.action === "load_review_stats"));
});

// --- Followers, Follow requests, Edit profile -------------------------------------------

test("followers list: 'Follow back' for someone who follows you and you do not follow", async () => {
  stub(getHungryService().social, "listFollowers", async () => [
    { userId: OTHER_ID, displayName: "Ahmad" },
  ]);
  const view = await renderScreen(FollowersScreen as never, { name: "Followers" });
  assert.ok(view.findByLabel("Follow back Ahmad"));
  assert.ok(view.findByLabel("Remove Ahmad as a follower"));
});

test("followers list: a failed load reports once and shows friendly copy", async () => {
  const reported = captureReports();
  stub(getHungryService().social, "listFollowers", async () => {
    throw new Error("PGRST301 secret server text");
  });
  const view = await renderScreen(FollowersScreen as never, { name: "Followers" });
  assert.ok(view.text().includes("Couldn't load followers"));
  assert.equal(view.text().includes("PGRST301"), false);
  assert.equal(reported.filter((r) => r.action === "load_connections").length, 1);
});

test("follow requests: a failed load reports once and never shows the raw server text", async () => {
  const reported = captureReports();
  stub(getHungryService().social, "listFollowRequests", async () => {
    throw new Error("PGRST301 secret server text");
  });
  const view = await renderScreen(FollowRequestsScreen as never, { name: "FollowRequests" });
  assert.ok(view.text().includes("Couldn't load follow requests"));
  assert.equal(view.text().includes("PGRST301"), false);
  assert.equal(reported.filter((r) => r.action === "load_requests").length, 1);
});

test("edit profile: a photo picker that throws shows a toast and reports once", async () => {
  const reported = captureReports();
  stub(ImagePicker as never, "launchImageLibraryAsync", (async () => {
    throw new Error("picker crashed");
  }) as never);
  const view = await renderScreen(EditProfileScreen as never, { name: "EditProfile" });
  const button = view.findByLabel(/Change .*photo|Add .*photo|profile photo/i);
  assert.ok(button, "the photo button is on screen");
  await view.press(button);
  assert.equal(useUIStore.getState().toast?.message, "Couldn't open your photos.");
  assert.equal(reported.filter((r) => r.action === "pick_avatar").length, 1);
});

test("edit profile: saving never sends dietary preferences", async () => {
  const updates: Record<string, unknown>[] = [];
  const original = getHungryService().profile.updateProfile.bind(getHungryService().profile);
  stub(getHungryService().profile, "updateProfile", async (patch) => {
    updates.push(patch);
    return original(patch);
  });
  const view = await renderScreen(EditProfileScreen as never, { name: "EditProfile" });
  const inputs = Array.from(document.body.querySelectorAll("input")) as HTMLInputElement[];
  await view.type(inputs[0], "Wei Ming K");
  await view.press(view.findByText("Save changes"));
  assert.equal(updates.length, 1);
  assert.equal("dietaryPreferences" in updates[0], false);
  assert.equal(view.findByText("Retake the taste quiz"), null, "the duplicate button is gone");
});
