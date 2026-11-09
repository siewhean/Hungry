// The Food Portfolio rank label on reviews: "#2 in Emma's Food Portfolio" on a dish review card and
// on the review page, read in one batched call. The server shows a rank only for a top-three dish
// in a portfolio of five or more dishes (supabase/smoke/portfolio_ranking.sql); the screen shows
// exactly what it returns.
// Run with `node scripts/test-render.mjs src/components/foodPortfolio/PortfolioRankLabel.render.test.tsx`.

import assert from "node:assert/strict";
import { createElement } from "react";
import test, { afterEach, beforeEach } from "node:test";

import { ReviewDetailScreen } from "@/app/screens/review/ReviewDetailScreen";
import { DishReviewCard } from "@/components/dish/DishReviewCard";
import { FEATURE_FLAGS } from "@/constants/featureFlags";
import { portfolioRankLabel } from "@/features/foodPortfolio/useReviewPortfolioRanks";
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

const card = (portfolioRank?: number | null) =>
  createElement(DishReviewCard, {
    review,
    dishName: "Katong Laksa",
    isOwn: false,
    returnRoute: { name: "DishDetail", params: {} } as never,
    onOpenAuthor: () => undefined,
    onUpdated: () => undefined,
    onDeleted: () => undefined,
    onRemoved: () => undefined,
    portfolioRank,
  });

test("the label names the place and the author", () => {
  assert.equal(portfolioRankLabel(2, "Emma"), "#2 in Emma's Food Portfolio");
  assert.equal(portfolioRankLabel(1, "  "), "#1 in their Food Portfolio");
});

test("a dish review card shows its portfolio place, and nothing without one", async () => {
  const ranked = await render(card(2));
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
  stub(getHungryService().foodPortfolio, "getReviewPortfolioRanks", async (ids) => {
    asked.push(ids);
    return [{ reviewId: review.id, rank: 3, dishCount: 7 }];
  });
  const view = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: review.id },
  });
  await view.settle();
  assert.ok(view.findByText("#3 in Emma's Food Portfolio"));
  assert.deepEqual(asked, [[review.id]]);
});

test("the review page shows no label when the server returns none, or the portfolio is off", async () => {
  stub(getHungryService().reviews, "getReviewById", async () => reviewEntry() as never);
  let calls = 0;
  stub(getHungryService().foodPortfolio, "getReviewPortfolioRanks", async () => {
    calls += 1;
    return [];
  });
  const none = await renderScreen(ReviewDetailScreen as never, {
    name: "ReviewDetail",
    params: { reviewId: review.id },
  });
  await none.settle();
  assert.doesNotMatch(none.text(), /Food Portfolio/);
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
