// The Food Portfolio loaders (foodPortfolioLoaders) behind the useFoodPortfolio hook: each read fails on its own, is reported,
// and returns a value the screen can show.

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  FOOD_PORTFOLIO_DIARY_PAGE_SIZE,
  loadPortfolioDiaryPage,
  loadPortfolioPicks,
  loadPortfolioStalls,
  mergeDiaryEntries,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import { getHungryService } from "@/lib/services/serviceProvider";
import type { Bite, PortfolioDiaryEntry } from "@/lib/services/types";

const restores: (() => void)[] = [];
function stub<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  restores.push(() => {
    target[key] = original;
  });
}

afterEach(() => {
  while (restores.length) restores.pop()!();
});

function entry(id: string, createdAt = "2026-11-06T10:00:00Z"): PortfolioDiaryEntry {
  return { post: { id, createdAt } as Bite, visibility: "public", pickKinds: [] };
}

test("a diary page asks for one page after the last entry shown and is null when the read fails", async () => {
  const pages: unknown[] = [];
  stub(getHungryService().foodPortfolio, "getDiary", async (_userId, page) => {
    pages.push(page);
    return [];
  });
  assert.deepEqual(await loadPortfolioDiaryPage("user-1"), []);
  assert.deepEqual(await loadPortfolioDiaryPage("user-1", entry("p9", "2026-11-01T08:00:00Z")), []);
  assert.deepEqual(pages, [
    { limit: FOOD_PORTFOLIO_DIARY_PAGE_SIZE, before: undefined },
    {
      limit: FOOD_PORTFOLIO_DIARY_PAGE_SIZE,
      before: { publishedAt: "2026-11-01T08:00:00Z", id: "p9" },
    },
  ]);

  stub(getHungryService().foodPortfolio, "getDiary", async () => {
    throw new Error("offline");
  });
  assert.equal(await loadPortfolioDiaryPage("user-1"), null);
});

test("failed picks are empty and a failed stalls read is null", async () => {
  const portfolio = getHungryService().foodPortfolio;
  stub(portfolio, "getPicks", async () => {
    throw new Error("rate limited");
  });
  stub(portfolio, "listStalls", async () => {
    throw new Error("rate limited");
  });
  assert.deepEqual(await loadPortfolioPicks("user-1"), { topThree: [], bests: [] });
  assert.equal(await loadPortfolioStalls("user-1"), null);
});

test("merging diary pages keeps the order and drops repeats", () => {
  const merged = mergeDiaryEntries([entry("a"), entry("b")], [entry("b"), entry("c")]);
  assert.deepEqual(
    merged.map((item) => item.post.id),
    ["a", "b", "c"],
  );
});

test("the loaders pass mock data through untouched", async () => {
  const diary = await loadPortfolioDiaryPage("user-sarah");
  assert.ok(diary && diary.every((item) => item.post.authorId === "user-sarah"));
  const stalls = await loadPortfolioStalls("user-sarah");
  assert.ok(Array.isArray(stalls) && stalls.length > 0);
});
