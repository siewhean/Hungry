// Reviews page group: ReviewDetail menus, the Reviews grid experiment and like ordering.
// Run with `node scripts/test-render.mjs src/app/screens/review/reviews.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";
import { Alert } from "react-native";

import { ReviewDetailScreen } from "@/app/screens/review/ReviewDetailScreen";
import { ReviewScreen } from "@/app/screens/review/ReviewScreen";
import { ReviewFeedScreen } from "@/app/screens/review/ReviewFeedScreen";
import { ReviewSuccessModal } from "@/app/screens/review/ReviewSuccessModal";
import {
  OwnReviewActions,
  ReviewPhotoStrip,
  ReviewReaderActions,
  TasteRatingInput,
} from "@/components/review";
import {
  clearDeletedReviewsForSession,
  reviewTileHoldAction,
} from "@/features/review/reviewExplore";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  clearExperimentOverrides,
  resetExperimentSession,
  setExperimentFlagSource,
  setExperimentOverride,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import type { HungryService, RecentReviewFeedEntry } from "@/lib/services/types";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, createFakeNavigation, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
});
afterEach(async () => {
  await cleanup();
  clearDeletedReviewsForSession();
  Alert.alert = originalAlert;
  setExperimentFlagSource(undefined);
  resetExperimentSession();
  clearExperimentOverrides();
  useReviewDraftStore.getState().resetDraft();
});

const originalAlert = Alert.alert;

/** Answers every Alert by pressing the button named next in `answers`; records the titles. */
function answerAlerts(answers: string[]) {
  const titles: string[] = [];
  Alert.alert = ((
    title: string,
    _message?: string,
    buttons?: { text?: string; onPress?: () => void }[],
  ) => {
    titles.push(title);
    const label = answers.shift();
    buttons?.find((button) => button.text === label)?.onPress?.();
  }) as typeof Alert.alert;
  return titles;
}

/** A fake navigation that can blur and refocus the screen, like leaving and coming back. */
function focusableNavigation() {
  const navigation = createFakeNavigation();
  const listeners = new Map<string, Set<() => void>>();
  let focused = true;
  Object.assign(navigation, {
    isFocused: () => focused,
    addListener: (type: string, listener: () => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)?.add(listener);
      return () => listeners.get(type)?.delete(listener);
    },
  });
  const emit = (type: "focus" | "blur") => {
    focused = type === "focus";
    for (const listener of [...(listeners.get(type) ?? [])]) listener();
  };
  return { navigation, emit };
}

/** Holds a pressable for longer than the long-press delay (react-native-web responder). */
async function holdDown(view: Awaited<ReturnType<typeof render>>, target: HTMLElement | null) {
  assert.ok(target, "hold target not found");
  const init = { bubbles: true, cancelable: true, button: 0 };
  const PointerCtor = (window as unknown as { PointerEvent?: typeof MouseEvent }).PointerEvent;
  target.dispatchEvent(
    PointerCtor ? new PointerCtor("pointerdown", init) : new window.MouseEvent("mousedown", init),
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  target.dispatchEvent(
    PointerCtor ? new PointerCtor("pointerup", init) : new window.MouseEvent("mouseup", init),
  );
  await view.settle();
}

/** Reads what reportError logs in development, so a test can tell what reached Sentry. */
async function captureReportedErrors(run: () => Promise<void>): Promise<unknown[]> {
  const errors: unknown[] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") errors.push(args[1]);
  };
  try {
    await run();
  } finally {
    console.error = original;
    globals.__DEV__ = previousDev;
  }
  return errors;
}

function entry(
  id: string,
  authorId: string,
  overrides: Partial<RecentReviewFeedEntry["review"]> = {},
) {
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

test("ReviewDetail: the dish is named once, Share is in the header and View dish is the main button (RA-3, RA-4)", async () => {
  useLiveReviews({ getReviewById: async () => entry("r-other", "user-emma") });
  const view = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: "r-other" },
  });
  const text = view.text();
  assert.equal(text.split("Katong Laksa").length - 1, 1, "the dish name appears once");
  assert.ok(view.findByLabel("Open Laksa Stall"), "the stall is one link line");
  assert.ok(view.findByLabel("Share this review"), "Share is an icon button in the header");
  assert.equal(view.findByText("Share this review"), null, "no stacked Share button");
  assert.ok(view.findByText("View dish"));
  assert.ok(view.findByText("I had this too"));
  assert.equal(view.findByText("See Katong Laksa"), null);
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
      getTrackedAnalyticsEvents().filter((event) => event.event === "review_helpful_toggled")
        .length,
      3,
    );
  } finally {
    reviews.setReviewHelpful = original;
  }
});

// ─── Round-three post-verify (REV-V1..V5, REV-19) ────────────────────────────

test("ReviewDetail refetches on refocus without a skeleton and takes the new like count (REV-2, REV-V3)", async () => {
  let reads = 0;
  useLiveReviews({
    getReviewById: async () => {
      reads += 1;
      return entry("r-other", "user-emma", { helpfulCount: reads === 1 ? 1 : 5 });
    },
  });
  const { navigation, emit } = focusableNavigation();
  const view = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: "r-other" },
    navigation,
  });
  assert.equal(reads, 1);
  assert.ok(view.findByLabel("Like, 1 like"));
  emit("blur");
  emit("focus");
  await view.settle();
  assert.equal(reads, 2, "coming back reads the review again");
  assert.equal(view.findByLabel("Loading review"), null, "no skeleton on a refocus");
  assert.ok(view.findByLabel("Like, 5 likes"), "the heart shows the refetched count");
});

test("the success modal's View review opens the posted review (REV-2)", async () => {
  useLiveReviews({});
  const opened: string[] = [];
  useUIStore.getState().showReviewSuccess({
    reviewId: "r-new",
    dishName: "Katong Laksa",
    venueName: "Laksa Stall",
    xpEarned: 10,
  });
  const view = await render(
    createElement(ReviewSuccessModal, {
      onOpenHistory: () => undefined,
      onOpenReview: (id: string) => opened.push(id),
    }),
  );
  await view.press(view.findByText("View review"));
  assert.deepEqual(opened, ["r-new"]);
  assert.equal(useUIStore.getState().reviewSuccess, null);
});

test("a review deleted on ReviewDetail leaves the Reviews grid on its next focus (REV-V1)", async () => {
  const me = useProfileStore.getState().profile.id;
  const deleted: string[] = [];
  useLiveReviews({
    getReviewById: async () => entry("mine", me),
    listRecentReviewsPage: async () => ({
      entries: [entry("mine", me), entry("r1", "user-emma")],
      hasMore: false,
    }),
    deleteReview: async (id: string) => {
      deleted.push(id);
    },
  });
  const grid = focusableNavigation();
  const gridView = await renderScreen(ReviewFeedScreen as never, {
    name: "Review",
    navigation: grid.navigation,
  });
  assert.ok(gridView.findByTestId("review-tile-mine"));
  grid.emit("blur");

  const detail = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: "mine" },
  });
  answerAlerts(["Delete review", "Delete"]);
  await detail.press(detail.findByLabel("Manage your review"));
  assert.deepEqual(deleted, ["mine"]);

  grid.emit("focus");
  await gridView.settle();
  assert.equal(gridView.findByTestId("review-tile-mine"), null, "the deleted tile is gone");
  assert.ok(gridView.findByTestId("review-tile-r1"));
});

test("holding your own tile opens Edit / Delete, not Report (REV-4a)", async () => {
  const me = useProfileStore.getState().profile.id;
  useLiveReviews({
    listRecentReviewsPage: async () => ({ entries: [entry("mine", me)], hasMore: false }),
  });
  const titles = answerAlerts([]);
  const view = await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  await holdDown(view, view.findByTestId("review-tile-mine"));
  assert.deepEqual(titles, ["Your review"]);
  assert.equal(useUIStore.getState().safetyMenu, null, "no report menu for your own review");
});

test("holding your own tile does nothing when editing is unavailable (REV-V2)", async () => {
  assert.equal(reviewTileHoldAction({ isOwn: true, canEditOwnReviews: false }), null);
  assert.equal(reviewTileHoldAction({ isOwn: true, canEditOwnReviews: true }), "manage");
  assert.equal(reviewTileHoldAction({ isOwn: false, canEditOwnReviews: false }), "report");
  const me = useProfileStore.getState().profile.id;
  useLiveReviews({
    listRecentReviewsPage: async () => ({ entries: [entry("mine", me)], hasMore: false }),
    updateReview: undefined,
    deleteReview: undefined,
  });
  const titles = answerAlerts([]);
  const view = await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  await holdDown(view, view.findByTestId("review-tile-mine"));
  assert.deepEqual(titles, []);
  assert.equal(useUIStore.getState().safetyMenu, null);
});

test("For your taste with no match shows its own empty state and Show all reviews (REV-9)", async () => {
  // The review's dish is not in the catalog, so it can never match the diner's palette.
  useLiveReviews({
    listRecentReviewsPage: async () => ({
      entries: [{ ...entry("r1", "user-emma"), dishId: "dish-not-in-catalog" }],
      hasMore: false,
    }),
  });
  const view = await renderScreen(ReviewFeedScreen as never, { name: "Review" });
  const tasteChip = view.findByText("For your taste");
  assert.ok(tasteChip, "the diner has a palette, so the taste chip shows");
  await view.press(tasteChip);
  assert.match(view.text(), /No reviews for your taste yet/);
  assert.equal(view.findByTestId("review-tile-r1"), null);
  await view.press(view.findByText("Show all reviews"));
  assert.ok(view.findByTestId("review-tile-r1"));
});

test("the empty Reviews tab invites the first review with a Write a review button (RA-2)", async () => {
  useLiveReviews({ listRecentReviewsPage: async () => ({ entries: [], hasMore: false }) });
  const navigation = createFakeNavigation();
  const view = await renderScreen(ReviewFeedScreen as never, { name: "Review", navigation });
  assert.match(view.text(), /Be the first to review a dish/);
  assert.doesNotMatch(view.text(), /pen button/);
  await view.press(view.findByText("Write a review"));
  assert.equal(reviewEvents("review_empty_state_cta_pressed").length, 1);
  assert.deepEqual(navigation.calls.at(-1), {
    method: "navigate",
    args: ["ReviewStack", { screen: "ReviewMain" }],
  });
});

test("each taste is one labelled radio group with five radios (REV-16)", async () => {
  const view = await render(
    createElement(TasteRatingInput, { values: { spicy: 2 }, onChange: () => undefined }),
  );
  const groups = Array.from(document.body.querySelectorAll('[role="radiogroup"]'));
  assert.ok(groups.length >= 5);
  for (const group of groups) {
    assert.ok(group.getAttribute("aria-label"), "each group is named after its taste");
    assert.equal(group.querySelectorAll('[role="radio"]').length, 5);
  }
  assert.ok(view.findByLabel("Spicy"));
});

test("an expected edit refusal stays out of Sentry; a real failure on a dish page reports (REV-V5)", async () => {
  const reviews = getHungryService().reviews;
  const original = reviews.updateReview;
  let failure: unknown = { code: "23514", message: "Please keep reviews friendly" };
  reviews.updateReview = async () => {
    throw failure;
  };
  try {
    const errors = await captureReportedErrors(async () => {
      const view = await render(
        createElement(OwnReviewActions, {
          review: { id: "r-own", rating: 4, text: "Good" },
          onUpdated: () => undefined,
          onDeleted: () => undefined,
        }),
      );
      await view.press(view.findByLabel("Edit your review"));
      await view.press(view.findByText("Save"));
      failure = new Error("connection reset by peer");
      await view.press(view.findByText("Save"));
    });
    assert.deepEqual(
      errors.map((error) => (error as Error).message),
      ["connection reset by peer"],
    );
  } finally {
    reviews.updateReview = original;
  }
});

test("tapping a review photo opens it full screen (REV-19)", async () => {
  const view = await render(
    createElement(ReviewPhotoStrip, {
      photos: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      subject: "Katong Laksa, review by Emma",
    }),
  );
  assert.equal(view.findByLabel("Close photos"), null);
  await view.press(view.findByLabel("Photo 2 of 2, Katong Laksa, review by Emma"));
  assert.ok(view.findByLabel("Close photos"), "the full-screen viewer is open");
});

test("the Select stall & dish search fills the row beside Close instead of collapsing", async () => {
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.press(view.findByText("Select stall & dish"));
  await view.settle();
  const search = view.findByLabel("Search dishes or stalls");
  assert.ok(search, "the picker's search field is on screen");
  // Input's own wrapper sizes to its content, so the field only fills the row when something
  // around it takes the free width (flex: 1) and can shrink (min-width: 0).
  const slot = search.parentElement?.parentElement?.parentElement;
  assert.match(slot?.getAttribute("style") ?? "", /flex: 1 1 0%/);
  assert.match(slot?.getAttribute("style") ?? "", /min-width: 0px/);
  // Buttons are 100% wide by default; Close would take the whole row and squeeze the field.
  const close = view.findByLabel("Close") ?? view.findByText("Close");
  assert.ok(close, "Close sits beside it");
  assert.doesNotMatch(
    close.closest("button, [role=button]")?.getAttribute("style") ?? "",
    /width: 100%/,
  );
});

// ─── Editor and dish picker (REV-5, REV-10, REV-11, REV-13, REV-14, REV-21) ──

/** Two dishes at two different stalls of the mock catalog. */
function twoDishes() {
  const repository = getDataRepository();
  const dishes = repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id))
    .flatMap((venue) => repository.listDishesByVenue(venue.id));
  const first = dishes[0];
  const second = dishes.find((dish) => dish.venueId !== first.venueId) ?? dishes[1];
  return { first, second };
}

function reviewEvents(name: string) {
  return getTrackedAnalyticsEvents().filter((event) => event.event === name);
}

test("switching dish with only tags set asks first, and review_started is sent once per draft (REV-13)", async () => {
  const { first, second } = twoDishes();
  const draft = useReviewDraftStore.getState();
  draft.selectDish(first.venueId, first.id);
  draft.toggleTag("Spicy");
  const titles = answerAlerts(["Keep current dish", "Change dish"]);
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.press(view.findByLabel("Change dish"));
  await view.settle();
  const secondVenue = getDataRepository().getVenueById(second.venueId);
  await view.press(view.findByLabel(`Choose a dish at ${secondVenue?.name}`));
  await view.press(view.findByLabel(`Review ${second.name}`));
  assert.deepEqual(titles, ["Change dish?"], "tags alone count as something to lose");
  assert.equal(useReviewDraftStore.getState().draft.selectedDishId, first.id);

  await view.press(view.findByLabel(`Review ${second.name}`));
  assert.equal(useReviewDraftStore.getState().draft.selectedDishId, second.id);
  assert.equal(reviewEvents("review_started").length, 1, "one attempt, however many dishes");
});

test("the dish picker says which building a stall is in (REV-10)", async () => {
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.press(view.findByText("Select stall & dish"));
  await view.settle();
  const building = getDataRepository().listBuildings()[0];
  assert.match(view.text(), new RegExp(building.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("the dish picker searches the server once typing pauses and shows its building (REV-11)", async () => {
  const base = getServiceProvider();
  const calls: string[] = [];
  const discovery = {
    ...base.service.discovery,
    searchVenuesByLocation: async (request: { query?: string }) => {
      calls.push(`venues:${request.query}`);
      return [
        {
          id: "srv-venue",
          buildingId: "srv-building",
          buildingName: "Faraway Food Centre",
          name: "Server Only Stall",
          unitNumber: "#01-01",
          floor: "1",
          isOpen: true,
          topDishId: "",
          operatingHours: "",
          deliveryLinks: [],
        },
      ];
    },
    searchDishes: async () => {
      calls.push("dishes");
      return [];
    },
  };
  setServiceProvider({ ...base, service: { ...base.service, discovery } });

  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.press(view.findByText("Select stall & dish"));
  await view.settle();
  const field = view.findByLabel("Search dishes or stalls");
  await view.type(field, "ser");
  await view.type(field, "serv");
  assert.deepEqual(calls, [], "nothing is sent while typing");
  await new Promise((resolve) => setTimeout(resolve, 400));
  await view.settle();
  assert.deepEqual(calls, ["venues:serv", "dishes"], "one request for the paused query");
  assert.ok(view.findByText("Server Only Stall"));
  assert.ok(view.findByText("Faraway Food Centre · #01-01"));
});

test("a failed picker search falls back to the cached catalog and is reported (REV-11)", async () => {
  const { first } = twoDishes();
  const base = getServiceProvider();
  const discovery = {
    ...base.service.discovery,
    searchVenuesByLocation: async () => {
      throw new Error("search offline");
    },
  };
  setServiceProvider({ ...base, service: { ...base.service, discovery } });
  const errors = await captureReportedErrors(async () => {
    const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
    await view.press(view.findByText("Select stall & dish"));
    await view.settle();
    await view.type(view.findByLabel("Search dishes or stalls"), first.name);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await view.settle();
    assert.ok(view.findByLabel(new RegExp(`^Review ${first.name} at `)), "cached dish row shown");
  });
  assert.deepEqual(
    errors.map((error) => (error as Error).message),
    ["search offline"],
  );
});

test("the editor is the compact one for everyone: Cancel and one Publish in the header, optional parts folded (RA-1)", async () => {
  const { first } = twoDishes();
  useReviewDraftStore.getState().selectDish(first.venueId, first.id);
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  assert.ok(view.findByLabel("Cancel"), "Cancel sits in the header");
  const headerPublish = view.findByText("Publish")?.closest("[role=button], button");
  assert.ok(headerPublish, "Publish is in the header");
  assert.equal(headerPublish.getAttribute("aria-disabled"), "true", "no photo yet");
  assert.equal(view.findByText("Publish review"), null, "no second Publish at the bottom");
  assert.ok(view.findByText("Add a photo of the dish to publish."), "the reason is still said");
  assert.equal(view.findByText("Taste tags"), null, "tags are folded away");
  await view.press(view.findByLabel("Add more detail (optional)"));
  assert.ok(view.findByText("Taste tags"));
  assert.ok(view.findByText("Would you recommend it?"));
});

test("the editor reports the compact variant on every field event (RA-1)", async () => {
  const { first } = twoDishes();
  useReviewDraftStore.getState().selectDish(first.venueId, first.id);
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  useReviewDraftStore.getState().setRating(4);
  await view.settle();
  const variants = reviewEvents("review_editor_field_completed").map(
    (event) => event.properties?.variant,
  );
  assert.ok(variants.length > 0);
  assert.ok(variants.every((variant) => variant === "compact"));
});

test("a dish with no photo shows a tile, not a blank gap, in the editor's dish card (RA-5)", async () => {
  const { first } = twoDishes();
  const repository = getDataRepository();
  const dish = repository.getDishById(first.id);
  assert.ok(dish);
  const original = dish.imageUrl;
  dish.imageUrl = "";
  try {
    useReviewDraftStore.getState().selectDish(first.venueId, first.id);
    const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
    assert.equal(view.findByLabel(`${first.name} photo`), null);
    assert.ok(view.findByLabel("Change dish"));
  } finally {
    dish.imageUrl = original;
  }
});

test("review_editor_field_completed fires once per field (REV-21)", async () => {
  const { first } = twoDishes();
  useReviewDraftStore.getState().selectDish(first.venueId, first.id);
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  const store = useReviewDraftStore.getState();
  store.setRating(4);
  await view.settle();
  store.setRating(5);
  store.setText("Great");
  store.setText("Great broth");
  await view.settle();
  const fields = reviewEvents("review_editor_field_completed").map(
    (event) => event.properties?.field,
  );
  assert.deepEqual([...fields].sort(), ["dish", "rating", "text"]);
});

test("review_feed_viewed fires once per focus, not for a preloaded tab (REV-21)", async () => {
  useLiveReviews({
    listRecentReviewsPage: async () => ({ entries: [entry("r1", "user-emma")], hasMore: false }),
  });
  const { navigation, emit } = focusableNavigation();
  const view = await renderScreen(ReviewFeedScreen as never, { name: "Review", navigation });
  assert.equal(reviewEvents("review_feed_viewed").length, 1);
  emit("blur");
  await view.settle();
  assert.equal(reviewEvents("review_feed_viewed").length, 1, "leaving is not a view");
  emit("focus");
  await view.settle();
  assert.equal(reviewEvents("review_feed_viewed").length, 2);
});
