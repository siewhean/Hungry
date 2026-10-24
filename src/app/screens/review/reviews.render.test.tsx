// Reviews page group: ReviewDetail menus, the Reviews grid experiment and like ordering.
// Run with `node scripts/test-render.mjs src/app/screens/review/reviews.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { ReviewDetailScreen } from "@/app/screens/review/ReviewDetailScreen";
import { ReviewFeedScreen } from "@/app/screens/review/ReviewFeedScreen";
import { ReviewReaderActions } from "@/components/review";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import { getHungryService, getServiceProvider, setServiceProvider } from "@/lib/services/serviceProvider";
import type { HungryService, RecentReviewFeedEntry } from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
});
afterEach(async () => {
  await cleanup();
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

function entry(id: string, authorId: string, overrides: Partial<RecentReviewFeedEntry["review"]> = {}) {
  return {
    review: {
      id,
      authorId,
      authorName: authorId === "me" ? "Me" : "Emma",
      rating: 4,
      createdAt: new Date().toISOString(),
      text: "Silky noodles and a deep broth.",
      tags: [],
      wouldRecommend: true,
      photos: ["https://example.com/a.jpg"],
      ...overrides,
    },
    dishId: "dish-laksa",
    dishName: "Katong Laksa",
    venueId: "venue-1",
    venueName: "Laksa Stall",
  } satisfies RecentReviewFeedEntry;
}

/** A live ("supabase" mode) provider whose reviews come from `reviews`. */
function useLiveReviews(reviews: Partial<HungryService["reviews"]>) {
  const base = getServiceProvider();
  const service = { ...base.service, reviews: { ...base.service.reviews, ...reviews } };
  setServiceProvider({ ...base, mode: "supabase", service });
}

function fakeFlags(flags: Record<string, string>) {
  const state = { exposures: [] as string[] };
  const source: ExperimentFlagSource = {
    peek: (key) => flags[key],
    expose: (key) => {
      state.exposures.push(key);
      return flags[key];
    },
    hasLoaded: () => true,
    onChange: () => () => undefined,
  };
  setExperimentFlagSource(source);
  return state;
}

// ─── ReviewDetail ────────────────────────────────────────────────────────────

test("ReviewDetail: someone else's review has a Report / Block menu and a like (REV-1, REV-2)", async () => {
  useLiveReviews({ getReviewById: async () => entry("r-other", "user-emma") });
  const view = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: "r-other" },
  });
  const menu = view.findByLabel("More options");
  assert.ok(menu, "header menu is shown");
  assert.ok(view.findByLabel(/^Like, /), "the like is shown");
  assert.ok(view.findByLabel("Rated 4 out of 5"), "compact read-only stars (REV-14)");
  await view.press(menu);
  assert.equal(
    (await import("@/store/useUIStore")).useUIStore.getState().safetyMenu?.label,
    "review",
  );
});

test("ReviewDetail: your own review has Manage, not Report, and no like (REV-2)", async () => {
  const me = useProfileStore.getState().profile.id;
  useLiveReviews({ getReviewById: async () => entry("r-own", me) });
  const view = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: "r-own" },
  });
  assert.ok(view.findByLabel("Manage your review"));
  assert.equal(view.findByLabel("More options"), null);
  assert.equal(view.findByLabel(/^Like, /), null);
});

test("ReviewDetail: a missing review says so without blaming its author (REV-X4)", async () => {
  useLiveReviews({ getReviewById: async () => null });
  const view = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: "gone" },
  });
  assert.match(view.text(), /removed, or the link is wrong/);
  assert.doesNotMatch(view.text(), /removed by its author/);
});

// ─── Reviews grid: review_tile_labels_v1 ─────────────────────────────────────

test("Reviews grid, control: photo and date only, and opening a tile sends review_opened", async () => {
  const flags = fakeFlags({ review_tile_labels_v1: "control" });
  useLiveReviews({
    listRecentReviewsPage: async () => ({ entries: [entry("r1", "user-emma")], hasMore: false }),
  });
  const view = await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  assert.ok(view.findByTestId("review-tile-r1"));
  assert.equal(view.findByTestId("review-tile-labels"), null);
  assert.doesNotMatch(view.findByTestId("review-tile-r1")?.textContent ?? "", /Katong Laksa/);
  assert.deepEqual(flags.exposures, ["review_tile_labels_v1"]);

  await view.press(view.findByTestId("review-tile-r1"));
  const opened = getTrackedAnalyticsEvents().find((event) => event.event === "review_opened");
  assert.equal(opened?.properties?.review_id, "r1");
  assert.equal(opened?.properties?.source, "grid");
});

test("Reviews grid, labels: the dish name and stars sit on the tile", async () => {
  fakeFlags({ review_tile_labels_v1: "labels" });
  useLiveReviews({
    listRecentReviewsPage: async () => ({ entries: [entry("r1", "user-emma")], hasMore: false }),
  });
  const view = await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  assert.ok(view.findByTestId("review-tile-labels"));
  assert.match(view.findByTestId("review-tile-r1")?.textContent ?? "", /Katong Laksa/);
});

test("Reviews grid: an empty live grid and mock mode never expose the experiment", async () => {
  const flags = fakeFlags({ review_tile_labels_v1: "labels" });
  useLiveReviews({ listRecentReviewsPage: async () => ({ entries: [], hasMore: false }) });
  await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  await cleanup();
  await enterScenario("user");
  await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  assert.deepEqual(flags.exposures, []);
});

test("Reviews grid asks the server for photo reviews only (REV-3)", async () => {
  const seen: unknown[] = [];
  useLiveReviews({
    listRecentReviewsPage: async (options) => {
      seen.push(options?.withPhotos);
      return { entries: [entry("r1", "user-emma")], hasMore: false };
    },
  });
  await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  assert.deepEqual(seen, [true]);
});

test("Reviews grid: your own moderated review is left out of the public grid (REV-X5)", async () => {
  const me = useProfileStore.getState().profile.id;
  useLiveReviews({
    listRecentReviewsPage: async () => ({
      entries: [entry("mine", me, { moderationState: "hidden" }), entry("r1", "user-emma")],
      hasMore: false,
    }),
  });
  const view = await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  assert.equal(view.findByTestId("review-tile-mine"), null);
  assert.ok(view.findByTestId("review-tile-r1"));
});

// ─── Likes ───────────────────────────────────────────────────────────────────

test("like, unlike, like quickly: one request in flight, the final state wins (REV-10)", async () => {
  const sent: boolean[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const reviews = getHungryService().reviews;
  const original = reviews.setReviewHelpful;
  reviews.setReviewHelpful = async (_id, helpful) => {
    sent.push(helpful);
    if (sent.length === 1) await gate;
  };
  try {
    const view = await render(
      createElement(ReviewReaderActions, {
        review: { id: "r-like", authorId: "user-emma", authorName: "Emma", helpfulCount: 0 },
        isOwn: false,
        returnRoute: { name: "ReviewDetail", params: { reviewId: "r-like" } },
        onRemoved: () => undefined,
      }),
    );
    const like = () => view.findByLabel(/^Like, /);
    await view.press(like());
    await view.press(like());
    await view.press(like());
    assert.deepEqual(sent, [true], "later taps wait for the request in flight");
    release();
    await view.settle();
    assert.deepEqual(sent, [true]);
    assert.equal(like()?.getAttribute("aria-label"), "Like, 1 like");
    assert.equal(
      getTrackedAnalyticsEvents().filter((event) => event.event === "review_helpful_toggled").length,
      3,
    );
  } finally {
    reviews.setReviewHelpful = original;
  }
});
