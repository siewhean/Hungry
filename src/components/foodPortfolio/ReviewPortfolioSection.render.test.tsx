// "Add a dish": the Food Portfolio part of the one composer (Public or Only me, the best switch that
// names what it replaces, optional tastes) on its own, then the whole editor publishing the entry.
// Run with `node scripts/test-render.mjs src/components/foodPortfolio/ReviewPortfolioSection.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { PostComposerScreen } from "@/app/screens/post/PostComposerScreen";
import { ReviewScreen } from "@/app/screens/review/ReviewScreen";
import { ReviewPortfolioSection } from "@/components/foodPortfolio/ReviewPortfolioSection";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { getDataRepository, getHungryService } from "@/lib/services/serviceProvider";
import { useReviewDraftStore } from "@/store/useReviewDraftStore";
import { useUIStore } from "@/store/useUIStore";
import type { SubmitReviewInput } from "@/lib/services/types";
import { cleanup, render, renderScreen } from "@/test/render";
import { enterScenario } from "@/test/render/sessions";

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

beforeEach(async () => {
  await enterScenario("user");
  flags.foodPortfolioEnabled = true;
});
afterEach(async () => {
  await cleanup();
  Object.assign(flags, savedFlags);
  useReviewDraftStore.getState().resetDraft();
  while (restores.length) restores.pop()!();
});

const noop = () => undefined;

function section(overrides: Partial<Parameters<typeof ReviewPortfolioSection>[0]> = {}) {
  return createElement(ReviewPortfolioSection, {
    enabled: false,
    onToggle: noop,
    hasPhoto: true,
    felt: {},
    onFeltChange: noop,
    onUseGuess: noop,
    visibility: "public",
    onVisibilityChange: noop,
    foodType: "Chicken Rice",
    makeBest: false,
    onMakeBestChange: noop,
    ...overrides,
  });
}

test("off, the section is only the switch", async () => {
  const view = await render(section());
  assert.ok(view.findByText("Add to my Food Portfolio"));
  assert.equal(view.findByText("Who can see it"), null);
  assert.equal(view.findByText("Rate the tastes (optional)"), null);
});

test("on, it asks for a photo, offers Public or Only me and the best switch naming what it replaces", async () => {
  const choices: unknown[] = [];
  const view = await render(
    section({
      enabled: true,
      hasPhoto: false,
      suggestions: { sweet: 5 },
      currentBest: { dishName: "Hainanese chicken rice", venueName: "Tian Tian" },
      onVisibilityChange: (value) => choices.push(value),
      onMakeBestChange: (value) => choices.push(value),
    }),
  );
  assert.match(view.text(), /Without one, only the review is posted/);
  assert.match(view.text(), /0 of 6 rated/);
  assert.ok(view.findByText("Use our guess for the rest"));
  assert.equal(view.findByText("Where does it rank?"), null, "no place picker any more");
  assert.ok(view.findByText("Make this my best chicken rice"));
  assert.match(
    view.text(),
    /Replaces Hainanese chicken rice at Tian Tian, which stays in your diary\./,
  );
  await view.press(view.findByLabel("Make this my best chicken rice"));
  await view.press(view.findByLabel("Only me"));
  assert.deepEqual(choices, [true, "private"]);
});

test("Only me hides the best switch and says it earns no points; no dish type, no switch", async () => {
  const onlyMe = await render(section({ enabled: true, visibility: "private" }));
  assert.match(onlyMe.text(), /It earns no points and can't be one of your bests/);
  assert.equal(onlyMe.findByText("Make this my best chicken rice"), null);
  await cleanup();
  const untyped = await render(section({ enabled: true, foodType: undefined }));
  assert.doesNotMatch(untyped.text(), /Make this my best/);
  await cleanup();
  const first = await render(section({ enabled: true, currentBest: null }));
  assert.match(first.text(), /Your first best chicken rice\./);
});

/** A catalog dish with a dish type (set for the test when the mock catalog has none). */
function typedDish() {
  const repository = getDataRepository();
  const dishes = repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id))
    .flatMap((venue) => repository.listDishesByVenue(venue.id));
  const dish = dishes.find((item) => item.foodTypeTag) ?? dishes[0];
  const stored = repository.getDishById(dish.id) ?? dish;
  if (!stored.foodTypeTag) {
    stored.foodTypeTag = "laksa";
    restores.push(() => {
      stored.foodTypeTag = undefined;
    });
  }
  return stored;
}

function stubPicks(best: { dishName: string; venueName: string } | null) {
  const dish = typedDish();
  stub(getHungryService().foodPortfolio, "getPicks", async () => ({
    topThree: [],
    bests: best
      ? [{ foodType: dish.foodTypeTag as string, post: { id: "old", ...best } as never }]
      : [],
  }));
  return dish;
}

test("the editor is Add a dish: the entry is on by default and a photo is still optional", async () => {
  const dish = stubPicks(null);
  const draft = useReviewDraftStore.getState();
  draft.selectDish(dish.venueId, dish.id);
  draft.setRating(4);
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.settle();
  assert.ok(view.findByText("Add a dish"));
  assert.ok(view.findByText("Who can see it"), "on by default");
  // A photo stays optional (sh, 2026-11-04): without one only the review goes out.
  assert.match(view.text(), /Without one, only the review is posted/);
  assert.equal(view.findByLabel("Publish")?.getAttribute("aria-disabled") === "true", false);
  assert.doesNotMatch(view.text(), /Rate all six tastes/, "tastes are optional");
});

test("publishing sends the entry with its visibility in one call, then makes it the best", async () => {
  const dish = stubPicks({ dishName: "Old laksa", venueName: "Sungei Road" });
  const draft = useReviewDraftStore.getState();
  draft.selectDish(dish.venueId, dish.id);
  draft.setRating(5);
  draft.addPhoto("file:///dish.jpg");
  const submitted: SubmitReviewInput[] = [];
  const picked: unknown[][] = [];
  stub(getHungryService().reviews, "submitReview", async (input) => {
    submitted.push(input);
    return { portfolioPostId: "new-post" };
  });
  stub(getHungryService().foodPortfolio, "setPick", async (postId, kind) => {
    picked.push([postId, kind]);
    return { kind, slot: "laksa", postId, replacedPostId: "old" };
  });
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.settle();
  const typeWords = (dish.foodTypeTag as string).toLowerCase();
  assert.match(view.text(), /Replaces Old laksa at Sungei Road, which stays in your diary/);
  await view.press(view.findByLabel(`Make this my best ${typeWords}`));
  await view.press(view.findByText("Publish"));
  await view.settle();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].dishId, dish.id);
  assert.equal(submitted[0].portfolio?.visibility, "public");
  assert.deepEqual(picked, [["new-post", "dish_type"]]);
});

test("an Only me entry is sent private and never made a best", async () => {
  const dish = stubPicks(null);
  const draft = useReviewDraftStore.getState();
  draft.selectDish(dish.venueId, dish.id);
  draft.setRating(5);
  draft.addPhoto("file:///dish.jpg");
  const submitted: SubmitReviewInput[] = [];
  let picks = 0;
  stub(getHungryService().reviews, "submitReview", async (input) => {
    submitted.push(input);
    return { portfolioPostId: "new-post" };
  });
  stub(getHungryService().foodPortfolio, "setPick", async () => {
    picks += 1;
    return { kind: "dish_type", slot: "x", postId: "new-post" };
  });
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.settle();
  const typeWords = (dish.foodTypeTag as string).toLowerCase();
  await view.press(view.findByLabel(`Make this my best ${typeWords}`));
  await view.press(view.findByLabel("Only me"));
  await view.press(view.findByText("Publish"));
  await view.settle();
  assert.equal(submitted[0].portfolio?.visibility, "private");
  assert.equal(picks, 0);
});

test("a failed review with its entry keeps the draft and says nothing was posted", async () => {
  const dish = stubPicks(null);
  const draft = useReviewDraftStore.getState();
  draft.selectDish(dish.venueId, dish.id);
  draft.setRating(5);
  draft.addPhoto("file:///dish.jpg");
  stub(getHungryService().reviews, "submitReview", async () => {
    throw Object.assign(new Error("We could not check your photo yet. Try again."), {
      code: "23514",
    });
  });
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.settle();
  await view.press(view.findByText("Publish"));
  await view.settle();
  assert.equal(
    useUIStore.getState().toast?.message,
    "We could not check your photo yet. Try again.",
  );
  assert.equal(
    useReviewDraftStore.getState().draft.photos.length,
    1,
    "the draft is kept for a retry",
  );
});

test("the Post route hands its dish and stall to the one Add a dish composer", async () => {
  const view = await renderScreen(PostComposerScreen as never, {
    name: "Post",
    params: { dishId: "dish-1", venueId: "venue-1" },
  });
  await view.settle();
  const replaced = view.navigation.calls.filter((call) => call.method === "replace").at(-1);
  assert.deepEqual(replaced?.args, [
    "ReviewStack",
    { screen: "ReviewMain", params: { dishId: "dish-1", venueId: "venue-1" } },
  ]);
});
