// Round-five profile fixes (P5-1 to P5-15): list rows, the more menu, the review card's star and
// photo fallback, reduced motion, the edit form, the radar as the hero. Run with
// `node scripts/test-render.mjs src/app/screens/profile/profile-r5.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";
import { Animated } from "react-native";

import { EditProfileScreen } from "@/app/screens/profile/EditProfileScreen";
import { ProfileHomeScreen } from "@/app/screens/profile/ProfileHomeScreen";
import { ProfileReviewCard } from "@/components/profile/ProfileReviewCard";
import { Skeleton } from "@/components/ui";
import { ListRow } from "@/components/ui/ListRow";
import {
  buildNativeActions,
  OverflowMenu,
  type OverflowMenuItem,
} from "@/components/ui/OverflowMenu";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { useHungryTheme } from "@/theme";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { Review } from "@/types/domain";

const { window } = globalThis as unknown as { window: Window & typeof globalThis };
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

const sampleReview: Review = {
  id: "r-1",
  dishId: "unknown-dish-1",
  authorName: "Wei Ming",
  rating: 4,
  createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  text: "Good",
  tags: [],
  wouldRecommend: true,
  photos: ["https://img.test/broken.jpg"],
};

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
  useUIStore.setState({ reducedMotionEnabled: false });
});

// --- P5-4: plain rows --------------------------------------------------------------------

test("P5-4 ListRow: the first row has no hairline, later rows do, and the trailing button is a sibling", async () => {
  const pressed: string[] = [];
  const view = await render(
    createElement(
      "div",
      null,
      createElement(ListRow, {
        first: true,
        title: "Ahmad",
        testID: "row-1",
        leading: createElement("span", null, "A"),
        trailing: createElement("button", { "aria-label": "Follow Ahmad" }, "Follow"),
        onPress: () => pressed.push("ahmad"),
      }),
      createElement(ListRow, { title: "Mei", testID: "row-2", subtitle: "Wants to follow you" }),
    ),
  );
  const first = view.findByTestId("row-1") as HTMLElement;
  const second = view.findByTestId("row-2") as HTMLElement;
  const hairline = (row: HTMLElement) =>
    Array.from(row.children).filter(
      (child) =>
        child.children.length === 0 && Number.parseFloat(getComputedStyle(child).height) <= 1,
    );
  assert.equal(hairline(first).length, 0, "no line above the first row");
  assert.equal(hairline(second).length, 1, "one line above the second row");
  const button = view.findByLabel("Ahmad") as HTMLElement;
  const trailing = view.findByLabel("Follow Ahmad") as HTMLElement;
  assert.equal(button.contains(trailing), false, "the accessory is not inside the press target");
  await view.press(button);
  assert.deepEqual(pressed, ["ahmad"]);
  assert.ok(view.findByText("Wants to follow you"));
});

// --- P5-3: the more menu -----------------------------------------------------------------

const items: OverflowMenuItem[] = [
  { id: "settings", title: "Settings", symbol: "settings", onPress: () => undefined },
  {
    id: "requests",
    title: "Follow requests",
    subtitle: "2 waiting",
    symbol: "followRequests",
    onPress: () => undefined,
  },
  { id: "out", title: "Sign out", symbol: "signOut", destructive: true, onPress: () => undefined },
];

test("P5-3 native actions: destructive items sit in their own inline group, with SF Symbols on iOS", () => {
  const actions = buildNativeActions(items, { errorColor: "#f00", ios: true });
  assert.deepEqual(
    actions.map((action) => action.id),
    ["settings", "requests", "destructive-group"],
  );
  assert.equal(actions[0].image, "gearshape");
  assert.equal(actions[1].subtitle, "2 waiting");
  const group = actions[2];
  assert.equal(group.displayInline, true);
  assert.equal(group.subactions?.[0].attributes?.destructive, true);
  assert.equal(group.subactions?.[0].image, "rectangle.portrait.and.arrow.right");
  // Android reads `image` as a drawable name, so it is left out there.
  assert.equal(buildNativeActions(items, { errorColor: "#f00", ios: false })[0].image, undefined);
  // No destructive item, no group.
  assert.equal(buildNativeActions(items.slice(0, 2), { errorColor: "#f00", ios: true }).length, 2);
});

test("P5-3 web fallback: the dropdown opens, shows a red Sign out with no chevron, and closes on a pick", async () => {
  const picked: string[] = [];
  // React's types want `children` inside the props; createElement's own children argument is the
  // lint-approved form, so it is called through a loose signature.
  const h = createElement as (...args: unknown[]) => ReturnType<typeof createElement>;
  const view = await render(
    h(
      OverflowMenu,
      {
        accessibilityLabel: "Open quick access",
        openAccessibilityLabel: "Close quick access",
        items: items.map((item) => ({ ...item, onPress: () => picked.push(item.id) })),
      },
      createElement("span", null, "..."),
    ),
  );
  assert.equal(view.findByLabel("Sign out"), null, "closed at first");
  await view.press(view.findByLabel("Open quick access"));
  assert.ok(view.findByLabel("Close quick access"));
  assert.ok(view.findByLabel("Follow requests, 2 waiting"), "the count is its subtitle");
  const signOut = view.findByLabel("Sign out") as HTMLElement;
  assert.ok(signOut);
  assert.equal(signOut.textContent?.includes("›"), false);
  await view.press(signOut);
  assert.deepEqual(picked, ["out"]);
  assert.equal(view.findByLabel("Sign out"), null, "closed after a pick");
});

test("P5-3 profile home: the badge is 11pt bold and the menu lists the account items", async () => {
  stub(getHungryService().social, "getFollowRequestCount", async () => 3);
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  const badge = view.findByTestId("profile-menu-badge") as HTMLElement;
  assert.ok(badge);
  const number = badge.querySelector("div") as HTMLElement;
  assert.equal(number.style.fontSize, "11px");
  assert.equal(number.style.fontWeight, "700");
  await view.press(view.findByLabel(/^Open quick access/));
  for (const label of ["Settings", "Sign out"]) {
    assert.ok(view.findByLabel(label), `${label} is in the menu`);
  }
  // Follow stall is off for now: no Followed stalls entry.
  assert.equal(view.findByLabel("Followed stalls"), null);
  assert.ok(view.findByLabel("Follow requests, 3 waiting"));
});

// --- P5-7, P5-9: the review card ---------------------------------------------------------

test("P5-7 review card: a drawn star in the darker amber, the rating text beside it", async () => {
  const view = await render(
    createElement(ProfileReviewCard, {
      review: { ...sampleReview, photos: [] },
      dish: { status: "missing" } as never,
    }),
  );
  assert.equal(view.text().includes("★"), false, "no text glyph star");
  assert.ok(view.text().includes("4.0"));
});

test("P5-9 review card: a photo that fails to load shows the dish tile, not a blank box", async () => {
  const view = await render(
    createElement(ProfileReviewCard, {
      review: sampleReview,
      dish: { status: "missing" } as never,
    }),
  );
  assert.equal(view.findByTestId("profile-review-photo-fallback"), null, "photo first");
  const image = document.body.querySelector('[data-stub="expo-image.Image"]') as
    | (HTMLElement & { __triggerError?: () => void })
    | null;
  assert.ok(image?.__triggerError, "the photo reports load errors");
  const trigger = image.__triggerError;
  const { act } = await import("react");
  await act(async () => {
    trigger();
  });
  await view.settle();
  assert.ok(view.findByTestId("profile-review-photo-fallback"), "the tile shows after the error");
});

test("P5-4 review card row variant: no card shadow, a hairline above all but the first", async () => {
  const first = await render(
    createElement(ProfileReviewCard, {
      review: { ...sampleReview, photos: [] },
      dish: { status: "missing" } as never,
      variant: "row",
      first: true,
      testID: "r-first",
    }),
  );
  const firstRow = first.findByTestId("r-first") as HTMLElement;
  assert.equal(
    getComputedStyle(firstRow).boxShadow === "" || getComputedStyle(firstRow).boxShadow === "none",
    true,
  );
  assert.notEqual(getComputedStyle(firstRow).borderTopWidth, "1px");
  await cleanup();
  const later = await render(
    createElement(ProfileReviewCard, {
      review: { ...sampleReview, photos: [] },
      dish: { status: "missing" } as never,
      variant: "row",
      testID: "r-later",
    }),
  );
  const laterRow = later.findByTestId("r-later") as HTMLElement;
  assert.notEqual(getComputedStyle(laterRow).borderTopStyle, "none");
});

// --- P5-5: reduced motion ----------------------------------------------------------------

test("P5-5 the theme exposes reducedMotion, following the in-app setting", async () => {
  let seen: boolean | undefined;
  function Probe() {
    seen = useHungryTheme().reducedMotion;
    return createElement("span", null, String(seen));
  }
  useUIStore.setState({ reducedMotionEnabled: true });
  await render(createElement(Probe));
  assert.equal(seen, true);
  await cleanup();
  useUIStore.setState({ reducedMotionEnabled: false });
  await render(createElement(Probe));
  assert.equal(seen, false);
});

test("P5-5 Skeleton: pulses normally, holds still with Reduce Motion on", async () => {
  const original = Animated.loop;
  let loops = 0;
  (Animated as { loop: unknown }).loop = (...args: Parameters<typeof Animated.loop>) => {
    loops += 1;
    return original(...args);
  };
  restores.push(() => {
    (Animated as { loop: unknown }).loop = original;
  });
  await render(createElement(Skeleton, { width: 40, height: 10 }));
  assert.ok(loops > 0, "a loop starts by default");
  await cleanup();

  loops = 0;
  useUIStore.setState({ reducedMotionEnabled: true });
  await render(createElement(Skeleton, { width: 40, height: 10 }));
  assert.equal(loops, 0, "no loop with Reduce Motion on");
});

// --- P5-12: edit profile -----------------------------------------------------------------

test("P5-12 edit profile: Cancel and Save in the header, Edit picture under the avatar, no bottom button", async () => {
  const view = await renderScreen(EditProfileScreen as never, { name: "EditProfile" });
  assert.ok(view.findByLabel("Cancel"));
  assert.ok(view.findByLabel("Save changes"));
  assert.ok(view.findByLabel("Edit picture"));
  assert.equal(view.findByText("Save changes"), null, "the bottom Save changes button is gone");
  assert.equal(
    view.findByLabel("Save changes")?.getAttribute("aria-disabled"),
    "true",
    "nothing to save yet",
  );
  assert.equal(view.text().includes("/150"), false, "no bio counter until the limit is near");
  await view.press(view.findByLabel("Cancel"));
  assert.ok(view.navigation.calls.some((call) => call.method === "goBack"));
});

test("P5-12 edit profile: the bio counter appears in the last 30 characters", async () => {
  useProfileStore.setState((state) => ({
    profile: { ...state.profile, bio: "x".repeat(125) },
  }));
  const view = await renderScreen(EditProfileScreen as never, { name: "EditProfile" });
  assert.ok(view.text().includes("125/150"));
});

// --- P5-13, P5-14: the radar and the copy ------------------------------------------------

test("P5-13 own profile: the radar sits above the reviews, with one plain sentence about mild tastes", async () => {
  useProfileStore.setState((state) => ({
    profile: {
      ...state.profile,
      tasteVector: { ...state.profile.tasteVector, spicy: 9, sweet: 2, sour: 1 },
    },
  }));
  const view = await renderScreen(ProfileHomeScreen as never, { name: "ProfileHome" });
  const radar = view.findByTestId("profile-taste-radar") as HTMLElement;
  const reviewsHeading = view.findByText("Your reviews") as HTMLElement;
  assert.ok(radar && reviewsHeading);
  assert.ok(
    radar.compareDocumentPosition(reviewsHeading) & window.Node.DOCUMENT_POSITION_FOLLOWING,
    "the radar comes first",
  );
  const mild = view.findByTestId("profile-palate-mild");
  if (mild) {
    assert.match(mild.textContent ?? "", /^You like it less .+ than most\.$/);
    assert.equal(view.text().includes("You prefer mild"), false);
  }
  assert.equal(view.findByTestId("profile-taste-chips"), null, "the six chips are collapsed");
});
