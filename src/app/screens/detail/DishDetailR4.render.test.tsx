// Round-four dish page fixes (DISH4-*). Run with `node scripts/test-render.mjs <this file>`.

import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";

import { DishDetailScreenV2 } from "@/app/screens/detail/DishDetailScreenV2";
import { DishReviewsScreen } from "@/app/screens/detail/DishReviewsScreen";
import { clearTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  resetExperimentSession,
  setExperimentFlagSource,
  setExperimentOverride,
  clearExperimentOverrides,
} from "@/lib/experiments/experiments";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import type { HungryService, RecentReviewFeedEntry } from "@/lib/services/types";
import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import { useProfileStore } from "@/store/useProfileStore";
import { useUIStore } from "@/store/useUIStore";
import { cleanup, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { DishDetail, Review } from "@/types/domain";

const baseProvider = getServiceProvider();
let restores: (() => void)[] = [];

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
});
afterEach(async () => {
  await cleanup();
  for (const restore of restores.reverse()) restore();
  restores = [];
  setServiceProvider(baseProvider);
  setExperimentFlagSource(undefined);
  clearExperimentOverrides();
  resetExperimentSession();
});

function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

function review(id: string, over: Partial<Review> = {}): Review {
  return {
    id,
    authorId: `user-${id}`,
    authorName: `Diner ${id}`,
    rating: 4,
    text: `Review ${id}`,
    createdAt: "2026-10-20T10:00:00.000Z",
    photos: [],
    tags: [],
    wouldRecommend: true,
    ...over,
  };
}

function stubReviews(entries: Review[]) {
  stub(getHungryService().reviews, "listRecentReviews", (async () =>
    entries.map((entry) => ({ review: entry }) as RecentReviewFeedEntry)) as never);
}

/** A dish with a usable taste estimate and no review from this diner. */
function pickDish(): DishDetail {
  const dish = getDataRepository().listPopularNearby()[0];
  const profile = useProfileStore.getState().profile;
  useProfileStore.setState({
    profile: {
      ...profile,
      reviewedDishIds: profile.reviewedDishIds.filter((id) => id !== dish.id),
    },
  });
  const withTaste = {
    ...dish,
    tasteVector: { sweet: 1, spicy: 8, sour: 2, salty: 5, rich: 6, aromatic: 3 },
    tasteConfidence: 0.9,
  };
  stub(getDataRepository(), "getDishById", ((id: string) =>
    id === dish.id ? withTaste : undefined) as never);
  return withTaste;
}

const open = async (params: Record<string, unknown> = {}) => {
  const dish = pickDish();
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: dish.id, source: "home", ...params },
  });
  return { dish, view };
};

function setPalate(palate: boolean) {
  const profile = useProfileStore.getState().profile;
  useProfileStore.setState({
    profile: {
      ...profile,
      tasteVector: palate
        ? { sweet: 2, spicy: 9, sour: 5, salty: 5, rich: 5, aromatic: 5 }
        : NEUTRAL_TASTE_VECTOR,
    },
  });
}

/** Collects reportError calls (it logs them under __DEV__). */
async function collectReports(body: () => Promise<void>) {
  const reports: { action?: string }[] = [];
  const original = console.error;
  const globals = globalThis as { __DEV__?: boolean };
  const previousDev = globals.__DEV__;
  globals.__DEV__ = true;
  console.error = (...args: unknown[]) => {
    if (args[0] === "[reportError]") reports.push(args[2] as { action?: string });
  };
  try {
    await body();
  } finally {
    console.error = original;
    globals.__DEV__ = previousDev;
  }
  return reports;
}

// ─── Bar and header (DISH4-1, DISH4-5) ─────────────────────────────────────────────────

test("Share is in the header and Like is gone: the bar holds only Tried and Save", async () => {
  stubReviews([]);
  const { dish, view } = await open();
  assert.ok(view.findByLabel(`Share ${dish.name}`), "Share sits in the header");
  assert.equal(view.findByLabel("Like this dish"), null);
  assert.equal(view.findByLabel("Unlike this dish"), null);
  const bar = view.findByTestId("dish-action-bar");
  assert.ok(bar);
  assert.equal(bar.querySelector(`[aria-label="Share ${dish.name}"]`), null, "no Share in the bar");
  assert.equal(bar.querySelector('[aria-label="Share"]'), null);
  // Two icon buttons and the call to action.
  assert.equal(bar.querySelectorAll('[role="button"], [role="checkbox"]').length, 3);
});

test("the Tried caption is the same short word before and after the mark", async () => {
  stubReviews([]);
  const { view } = await open();
  const bar = view.findByTestId("dish-action-bar");
  assert.ok(bar);
  assert.match(bar.textContent ?? "", /Write a review/);
  assert.doesNotMatch(bar.textContent ?? "", /Mark tried/);
  assert.match(bar.textContent ?? "", /Tried/);
});

test("the header opens the share sheet", async () => {
  stubReviews([]);
  const { dish, view } = await open();
  await view.press(view.findByLabel(`Share ${dish.name}`));
  assert.match(view.text(), /Copy link|WhatsApp|Share/);
});

// ─── Taste (DISH4-4, DISH4-6) ──────────────────────────────────────────────────────────

test("without a palate the heading is 'How it tastes' and the quiz line is a button", async () => {
  stubReviews([]);
  setPalate(false);
  const { view } = await open();
  assert.ok(view.findByText("How it tastes"));
  assert.equal(view.findByText("How it tastes to you"), null);
  const quiz = view.findByLabel("Take the taste quiz to see how it tastes to you");
  assert.ok(quiz, "the quiz line is a real button");
  await view.press(quiz);
  assert.deepEqual(view.navigation.calls.find((call) => call.args[0] === "OnboardingStack")?.args, [
    "OnboardingStack",
    { screen: "TasteQuiz", params: { mode: "profile" } },
  ]);
});

test("with a palate the heading says 'to you'", async () => {
  stubReviews([]);
  setPalate(true);
  const { view } = await open();
  assert.ok(view.findByText("How it tastes to you"));
});

test("diner ratings are drawn over the estimate and the legend says how many diners", async () => {
  stubReviews([]);
  stub(getHungryService().discovery, "getDishTasteRatingSummary", (async () => ({
    spicy: { average: 4.5, raters: 5 },
    rich: { average: 8, raters: 3 },
  })) as never);
  const { view } = await open();
  assert.match(view.text(), /From 5 diners/);
  assert.match(view.text(), /Typical taste \(estimate\)/);
});

test("with no axis rated by 3 diners the chart is the estimate alone", async () => {
  stubReviews([]);
  stub(getHungryService().discovery, "getDishTasteRatingSummary", (async () => ({})) as never);
  const { view } = await open();
  assert.doesNotMatch(view.text(), /From \d+ diner/);
  assert.match(view.text(), /Typical taste \(estimate\)/);
});

test("a failed taste summary keeps the estimate and is reported once", async () => {
  stubReviews([]);
  stub(getHungryService().discovery, "getDishTasteRatingSummary", (async () => {
    throw new Error("rpc down");
  }) as never);
  const reports = await collectReports(async () => {
    const { view } = await open();
    assert.match(view.text(), /Typical taste \(estimate\)/);
  });
  assert.equal(reports.filter((report) => report.action === "load_taste_summary").length, 1);
});

// ─── Reviews (DISH4-7, DISH4-8) ────────────────────────────────────────────────────────

test("the count line separates ratings from written reviews and the summary shows the histogram", async () => {
  stubReviews([
    review("a", { rating: 5, tags: ["Crispy"] }),
    review("b", { rating: 4, tags: ["Crispy"] }),
    review("c", { rating: 4 }),
  ]);
  const { view } = await open();
  assert.match(view.text(), /written reviews/);
  assert.ok(view.findByTestId("dish-review-histogram"), "3 written reviews show the histogram");
  assert.match(view.text(), /People mention/);
  assert.match(view.text(), /Crispy · 2/);
});

test("a dish with fewer than 3 written reviews has no histogram", async () => {
  stubReviews([review("a")]);
  const { view } = await open();
  assert.equal(view.findByTestId("dish-review-histogram"), null);
});

test("the control arm of the summary test keeps only the count line", async () => {
  stubReviews([review("a", { tags: ["Crispy"] }), review("b", { tags: ["Crispy"] }), review("c")]);
  setExperimentOverride("dish_review_summary_v1", "control");
  const { view } = await open();
  assert.equal(view.findByTestId("dish-review-histogram"), null);
  assert.doesNotMatch(view.text(), /People mention/);
});

test("the dish page shows three reviews and 'See all' opens the reviews screen", async () => {
  stubReviews(Array.from({ length: 5 }, (_, index) => review(`r${index}`)));
  const { dish, view } = await open();
  assert.ok(view.findByText("Review r0"));
  assert.ok(view.findByText("Review r2"));
  assert.equal(view.findByText("Review r3"), null, "only the first three");
  const seeAll = view.findByText(/^See all/);
  assert.ok(seeAll);
  await view.press(seeAll);
  assert.deepEqual(view.navigation.calls.find((call) => call.args[0] === "DishReviews")?.args, [
    "DishReviews",
    { dishId: dish.id },
  ]);
});

test("each review shows its stars under the author's name and a visible ⋯ report button", async () => {
  stubReviews([review("a", { rating: 3 })]);
  const { view } = await open();
  assert.ok(view.findByLabel("Rated 3 out of 5"));
  assert.ok(view.findByLabel("Report or block, review by Diner a"));
});

// ─── The reviews screen ───────────────────────────────────────────────────────────────

async function openReviews(entries: Review[]) {
  stubReviews(entries);
  const dish = pickDish();
  const view = await renderScreen(DishReviewsScreen as never, {
    name: "DishReviews",
    params: { dishId: dish.id },
  });
  return { dish, view };
}

const order = (text: string, ids: string[]) =>
  ids
    .map((id) => text.indexOf(`Review ${id}`))
    .every((at, index, all) => at >= 0 && (index === 0 || at > all[index - 1]));

test("sort chips reorder the reviews", async () => {
  const { view } = await openReviews([
    review("low", { rating: 1, createdAt: "2026-10-03T00:00:00Z" }),
    review("high", { rating: 5, createdAt: "2026-10-01T00:00:00Z" }),
    review("mid", { rating: 3, createdAt: "2026-10-02T00:00:00Z" }),
  ]);
  assert.ok(order(view.text(), ["low", "mid", "high"]), "newest first by default");
  await view.press(view.findByLabel("Sort by highest"));
  assert.ok(order(view.text(), ["high", "mid", "low"]));
  await view.press(view.findByLabel("Sort by lowest"));
  assert.ok(order(view.text(), ["low", "mid", "high"]));
});

test("With photos keeps only reviews that have photos", async () => {
  const { view } = await openReviews([
    review("plain"),
    review("pic", { photos: ["https://example.com/p.jpg"] }),
  ]);
  assert.ok(view.findByText("Review plain"));
  await view.press(view.findByLabel("Only reviews with photos"));
  assert.equal(view.findByText("Review plain"), null);
  assert.ok(view.findByText("Review pic"));
});

test("a full page offers 'Show more reviews' and appends the next page", async () => {
  const all = Array.from({ length: 60 }, (_, index) =>
    review(`p${String(index).padStart(2, "0")}`, {
      createdAt: new Date(Date.UTC(2026, 9, 20, 12, 0, 0) - index * 60000).toISOString(),
    }),
  );
  stub(getHungryService().reviews, "listRecentReviews", (async (options: { beforeId?: string }) => {
    const start = options.beforeId
      ? all.findIndex((entry) => entry.id === options.beforeId) + 1
      : 0;
    return all
      .slice(start, start + 50)
      .map((entry) => ({ review: entry }) as RecentReviewFeedEntry);
  }) as never);
  const dish = pickDish();
  const view = await renderScreen(DishReviewsScreen as never, {
    name: "DishReviews",
    params: { dishId: dish.id },
  });
  assert.equal(view.findByText("Review p55"), null);
  await view.press(view.findByText("Show more reviews"));
  assert.ok(view.findByText("Review p55"));
  assert.equal(view.findByText("Show more reviews"), null, "the short second page is the end");
});

test("a failed read shows a retry and reports it", async () => {
  let failing = true;
  stub(getHungryService().reviews, "listRecentReviews", (async () => {
    if (failing) throw new Error("offline");
    return [{ review: review("ok") } as RecentReviewFeedEntry];
  }) as never);
  const dish = pickDish();
  let view!: Awaited<ReturnType<typeof renderScreen>>;
  const reports = await collectReports(async () => {
    view = await renderScreen(DishReviewsScreen as never, {
      name: "DishReviews",
      params: { dishId: dish.id },
    });
  });
  assert.equal(reports.filter((report) => report.action === "load_reviews").length, 1);
  assert.match(view.text(), /Couldn't load reviews/);
  failing = false;
  await view.press(view.findByText("Retry"));
  assert.ok(view.findByText("Review ok"));
});

// ─── Tried: one confirmation at a time (DISH4-9) ──────────────────────────────────────

function stubTried() {
  const original = useProfileStore.getState().setDishTried;
  useProfileStore.setState({ setDishTried: async () => true });
  restores.push(() => useProfileStore.setState({ setDishTried: original }));
}

test("with the popup variant, marking Tried shows the popup and no toast", async () => {
  stubReviews([]);
  stubTried();
  useUIStore.setState({ toast: null });
  const { view } = await open();
  await view.press(view.findByLabel("Tried"));
  assert.match(view.text(), /You tried /);
  assert.equal(useUIStore.getState().toast, null, "the popup is the confirmation");
});

test("with the toast_cta variant, marking Tried shows one toast and no popup", async () => {
  stubReviews([]);
  stubTried();
  useUIStore.setState({ toast: null });
  setExperimentOverride("dish_tried_prompt_v1", "toast_cta");
  const { view } = await open();
  await view.press(view.findByLabel("Tried"));
  assert.doesNotMatch(view.text(), /You tried /);
  assert.equal(useUIStore.getState().toast?.message, "Marked as tried.");
  assert.ok(view.findByLabel("Rate it"));
});

test("a diner who already reviewed the dish gets the toast and no popup", async () => {
  stubTried();
  const dish = pickDish();
  stubReviews([review("mine", { authorId: useProfileStore.getState().profile.id })]);
  useUIStore.setState({ toast: null });
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: dish.id, source: "home" },
  });
  await view.press(view.findByLabel("Tried"));
  assert.doesNotMatch(view.text(), /You tried /);
  assert.equal(useUIStore.getState().toast?.message, "Marked as tried.");
});

// ─── Prefill, missing dish (DISH4-13, DISH4-16) ───────────────────────────────────────

/** Switches to a "supabase" provider whose discovery reads come from `discovery`. */
function useLiveReads(discovery: Partial<HungryService["discovery"]>) {
  const base = getServiceProvider();
  const service = { ...base.service, discovery: { ...base.service.discovery, ...discovery } };
  setServiceProvider({ ...base, mode: "supabase", service });
}

test("a card's prefill paints the name before the dish read lands and starts the stall reads at once", async () => {
  stubReviews([]);
  const calls: string[] = [];
  let release: (dish: DishDetail | undefined) => void = () => undefined;
  const dish = pickDish();
  useLiveReads({
    getDish: () => new Promise((resolve) => (release = resolve)),
    getVenue: async (id: string) => {
      calls.push(`getVenue:${id}`);
      return getDataRepository().getVenueById(id);
    },
    listDishesByVenue: async () => [],
    getVenueOpeningSchedule: async (id: string) => {
      calls.push(`schedule:${id}`);
      return undefined;
    },
    getPublicMerchantProfile: async () => undefined,
    getDishTasteRatingSummary: async () => ({}),
  });
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: {
      dishId: dish.id,
      source: "search",
      prefill: {
        name: "Prefilled Laksa",
        price: 5.5,
        venueId: dish.venueId,
        venueName: "Laksa Stall",
      },
    },
  });
  assert.ok(view.findByText("Prefilled Laksa"), "the name paints before getDish resolves");
  assert.ok(view.findByText("Laksa Stall"));
  assert.ok(calls.includes(`getVenue:${dish.venueId}`), "the stall read did not wait for the dish");
  assert.ok(calls.includes(`schedule:${dish.venueId}`));
  release(dish);
  await view.settle();
  assert.ok(view.findByText(dish.name), "the full page replaces the preview");
});

test("without a prefill the dish page keeps its loading state", async () => {
  stubReviews([]);
  useLiveReads({ getDish: () => new Promise(() => undefined) });
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: "slow-dish" },
  });
  assert.match(view.text(), /Loading dish details/);
});

test("a missing dish's 'Search dishes' opens Search with the name the card knew", async () => {
  stubReviews([]);
  useLiveReads({ getDish: async () => undefined });
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: "gone", prefill: { name: "Chicken Rice" } },
  });
  // The preview shows while loading; a settled missing dish shows the empty state.
  await view.settle();
  const search = view.findByText("Search dishes");
  assert.ok(search);
  await view.press(search);
  assert.deepEqual(view.navigation.calls.find((call) => call.method === "navigate")?.args, [
    "SearchResults",
    { browseMode: "dishes", initialQuery: "Chicken Rice" },
  ]);
});

test("without a name, 'Search dishes' opens the search page", async () => {
  stubReviews([]);
  useLiveReads({ getDish: async () => undefined });
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: "gone" },
  });
  await view.press(view.findByText("Search dishes"));
  assert.deepEqual(view.navigation.calls.find((call) => call.method === "navigate")?.args, [
    "SearchHome",
  ]);
});
