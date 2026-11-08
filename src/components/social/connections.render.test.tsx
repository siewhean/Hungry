// Links between people and places: the shared Follow pill, the Review tab's reviewers, stall and
// profile review cards, list-row chevrons, Compare palates and Follow requests.
// Run with `node scripts/test-render.mjs src/components/social/connections.render.test.tsx`.
import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { FollowRequestsScreen } from "@/app/screens/profile/FollowRequestsScreen";
import { TasteCompareScreen } from "@/app/screens/profile/TasteCompareScreen";
import { ProfileReviewCard } from "@/components/profile/ProfileReviewCard";
import { ReviewersRail, reviewersFromReviews } from "@/components/review/ReviewersRail";
import { PersonFollowPill } from "@/components/social/PersonFollowPill";
import { StallReviewCard } from "@/components/stall/StallReviewCard";
import { ListRow } from "@/components/ui/ListRow";
import type { StallCommunityReview } from "@/features/detail/detailTransforms";
import { getHungryService } from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useSocialStore } from "@/store/useSocialStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { Review } from "@/types/domain";

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

function review(id: string, authorId: string | undefined, authorName: string): Review {
  return {
    id,
    authorId,
    authorName,
    rating: 4,
    createdAt: "2026-11-07T10:00:00Z",
    text: "",
    tags: [],
    wouldRecommend: true,
    photos: [],
  };
}

// ─── Follow pill ─────────────────────────────────────────────────────────────

test("PersonFollowPill offers Follow, shows Requested, and hides for you or someone you follow", async () => {
  const viewerId = useProfileStore.getState().profile.id;
  const view = await render(createElement(PersonFollowPill, { userId: "u-mei", name: "Mei" }));
  assert.ok(view.findByLabel("Follow Mei"));

  useSocialStore.setState({ requestedUserIds: { "u-mei": true } });
  await view.settle();
  assert.ok(view.findByLabel("Follow request sent to Mei"));

  useSocialStore.setState({ followedUserIds: { "u-mei": true }, requestedUserIds: {} });
  await view.settle();
  assert.equal(view.findByLabel("Follow Mei"), null);

  await view.rerender(createElement(PersonFollowPill, { userId: viewerId, name: "Me" }));
  assert.equal(view.findByLabel("Follow Me"), null);
  await view.rerender(createElement(PersonFollowPill, { userId: undefined, name: "Guest" }));
  assert.equal(view.findByLabel("Follow Guest"), null);
});

// ─── Review tab reviewers ────────────────────────────────────────────────────

test("reviewersFromReviews ranks people by reviews on screen and leaves you out", () => {
  const people = reviewersFromReviews(
    [
      review("r1", "u-a", "Arun"),
      review("r2", "u-b", "Bee"),
      review("r3", "u-b", "Bee"),
      review("r4", "me", "Me"),
      review("r5", undefined, "Guest"),
      review("r6", "u-c", "Cai"),
    ],
    "me",
    2,
  );
  assert.deepEqual(
    people.map((person) => [person.userId, person.count]),
    [
      ["u-b", 2],
      ["u-a", 1],
    ],
  );
});

test("ReviewersRail opens a reviewer's portfolio, offers Follow, and hides with one reviewer", async () => {
  const opened: string[] = [];
  const view = await render(
    createElement(ReviewersRail, {
      reviews: [review("r1", "u-a", "Arun"), review("r2", "u-b", "Bee")],
      viewerId: "me",
      onOpen: (person) => opened.push(person.userId),
    }),
  );
  assert.ok(view.findByTestId("reviewers-rail"));
  assert.ok(view.findByLabel("Follow Bee"));
  await view.press(view.findByLabel("Open Arun's Food Portfolio"));
  assert.deepEqual(opened, ["u-a"]);

  await view.rerender(
    createElement(ReviewersRail, {
      reviews: [review("r1", "u-a", "Arun")],
      viewerId: "me",
      onOpen: () => undefined,
    }),
  );
  assert.equal(view.findByTestId("reviewers-rail"), null);
});

// ─── Review cards ────────────────────────────────────────────────────────────

const STALL_REVIEW: StallCommunityReview = {
  id: "row-1",
  reviewId: "rev-1",
  dishId: "dish-1",
  dishName: "Laksa",
  authorId: "u-mei",
  authorName: "Mei",
  rating: 5,
  text: "Rich broth",
  createdAt: "2026-11-07T10:00:00Z",
  photos: [],
};

test("StallReviewCard shows a Follow pill only when follows are on and it is not yours", async () => {
  const props = {
    review: STALL_REVIEW,
    venueId: "venue-1",
    isOwn: false,
    onOpenAuthor: () => undefined,
    onOpenDish: () => undefined,
    onUpdated: () => undefined,
    onRemoved: () => undefined,
  };
  const view = await render(createElement(StallReviewCard, props));
  assert.equal(view.findByLabel("Follow Mei"), null);
  await view.rerender(createElement(StallReviewCard, { ...props, followable: true }));
  assert.ok(view.findByLabel("Follow Mei"));
  await view.rerender(createElement(StallReviewCard, { ...props, followable: true, isOwn: true }));
  assert.equal(view.findByLabel("Follow Mei"), null);
});

test("ProfileReviewCard opens the review page and links the stall when both are given", async () => {
  const opened: string[] = [];
  const view = await render(
    createElement(ProfileReviewCard, {
      review: { ...review("rev-9", "u-mei", "Mei"), dishId: "dish-1", venueId: "venue-1" },
      dish: { status: "ready", name: "Laksa", stallName: "Sungei Road" },
      onOpenDish: () => opened.push("dish"),
      onOpenReview: () => opened.push("review"),
      onOpenStall: () => opened.push("stall"),
      testID: "card",
    }),
  );
  await view.press(view.findByLabel("Review of Laksa, rated 4 out of 5"));
  await view.press(view.findByLabel("Open Sungei Road"));
  assert.deepEqual(opened, ["review", "stall"]);
});

test("ProfileReviewCard without the new links still opens the dish and shows a plain stall", async () => {
  const opened: string[] = [];
  const view = await render(
    createElement(ProfileReviewCard, {
      review: { ...review("rev-9", "u-mei", "Mei"), dishId: "dish-1" },
      dish: { status: "ready", name: "Laksa", stallName: "Sungei Road" },
      onOpenDish: () => opened.push("dish"),
    }),
  );
  assert.equal(view.findByLabel("Open Sungei Road"), null);
  assert.ok(view.findByText("Sungei Road"));
  await view.press(view.findByLabel("Review of Laksa, rated 4 out of 5"));
  assert.deepEqual(opened, ["dish"]);
});

test("ListRow draws a chevron only on a row that opens something", async () => {
  const view = await render(
    createElement(ListRow, {
      title: "Mei",
      chevron: true,
      onPress: () => undefined,
      testID: "row",
    }),
  );
  const withChevron = view.html();
  await view.rerender(createElement(ListRow, { title: "Mei", chevron: true, testID: "row" }));
  assert.notEqual(withChevron, view.html());
});

// ─── Screens ─────────────────────────────────────────────────────────────────

test("Compare palates links to the other diner's profile in every finished state", async () => {
  stub(getHungryService().social, "getTasteComparison", async () => null);
  const view = await renderScreen(TasteCompareScreen as never, {
    name: "TasteCompare",
    params: { userId: "u-mei", userDisplayName: "Mei" },
  });
  assert.ok(view.findByTestId("taste-compare-none"));
  await view.press(view.findByText("Open Mei's profile"));
  const call = view.navigation.calls.find((entry) => entry.method === "navigate");
  assert.deepEqual(call?.args, ["UserProfile", { authorId: "u-mei", authorName: "Mei" }]);
});

test("Follow requests rows say they open the profile, and approving offers View", async () => {
  stub(getHungryService().social, "listFollowRequests", async () => [
    { userId: "u-ahmad", displayName: "Ahmad", requestedAt: "2026-10-30T00:00:00Z" },
  ]);
  stub(getHungryService().social, "approveFollowRequest", async () => undefined);
  const { useUIStore } = await import("@/store/useUIStore");
  const view = await renderScreen(FollowRequestsScreen as never, { name: "FollowRequests" });
  assert.ok(view.findByText("See their profile"));
  await view.press(view.findByLabel("Approve follow request from Ahmad"));
  const toast = useUIStore.getState().toast;
  assert.equal(toast?.action?.label, "View");
  toast?.action?.onPress();
  assert.ok(
    view.navigation.calls.some(
      (entry) =>
        entry.method === "navigate" &&
        entry.args[0] === "UserProfile" &&
        (entry.args[1] as { authorId?: string }).authorId === "u-ahmad",
    ),
  );
});
