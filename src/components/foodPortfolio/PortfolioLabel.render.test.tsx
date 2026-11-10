// The Food Portfolio label on reviews: "Emma's best laksa" or "#2 in Emma's Food Portfolio" on a dish
// review card and on the review page, read in one batched call. The server labels only a dish that is
// its author's best of that dish type or in their top three, in a portfolio of five or more public
// dishes (supabase/smoke/portfolio_picks.sql); the screen shows exactly what it returns.
// Run with `node scripts/test-render.mjs src/components/foodPortfolio/PortfolioLabel.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { ReviewDetailScreen } from "@/app/screens/review/ReviewDetailScreen";
import { DishReviewCard } from "@/components/dish/DishReviewCard";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { portfolioLabelText } from "@/features/foodPortfolio/useReviewPortfolioLabels";
import type { ReviewPortfolioLabel } from "@/lib/services/types";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Review } from "@/types/domain";
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
  while (restores.length) restores.pop()!();
});

const review = {
  id: "11111111-1111-4111-8111-111111111111",
  authorId: "user-emma",
  authorName: "Emma",
  rating: 4,
  createdAt: new Date().toISOString(),
  text: "Silky noodles and a deep broth.",
  tags: [],
  wouldRecommend: true,
  photos: [],
} as unknown as Review;

const card = (portfolioLabel?: ReviewPortfolioLabel | null) =>
  createElement(DishReviewCard, {
    review,
    dishName: "Katong Laksa",
    isOwn: false,
    returnRoute: { name: "DishDetail", params: {} } as never,
    onOpenAuthor: () => undefined,
    onUpdated: () => undefined,
    onDeleted: () => undefined,
    onRemoved: () => undefined,
    portfolioLabel,
  });

test("the label names the dish type, the place and the author", () => {
  assert.equal(portfolioLabelText({ foodType: "Laksa" }, "Emma"), "Emma's best laksa");
  assert.equal(portfolioLabelText({ overallPlace: 2 }, "Emma"), "#2 in Emma's Food Portfolio");
  assert.equal(
    portfolioLabelText({ foodType: "Chicken Rice", overallPlace: 1 }, "Emma"),
    "Emma's best chicken rice, #1 overall",
  );
  assert.equal(portfolioLabelText({ overallPlace: 1 }, "  "), "#1 in their Food Portfolio");
  assert.equal(portfolioLabelText({ foodType: "Laksa" }, ""), "Their best laksa");
  assert.equal(portfolioLabelText({}, "Emma"), null);
});

test("a dish review card shows its portfolio label, and nothing without one", async () => {
  const best = await render(card({ reviewId: review.id, foodType: "Laksa", dishCount: 6 }));
  assert.ok(best.findByText("Emma's best laksa"));
  await cleanup();
  const ranked = await render(card({ reviewId: review.id, overallPlace: 2, dishCount: 6 }));
  assert.ok(ranked.findByText("#2 in Emma's Food Portfolio"));
  await cleanup();
  const plain = await render(card(null));
  assert.doesNotMatch(plain.text(), /Food Portfolio/);
});

function reviewEntry() {
  return {
    review,
    dishId: "dish-laksa",
    dishName: "Katong Laksa",
    venueId: "venue-1",
    venueName: "Laksa Stall",
  };
}

test("the review page asks once for its review and shows the place it gets back", async () => {
  const asked: string[][] = [];
  stub(getHungryService().reviews, "getReviewById", async () => reviewEntry() as never);
  stub(getHungryService().foodPortfolio, "getReviewPortfolioLabels", async (ids) => {
    asked.push(ids);
    return [{ reviewId: review.id, foodType: "Laksa", overallPlace: 3, dishCount: 7 }];
  });
  const view = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: review.id },
  });
  await view.settle();
  assert.ok(view.findByText("Emma's best laksa, #3 overall"));
  assert.deepEqual(asked, [[review.id]]);
});

test("the review page shows no label when the server returns none, or the portfolio is off", async () => {
  stub(getHungryService().reviews, "getReviewById", async () => reviewEntry() as never);
  let calls = 0;
  stub(getHungryService().foodPortfolio, "getReviewPortfolioLabels", async () => {
    calls += 1;
    return [];
  });
  const none = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: review.id },
  });
  await none.settle();
  assert.doesNotMatch(none.text(), /Food Portfolio|best laksa/);
  assert.equal(calls, 1);
  await cleanup();

  flags.foodPortfolioEnabled = false;
  const off = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: review.id },
  });
  await off.settle();
  assert.equal(calls, 1, "no read while the portfolio is off");
});
