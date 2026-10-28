// Dish page behaviour: refresh on return, the Tried follow-up experiment, review cards and
// reading order. Run with `node scripts/test-render.mjs <this file>`.

import assert from "node:assert/strict";
import { act } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { DishDetailScreenV2 } from "@/app/screens/detail/DishDetailScreenV2";
import { clearTrackedAnalyticsEvents, getTrackedAnalyticsEvents } from "@/lib/analytics";
import {
  resetExperimentSession,
  setExperimentFlagSource,
  type ExperimentFlagSource,
} from "@/lib/experiments/experiments";
import type { HungryService, RecentReviewFeedEntry } from "@/lib/services/types";
import {
  getDataRepository,
  getHungryService,
  getServiceProvider,
  setServiceProvider,
} from "@/lib/services/serviceProvider";
import { useProfileStore } from "@/store/useProfileStore";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { cleanup, createFakeNavigation, renderScreen, type RenderResult } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";
import type { DishDetail, Review } from "@/types/domain";

const { window } = globalThis as unknown as { window: Window & typeof globalThis };

let restores: (() => void)[] = [];

beforeEach(async () => {
  await enterScenario("user");
  clearTrackedAnalyticsEvents();
});
afterEach(async () => {
  await cleanup();
  for (const restore of restores.reverse()) restore();
  restores = [];
  setExperimentFlagSource(undefined);
  resetExperimentSession();
});

function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

function review(id: string, authorId: string | undefined, authorName = "Mei Ling"): Review {
  return {
    id,
    authorId,
    authorName,
    rating: 4,
    text: `Review ${id}`,
    createdAt: "2026-10-20T10:00:00.000Z",
    photos: [],
    tags: [],
  } as unknown as Review;
}

/** A dish that nobody has reviewed and this diner has not tried. */
function pickDish(): DishDetail {
  const dish = getDataRepository().listPopularNearby()[0];
  const profile = useProfileStore.getState().profile;
  useProfileStore.setState({
    profile: {
      ...profile,
      reviewedDishIds: profile.reviewedDishIds.filter((id) => id !== dish.id),
    },
  });
  return dish;
}

/** Reviews served by the stub; change `current` to change what the next read returns. */
function stubReviews(initial: Review[]) {
  const state = { current: initial, calls: 0 };
  stub(getHungryService().reviews, "listRecentReviews", (async () => {
    state.calls += 1;
    return state.current.map((entry) => ({ review: entry }) as RecentReviewFeedEntry);
  }) as never);
  return state;
}

function focusableNavigation() {
  const navigation = createFakeNavigation();
  const listeners = new Map<string, Set<() => void>>();
  const nav = Object.assign(navigation, {
    addListener: (event: string, callback: () => void) => {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(callback);
      return () => listeners.get(event)?.delete(callback);
    },
  });
  const emit = async (event: string) => {
    await act(async () => {
      listeners.get(event)?.forEach((callback) => callback());
    });
  };
  return { navigation: nav, emit };
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

async function openDish(view?: { navigation?: ReturnType<typeof createFakeNavigation> }) {
  const dish = pickDish();
  const rendered = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: dish.id, source: "home_rail" },
    navigation: view?.navigation,
  });
  return { dish, view: rendered };
}

function stubTried() {
  const calls: [string, boolean][] = [];
  const original = useProfileStore.getState().setDishTried;
  useProfileStore.setState({
    setDishTried: async (dishId, tried) => {
      calls.push([dishId, tried]);
      return true;
    },
  });
  restores.push(() => useProfileStore.setState({ setDishTried: original }));
  return calls;
}

const triedButton = (view: RenderResult) => view.findByLabel("Tried");

test("returning to the dish page reloads its reviews and the dish (DISH-1, X6)", async () => {
  const reviews = stubReviews([]);
  let dishReads = 0;
  const discovery = getHungryService().discovery;
  const getDish = discovery.getDish.bind(discovery);
  stub(discovery, "getDish", (async (id: string) => {
    dishReads += 1;
    return getDish(id);
  }) as never);
  const { navigation, emit } = focusableNavigation();
  const { view } = await openDish({ navigation });
  assert.equal(reviews.calls, 1);

  // The diner writes a review in the editor, then comes back to the still-mounted page.
  reviews.current = [review("r-new", useProfileStore.getState().profile.id, "Wei Ming")];
  await emit("blur");
  await emit("focus");
  await view.settle();

  assert.equal(reviews.calls, 2, "reviews are read again on return");
  assert.ok(dishReads >= 1, "the dish is read again even with a warm cache");
  assert.match(view.text(), /Review r-new/);
});

test("dish_viewed says where the dish was opened from (DISH-13)", async () => {
  stubReviews([]);
  const { dish } = await openDish();
  const viewed = getTrackedAnalyticsEvents().find((event) => event.event === "dish_viewed");
  assert.equal(viewed?.properties.dish_id, dish.id);
  assert.equal(viewed?.properties.source, "home_rail");
});

test("TriedFollowUp: viewing the page exposes nobody; a Tried mark shows the control popup (dish_tried_prompt_v1)", async () => {
  stubReviews([]);
  stubTried();
  const flags = fakeFlags({ dish_tried_prompt_v1: "control" });
  const { view } = await openDish();
  assert.deepEqual(flags.exposures, [], "a dish viewer who never marks Tried is not exposed");

  await view.press(triedButton(view));
  assert.deepEqual(flags.exposures, ["dish_tried_prompt_v1"]);
  assert.match(view.text(), /You tried /);
  // DISH-X5: the popup body scrolls, so its buttons stay reachable at large text.
  assert.ok(view.findByTestId("tried-prompt-scroll"));
  assert.ok(getTrackedAnalyticsEvents().some((event) => event.event === "tried_prompt_shown"));

  await view.press(view.findByText("Not now"));
  assert.doesNotMatch(view.text(), /You tried /);
  assert.ok(getTrackedAnalyticsEvents().some((event) => event.event === "tried_prompt_dismissed"));
});

test("the toast_cta variant shows no popup and the bar asks to rate it", async () => {
  stubReviews([]);
  stubTried();
  fakeFlags({ dish_tried_prompt_v1: "toast_cta" });
  const { view } = await openDish();
  assert.ok(view.findByLabel("Write a review"));

  await view.press(triedButton(view));
  assert.doesNotMatch(view.text(), /You tried /);
  assert.ok(view.findByLabel("Rate it"));
});

test("two Tried taps in one frame write once (DISH-20)", async () => {
  stubReviews([]);
  const calls = stubTried();
  const { view } = await openDish();
  const button = triedButton(view);
  assert.ok(button);
  await act(async () => {
    for (let tap = 0; tap < 2; tap += 1) {
      button.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    }
  });
  await view.settle();
  assert.equal(calls.length, 1);
});

test("each review has one author stop and a visible report control (DISH-X7, X3)", async () => {
  stubReviews([review("r1", "user-a"), review("r2", undefined, "Seeded Diner")]);
  const { view } = await openDish();
  const authorLinks = Array.from(
    document.body.querySelectorAll('[aria-label="Open Mei Ling\'s profile"]'),
  );
  assert.equal(authorLinks.length, 1, "avatar and name are one stop");
  assert.equal(view.findByLabel("Open Seeded Diner's profile"), null, "no link without an account");
  assert.ok(view.findByLabel("Report or block, review by Mei Ling"));
  assert.ok(view.findByLabel("Report or block, review by Seeded Diner"));
});

test("the back button comes first for screen readers (DISH-9)", async () => {
  stubReviews([]);
  const { dish, view } = await openDish();
  const html = view.html();
  const back = html.indexOf('aria-label="Go back"');
  const name = html.indexOf(`>${dish.name}<`);
  assert.ok(back >= 0 && name >= 0);
  assert.ok(back < name, "Go back is before the dish name in the tree");
});

test("a short description is plain text, not a button (DISH-22); copy is sentence case (DISH-21)", async () => {
  stubReviews([]);
  const dish = pickDish();
  const repository = getDataRepository();
  const original = repository.getDishById.bind(repository);
  stub(repository, "getDishById", ((id: string) => {
    const found = original(id);
    return found && id === dish.id
      ? { ...found, description: "Poached chicken.", mustOrder: true }
      : found;
  }) as never);
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: dish.id },
  });
  const description = view.findByText("Poached chicken.");
  assert.ok(description);
  assert.equal(description.closest('[role="button"]'), null);
  assert.doesNotMatch(view.text(), /MUST ORDER/);
  assert.match(view.text(), /Must order/);
});

// ─── Round-three post-verify (DISH-V5, DISH-V7) ─────────────────────────────

test("a refresh on return keeps the older reviews the diner paged to (DISH-V5)", async () => {
  const pageSize = 50;
  const at = (index: number) =>
    new Date(Date.UTC(2026, 9, 20, 12, 0, 0) - index * 60000).toISOString();
  const all = Array.from({ length: 70 }, (_, index) => ({
    ...review(`r${String(index).padStart(3, "0")}`, `user-${index}`),
    createdAt: at(index),
  }));
  let calls = 0;
  stub(getHungryService().reviews, "listRecentReviews", (async (options: {
    before?: string;
    beforeId?: string;
  }) => {
    calls += 1;
    const start = options.beforeId
      ? all.findIndex((entry) => entry.id === options.beforeId) + 1
      : 0;
    return all
      .slice(start, start + pageSize)
      .map((entry) => ({ review: entry }) as RecentReviewFeedEntry);
  }) as never);
  const { navigation, emit } = focusableNavigation();
  const { view } = await openDish({ navigation });
  const showAll = view.findByText(/^See all/);
  if (showAll) await view.press(showAll);
  const more = view.findByText(/^(Load|Show) more reviews/);
  assert.ok(more, "a full first page offers more");
  await view.press(more);
  assert.match(view.text(), /Review r065/);

  await emit("blur");
  await emit("focus");
  await view.settle();
  assert.equal(calls, 3);
  assert.match(view.text(), /Review r065/, "the second page is still on screen");
});

test("Not now keeps the popup's stars and taste words as a review draft (DISH-V7)", async () => {
  stubReviews([]);
  stubTried();
  fakeFlags({ dish_tried_prompt_v1: "control" });
  useReviewDraftStore.getState().resetDraft();
  const { dish, view } = await openDish();
  await view.press(triedButton(view));
  await view.press(view.findByTestId("star-4"));
  await view.press(view.findByText("Not now"));
  const { draft } = useReviewDraftStore.getState();
  assert.equal(draft.selectedDishId, dish.id);
  assert.equal(draft.rating, 4);
});

// ─── Live (Supabase) builds ───────────────────────────────────────────────────

/**
 * Switches to a "supabase" provider whose discovery reads come from `discovery`, and whose
 * repository records every dish/stall read (each one would start a full-table download).
 */
function useLiveDishReads(discovery: Partial<HungryService["discovery"]>) {
  const base = getServiceProvider();
  const repositoryReads: string[] = [];
  const watched = new Set(["getDishById", "getVenueById", "listDishesByVenue"]);
  const repository = new Proxy(base.repository, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== "function" || !watched.has(String(property))) return value;
      return (...args: unknown[]) => {
        repositoryReads.push(String(property));
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  const service = { ...base.service, discovery: { ...base.service.discovery, ...discovery } };
  setServiceProvider({ ...base, mode: "supabase", service, repository });
  return repositoryReads;
}

test("on live data the dish page reads the dish, stall and menu through the service only", async () => {
  stubReviews([]);
  const dish = pickDish();
  const venue = getDataRepository().getVenueById(dish.venueId);
  const calls: string[] = [];
  const repositoryReads = useLiveDishReads({
    getDish: async () => {
      calls.push("getDish");
      return dish;
    },
    getVenue: async () => {
      calls.push("getVenue");
      return venue;
    },
    listDishesByVenue: async () => {
      calls.push("listDishesByVenue");
      return [dish];
    },
    getVenueOpeningSchedule: async () => undefined,
    getPublicMerchantProfile: async () => undefined,
  });
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: dish.id, source: "home" },
  });
  assert.ok(view.findByText(dish.name), "the dish renders from the service read");
  assert.deepEqual(repositoryReads, [], "no synchronous repository read on live data");
  assert.ok(calls.includes("getDish"));
  assert.ok(calls.includes("getVenue"));
  assert.ok(calls.includes("listDishesByVenue"));
});

test("a catalog card whose dish page can't be found opens the catalog record instead", async () => {
  stubReviews([]);
  useLiveDishReads({ getDish: async () => undefined });
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: {
      dishId: "catalog-only-dish",
      source: "search",
      catalogFallback: { releaseId: "r-7" },
    },
  });
  assert.deepEqual(view.navigation.calls.find((call) => call.method === "replace")?.args, [
    "CatalogRawDetail",
    { kind: "dish", id: "catalog-only-dish", releaseId: "r-7" },
  ]);
  assert.doesNotMatch(view.text(), /We can't find this dish/);
});

test("without a catalog fallback, or when the read failed, the dish page keeps its own states", async () => {
  stubReviews([]);
  useLiveDishReads({ getDish: async () => undefined });
  let view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: "gone-dish" },
  });
  assert.match(view.text(), /We can't find this dish/);
  assert.equal(view.navigation.calls.filter((call) => call.method === "replace").length, 0);
  await cleanup();

  useLiveDishReads({
    getDish: async () => {
      throw new Error("Couldn't load this dish.");
    },
  });
  view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: "offline-dish", catalogFallback: {} },
  });
  assert.match(view.text(), /Couldn't load this dish/);
  assert.equal(
    view.navigation.calls.filter((call) => call.method === "replace").length,
    0,
    "a network failure offers Try again, not the catalog record",
  );
});

// ─── Rails with no photos (R4-STALL-5 shared item) ────────────────────────────────────────

test("a 'More from' rail where no dish has a photo drops the grey photo blocks", async () => {
  stubReviews([]);
  const dish = pickDish();
  const siblings = getDataRepository()
    .listDishesByVenue(dish.venueId)
    .filter((candidate) => candidate.id !== dish.id);
  assert.ok(siblings.length > 0, "the stall has other dishes");
  stub(getDataRepository(), "listDishesByVenue", (() => [
    dish,
    ...siblings.map((sibling) => ({ ...sibling, imageUrl: "", gallery: [] })),
  ]) as never);
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: dish.id, source: "home" },
  });
  assert.match(view.text(), /More from/);
  assert.ok(view.findByLabel(new RegExp(`^Open ${siblings[0].name}`)), "the sibling is still listed");
  for (const sibling of siblings) {
    assert.equal(
      view.findByLabel(`${sibling.name}, no photo yet`),
      null,
      `${sibling.name} has no grey placeholder block`,
    );
  }
});
