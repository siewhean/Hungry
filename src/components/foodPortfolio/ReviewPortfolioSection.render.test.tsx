// "Add to my Food Portfolio" in the review editor: the section on its own, then the whole editor
// publishing a review, posting the dish and pinning it at the chosen rank.
// Run with `node scripts/test-render.mjs src/components/foodPortfolio/ReviewPortfolioSection.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

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
    placeCount: 1,
    felt: {},
    onFeltChange: noop,
    onUseGuess: noop,
    rank: null,
    onRankChange: noop,
    ...overrides,
  });
}

test("off, the section is only the switch", async () => {
  const view = await render(section());
  assert.ok(view.findByText("Add to my Food Portfolio"));
  assert.equal(view.findByText("Where does it rank?"), null);
  assert.equal(view.findByText("Rate the tastes"), null);
});

test("on, it asks for a photo, the tastes and a place, and a place press reports the choice", async () => {
  const picks: unknown[] = [];
  const view = await render(
    section({
      enabled: true,
      hasPhoto: false,
      placeCount: 8,
      suggestions: { sweet: 5 },
      onRankChange: (rank) => picks.push(rank),
    }),
  );
  assert.match(view.text(), /a portfolio entry needs one/);
  assert.match(view.text(), /0 of 6 rated/);
  assert.match(view.text(), /Rate all six tastes and we will suggest a place/);
  assert.match(view.text(), /Rank as many dishes as you like/);
  assert.ok(view.findByText("Use our guess for the rest"));
  // Eight dishes' worth of places, not just a top three.
  for (let place = 1; place <= 8; place += 1) assert.ok(view.findByText(`#${place}`));
  assert.equal(view.findByText("#9"), null);
  await view.press(view.findByText("#7"));
  await view.press(view.findByText("Unranked"));
  assert.deepEqual(picks, [7, null]);
});

test("a rated dish shows the suggestion with its match, and says when it is top three", async () => {
  const all = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };
  const view = await render(
    section({ enabled: true, felt: all, suggestedRank: 2, matchPercent: 82, rank: 2 }),
  );
  assert.match(view.text(), /We suggest #2, in your top three: close to your taste \(82% match\)/);
  assert.equal(view.findByText("Use our guess for the rest"), null);
  await cleanup();
  const lower = await render(
    section({
      enabled: true,
      felt: all,
      suggestedRank: 6,
      matchPercent: 40,
      rank: 6,
      placeCount: 9,
    }),
  );
  assert.match(lower.text(), /We suggest #6: some overlap \(40% match\)/);
});

function dishWithTaste() {
  const repository = getDataRepository();
  const dish = repository
    .listBuildings()
    .flatMap((building) => repository.listVenuesByBuilding(building.id))
    .flatMap((venue) => repository.listDishesByVenue(venue.id))[0];
  return dish;
}

test("the editor holds Publish until the portfolio entry has a photo and all six tastes", async () => {
  const dish = dishWithTaste();
  const draft = useReviewDraftStore.getState();
  draft.selectDish(dish.venueId, dish.id);
  draft.setRating(4);
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  assert.equal(view.findByText("Where does it rank?"), null, "off until switched on");
  await view.press(view.findByLabel("Add to my Food Portfolio"));
  await view.settle();
  assert.match(view.text(), /Add a photo to put this dish in your portfolio/);
  useReviewDraftStore.getState().addPhoto("file:///dish.jpg");
  await view.settle();
  assert.match(view.text(), /Rate all six tastes to put this dish in your portfolio/);
  await view.press(view.findByText("Use our guess for the rest"));
  await view.settle();
  assert.doesNotMatch(view.text(), /Rate all six tastes to put this dish/);
});

test("publishing sends the review and its portfolio entry, with the picked place, in one call", async () => {
  const dish = dishWithTaste();
  const draft = useReviewDraftStore.getState();
  draft.selectDish(dish.venueId, dish.id);
  draft.setRating(5);
  draft.addPhoto("file:///dish.jpg");
  const submitted: SubmitReviewInput[] = [];
  let separateWrites = 0;
  stub(getHungryService().reviews, "submitReview", async (input) => {
    submitted.push(input);
    return { portfolioPostId: "new-post" };
  });
  stub(getHungryService().social, "postBite", async () => {
    separateWrites += 1;
    return { id: "new-post" } as never;
  });
  stub(getHungryService().foodPortfolio, "getMyRanking", async () => ["a", "b"]);
  stub(getHungryService().social, "listUserPosts", async () => []);
  stub(getHungryService().foodPortfolio, "rankPost", async () => {
    separateWrites += 1;
    return [];
  });
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.press(view.findByLabel("Add to my Food Portfolio"));
  await view.settle();
  await view.press(view.findByText("Use our guess for the rest"));
  await view.press(view.findByText("#3"));
  await view.press(view.findByText("Publish"));
  await view.settle();
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].dishId, dish.id);
  assert.equal(submitted[0].portfolio?.rank, 3);
  assert.equal(separateWrites, 0, "no second write that could fail on its own");
});

test("a failed review with its entry keeps the draft and says nothing was posted", async () => {
  const dish = dishWithTaste();
  const draft = useReviewDraftStore.getState();
  draft.selectDish(dish.venueId, dish.id);
  draft.setRating(5);
  draft.addPhoto("file:///dish.jpg");
  stub(getHungryService().reviews, "submitReview", async () => {
    throw Object.assign(new Error("We could not check your photo yet. Try again."), {
      code: "23514",
    });
  });
  stub(getHungryService().foodPortfolio, "getMyRanking", async () => []);
  stub(getHungryService().social, "listUserPosts", async () => []);
  const view = await renderScreen(ReviewScreen as never, { name: "ReviewMain" });
  await view.press(view.findByLabel("Add to my Food Portfolio"));
  await view.settle();
  await view.press(view.findByText("Use our guess for the rest"));
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
