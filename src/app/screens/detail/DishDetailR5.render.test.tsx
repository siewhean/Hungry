// Round-five dish page fixes (DISH5-*) on the whole screen. Run with `node scripts/test-render.mjs <this file>`.

import assert from "node:assert/strict";
import { act } from "react";
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
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
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
  useUIStore.getState().releaseCredToast(false);
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

const open = async (over: Partial<DishDetail> = {}) => {
  const dish = { ...pickDish(), ...over };
  stub(getDataRepository(), "getDishById", ((id: string) =>
    id === dish.id ? dish : undefined) as never);
  const view = await renderScreen(DishDetailScreenV2 as never, {
    name: "DishDetail",
    params: { dishId: dish.id, source: "home" },
  });
  return { dish, view };
};

function stubTried() {
  const original = useProfileStore.getState().setDishTried;
  useProfileStore.setState({ setDishTried: async () => true });
  restores.push(() => useProfileStore.setState({ setDishTried: original }));
}

type FailableImage = HTMLElement & { __triggerError?: () => void };
const images = (root: ParentNode) =>
  Array.from(root.querySelectorAll('[data-stub="expo-image.Image"]')) as FailableImage[];

// ─── DISH5-1: the hero never goes blank ────────────────────────────────────────────────

test("when the hero photo fails to load the page shows the no-photo tile, not a blank block", async () => {
  stubReviews([]);
  const { dish, view } = await open({ imageUrl: "https://cdn.hungry.sg/dish.jpg", gallery: [] });
  assert.equal(view.findByTestId("dish-hero-placeholder"), null, "the photo is tried first");
  const hero = images(view.container)[0];
  assert.ok(hero, "the hero photo is on the page");
  await act(async () => {
    hero.__triggerError?.();
  });
  assert.ok(view.findByTestId("dish-hero-placeholder"), "the fallback tile fills the hero");
  assert.ok(view.findByLabel(`${dish.name} photo unavailable`));
});

test("a dish with no photo gets the same tile in a compact 120pt header", async () => {
  stubReviews([]);
  const { view } = await open({ imageUrl: "", gallery: [] });
  const tile = view.findByTestId("dish-hero-placeholder");
  assert.ok(tile);
  assert.match(tile.parentElement?.outerHTML ?? "", /height: 120px/);
});

test("a photo that fails after the page opened keeps the photo height, so nothing jumps", async () => {
  stubReviews([]);
  const { view } = await open({ imageUrl: "https://cdn.hungry.sg/dish.jpg", gallery: [] });
  await act(async () => {
    images(view.container)[0]?.__triggerError?.();
  });
  const tile = view.findByTestId("dish-hero-placeholder");
  assert.ok(tile);
  assert.doesNotMatch(tile.parentElement?.outerHTML ?? "", /height: 120px/);
});

// ─── DISH5-9 (owner call): the price reads as a menu price ─────────────────────────────

test("the price and the page carry no text star glyph", async () => {
  stubReviews([]);
  const { dish, view } = await open();
  assert.ok(view.findByText(new RegExp(dish.price.toFixed(2).replace(".", "\\."))));
  assert.equal(view.text().includes("★"), false);
});

// ─── DISH5-8, DISH5-11: headings and the quiz line ─────────────────────────────────────

test("the stall rail is headed 'More from this stall' with the stall name under it", async () => {
  stubReviews([]);
  const dish = pickDish();
  const sibling = { ...dish, id: "sibling-dish", name: "Sibling Dish" };
  stub(getDataRepository(), "listDishesByVenue", (() => [dish, sibling]) as never);
  const { view } = await open();
  assert.ok(view.findByText("More from this stall"));
  assert.equal(view.findByText(/^More from (?!this stall)/), null, "no stall name in the heading");
  assert.ok(view.findByText("Sibling Dish"));
});

test("without a palate the quiz is a short button with the reason as a helper line", async () => {
  stubReviews([]);
  setPalateless();
  const { view } = await open();
  assert.ok(view.findByLabel("Take the taste quiz"));
  assert.ok(view.findByText("Take the taste quiz"));
  assert.ok(view.findByText("See how it tastes to you"));
});

function setPalateless() {
  const profile = useProfileStore.getState().profile;
  useProfileStore.setState({ profile: { ...profile, tasteVector: NEUTRAL_TASTE_VECTOR } });
}

// ─── DISH5-4: three tastes, with the rest behind "More tastes" ─────────────────────────

test("top3 arm: the popup asks the dish's three strongest tastes, and More tastes shows the rest", async () => {
  stubReviews([]);
  stubTried();
  setExperimentOverride("dish_tried_prompt_v1", "control");
  setExperimentOverride("dish_tried_taste_axes_v1", "top3");
  const { view } = await open();
  await view.press(view.findByLabel("Tried"));
  // pickDish() tastes: spicy 8, rich 6, salty 5 are the strongest.
  for (const axis of ["Spicy", "Rich", "Salty"]) assert.ok(view.findByLabel(`${axis}: Medium`));
  for (const axis of ["Sweet", "Sour", "Aromatic"]) {
    assert.equal(view.findByLabel(`${axis}: Medium`), null);
  }
  await view.press(view.findByText("More tastes"));
  for (const axis of ["Sweet", "Spicy", "Sour", "Salty", "Rich", "Aromatic"]) {
    assert.ok(view.findByLabel(`${axis}: Medium`), `${axis} after More tastes`);
  }
  assert.equal(view.findByText("More tastes"), null, "the button is spent");
});

test("control arm: the popup asks all six at once, with no More tastes button", async () => {
  stubReviews([]);
  stubTried();
  setExperimentOverride("dish_tried_prompt_v1", "control");
  setExperimentOverride("dish_tried_taste_axes_v1", "control");
  const { view } = await open();
  await view.press(view.findByLabel("Tried"));
  for (const axis of ["Sweet", "Spicy", "Sour", "Salty", "Rich", "Aromatic"]) {
    assert.ok(view.findByLabel(`${axis}: Medium`));
  }
  assert.equal(view.findByText("More tastes"), null);
});

test("an answer given on the short list survives opening More tastes", async () => {
  stubReviews([]);
  stubTried();
  setExperimentOverride("dish_tried_prompt_v1", "control");
  setExperimentOverride("dish_tried_taste_axes_v1", "top3");
  useReviewDraftStore.getState().resetDraft();
  const { dish, view } = await open();
  await view.press(view.findByLabel("Tried"));
  await view.press(view.findByLabel("Spicy: Strong"));
  await view.press(view.findByText("More tastes"));
  await view.press(view.findByLabel("Sweet: Light"));
  await view.press(view.findByText("Not now"));
  const { feltTaste } = useReviewDraftStore.getState();
  assert.deepEqual(feltTaste, { dishId: dish.id, values: { spicy: 7.5, sweet: 2.5 } });
});
