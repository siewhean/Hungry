// The words and photo choices behind the Food Portfolio and Rank share cards.

import assert from "node:assert/strict";
import test from "node:test";

import {
  FOOD_PORTFOLIO_CARD_SIZE,
  foodPortfolioCardHeight,
  foodPortfolioShareMessage,
  portfolioCardPhotos,
  portfolioCardStatLine,
  rankCardModel,
} from "@/features/foodPortfolio/shareCards";
import type { LeaderboardSummary } from "@/lib/services/types";

const SUMMARY: LeaderboardSummary = {
  totalPoints: 85,
  weekPoints: 23,
  activeWeekRank: 4,
  activeAllRank: 12,
  trendingRank: null,
  creditedPostsToday: 2,
  dailyCap: 6,
};

test("the card is a 9:16 Story picture", () => {
  assert.deepEqual(FOOD_PORTFOLIO_CARD_SIZE, { width: 1080, height: 1920 });
  assert.equal(foodPortfolioCardHeight(360), 640);
});

test("photos: top three first, then newest, each once, at most nine, blanks skipped", () => {
  const top = [{ photoUrl: "b" }, { photoUrl: "a" }];
  const posts = ["a", "b", "", "c", "d", "e", "f", "g", "h", "i", "j"].map((photoUrl) => ({
    photoUrl,
  }));
  assert.deepEqual(portfolioCardPhotos(top, posts), ["b", "a", "c", "d", "e", "f", "g", "h", "i"]);
  assert.deepEqual(portfolioCardPhotos([], [{ photoUrl: "  " }]), []);
});

test("stat line counts dishes and stalls, and leaves stalls out while unknown", () => {
  assert.equal(portfolioCardStatLine(12, 5), "12 dishes · 5 stalls");
  assert.equal(portfolioCardStatLine(1, 1), "1 dish · 1 stall");
  assert.equal(portfolioCardStatLine(3, null), "3 dishes");
});

test("rank card: this week's Most active rank, else all time, else nothing", () => {
  assert.deepEqual(rankCardModel(SUMMARY), {
    rank: 4,
    period: "week",
    headline: "#4",
    periodLabel: "this week",
    detail: "Most active · 23 pts",
  });
  assert.deepEqual(
    rankCardModel({ ...SUMMARY, activeWeekRank: null })?.detail,
    "Most active · 85 pts",
  );
  assert.equal(rankCardModel({ ...SUMMARY, activeWeekRank: null })?.periodLabel, "all time");
  assert.equal(rankCardModel({ ...SUMMARY, activeWeekRank: 0, activeAllRank: null }), null);
  assert.equal(rankCardModel(null), null);
});

test("the link fallback says what is being shared", () => {
  assert.equal(
    foodPortfolioShareMessage("portfolio", "Mei", null),
    "Mei's Food Portfolio on Hungry:",
  );
  assert.equal(
    foodPortfolioShareMessage("rank", "Mei", rankCardModel(SUMMARY)),
    "I'm #4 on the Hungry leaderboard this week. Mei on Hungry:",
  );
});
