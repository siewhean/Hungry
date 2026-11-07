// The Food Portfolio loaders (foodPortfolioLoaders) behind the useFoodPortfolio hook: each read fails on its own, is reported,
// and returns a value the screen can show.

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import {
  FOOD_PORTFOLIO_PAGE_SIZE,
  loadPortfolioPostsPage,
  loadPortfolioStalls,
  loadPortfolioTopPosts,
  savePortfolioPins,
} from "@/features/foodPortfolio/foodPortfolioLoaders";
import { getHungryService } from "@/lib/services/serviceProvider";

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

test("a posts page asks for one page at the offset and is null when the read fails", async () => {
  const pages: unknown[] = [];
  stub(getHungryService().social, "listUserPosts", async (_userId, page) => {
    pages.push(page);
    return [];
  });
  assert.deepEqual(await loadPortfolioPostsPage("user-1", 60), []);
  assert.deepEqual(pages, [{ limit: FOOD_PORTFOLIO_PAGE_SIZE, offset: 60 }]);

  stub(getHungryService().social, "listUserPosts", async () => {
    throw new Error("offline");
  });
  assert.equal(await loadPortfolioPostsPage("user-1", 0), null);
});

test("a failed top three is empty, a failed stalls read is null, a refused pin save is null", async () => {
  const portfolio = getHungryService().foodPortfolio;
  stub(portfolio, "getTopPosts", async () => {
    throw new Error("rate limited");
  });
  stub(portfolio, "listStalls", async () => {
    throw new Error("rate limited");
  });
  stub(portfolio, "setPinnedPosts", async () => {
    throw new Error("Pin up to three dishes.");
  });
  assert.deepEqual(await loadPortfolioTopPosts("user-1"), { posts: [], pinnedPostIds: [] });
  assert.equal(await loadPortfolioStalls("user-1"), null);
  assert.equal(await savePortfolioPins(["a"]), null);
});

test("pins are capped at three before they reach the server", async () => {
  const sent: string[][] = [];
  stub(getHungryService().foodPortfolio, "setPinnedPosts", async (ids: string[]) => {
    sent.push(ids);
    return ids;
  });
  assert.deepEqual(await savePortfolioPins(["a", "b", "c", "d"]), ["a", "b", "c"]);
  assert.deepEqual(sent, [["a", "b", "c"]]);
});

test("the loaders pass mock data through untouched", async () => {
  const top = await loadPortfolioTopPosts("user-sarah");
  assert.ok(top.posts.every((post) => post.authorId === "user-sarah"));
  const stalls = await loadPortfolioStalls("user-sarah");
  assert.ok(Array.isArray(stalls) && stalls.length > 0);
});
