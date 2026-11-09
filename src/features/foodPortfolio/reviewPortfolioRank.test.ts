// Review-to-portfolio: the score, the suggested rank, the pin placement and the publish step.

import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { NEUTRAL_TASTE_VECTOR } from "@/constants/taste";
import {
  addReviewToPortfolio,
  hasRatedAllTastes,
  portfolioScore,
  postPortfolioScore,
  reviewPalateMatch,
  suggestRankedPlace,
  isTopThreePlace,
  loadRankedScores,
} from "@/features/foodPortfolio/reviewPortfolioRank";
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

const ALL_TASTES = { sweet: 5, spicy: 5, sour: 5, salty: 5, rich: 5, aromatic: 5 };

test("all six tastes must be answered", () => {
  assert.equal(hasRatedAllTastes(ALL_TASTES), true);
  assert.equal(hasRatedAllTastes({ sweet: 5, spicy: 0 }), false);
  assert.equal(hasRatedAllTastes({ ...ALL_TASTES, sour: undefined }), false);
});

test("a dish tasted the way the diner likes it matches higher than one that is not", () => {
  const spicyFan = { ...NEUTRAL_TASTE_VECTOR, spicy: 9 };
  const mild = { ...NEUTRAL_TASTE_VECTOR, spicy: 1 };
  const closeMatch = reviewPalateMatch(mild, { spicy: 10 }, spicyFan);
  const farMatch = reviewPalateMatch(mild, { spicy: 0 }, spicyFan);
  assert.ok(closeMatch > farMatch);
});

test("the score is 60% stars and 40% palate match", () => {
  assert.equal(portfolioScore(5, 100), 100);
  assert.equal(portfolioScore(0, 0), 0);
  assert.equal(portfolioScore(5, 0), 60);
  assert.equal(portfolioScore(0, 100), 40);
  assert.equal(portfolioScore(9, 100), 100);
});

test("a saved post scores from its own stars and taste stamp", () => {
  const score = postPortfolioScore(
    { rating: 4, tasteStamp: NEUTRAL_TASTE_VECTOR },
    NEUTRAL_TASTE_VECTOR,
  );
  assert.equal(score, portfolioScore(4, 100));
});

test("the suggested place sits above the first lower-scoring dish, or last, with no cap", () => {
  assert.equal(suggestRankedPlace(80, []), 1);
  assert.equal(suggestRankedPlace(90, [80, 70]), 1);
  assert.equal(suggestRankedPlace(75, [80, 70]), 2);
  assert.equal(suggestRankedPlace(60, [80, 70]), 3);
  assert.equal(suggestRankedPlace(80, [80, 70, 60]), 2);
  assert.equal(suggestRankedPlace(50, [80, 70, 60, 55, 52]), 6);
  assert.equal(suggestRankedPlace(58, [80, 70, 60, 55, 52]), 4);
});

test("a dish we could not score is stepped over, never chosen as the boundary", () => {
  assert.equal(suggestRankedPlace(75, [null, 80, null, 70]), 4);
  assert.equal(suggestRankedPlace(50, [null, null]), 3);
});

test("only places 1 to 3 count as top three", () => {
  assert.equal(isTopThreePlace(1), true);
  assert.equal(isTopThreePlace(3), true);
  assert.equal(isTopThreePlace(4), false);
  assert.equal(isTopThreePlace(null), false);
});

test("the ranked scores follow the ranking order and are null for a post we did not load", async () => {
  const post = (id: string, rating: number) => ({ id, rating, tasteStamp: NEUTRAL_TASTE_VECTOR });
  stub(getHungryService().foodPortfolio, "getMyRanking", async () => ["a", "gone", "b"]);
  stub(
    getHungryService().social,
    "listUserPosts",
    async () => [post("b", 2), post("a", 5)] as never,
  );
  const scores = await loadRankedScores("u1", NEUTRAL_TASTE_VECTOR);
  assert.deepEqual(scores, [portfolioScore(5, 100), null, portfolioScore(2, 100)]);

  stub(getHungryService().foodPortfolio, "getMyRanking", async () => {
    throw new Error("offline");
  });
  assert.deepEqual(await loadRankedScores("u1", NEUTRAL_TASTE_VECTOR), []);
});

const input = {
  dishId: "d1",
  venueId: "v1",
  photoUrl: "file:///p.jpg",
  caption: "Good",
  tags: [],
  rating: 4,
  tasteStamp: NEUTRAL_TASTE_VECTOR,
  clientPostId: "post-1",
  author: { id: "u1", displayName: "Sh" },
};

test("publishing posts the dish and ranks it at the chosen place, however far down", async () => {
  const posted: unknown[] = [];
  const ranked: [string, number][] = [];
  stub(getHungryService().social, "postBite", async (draft) => {
    posted.push(draft);
    return { id: "new-post" } as never;
  });
  stub(getHungryService().foodPortfolio, "rankPost", async (id, position) => {
    ranked.push([id, position]);
    return [id];
  });
  const result = await addReviewToPortfolio({ ...input, rank: 12 });
  assert.deepEqual(result, { postId: "new-post", ranked: true });
  assert.deepEqual(ranked, [["new-post", 12]]);
  assert.equal((posted[0] as { clientPostId: string }).clientPostId, "post-1");
});

test("no place posts without ranking", async () => {
  let rankCalls = 0;
  stub(getHungryService().social, "postBite", async () => ({ id: "new-post" }) as never);
  stub(getHungryService().foodPortfolio, "rankPost", async () => {
    rankCalls += 1;
    return [];
  });
  assert.deepEqual(await addReviewToPortfolio({ ...input, rank: null }), {
    postId: "new-post",
    ranked: false,
  });
  assert.equal(rankCalls, 0);
});

test("a failed rank keeps the post and reports not ranked; a failed post throws", async () => {
  stub(getHungryService().social, "postBite", async () => ({ id: "new-post" }) as never);
  stub(getHungryService().foodPortfolio, "rankPost", async () => {
    throw new Error("refused");
  });
  assert.deepEqual(await addReviewToPortfolio({ ...input, rank: 2 }), {
    postId: "new-post",
    ranked: false,
  });

  stub(getHungryService().social, "postBite", async () => {
    throw new Error("offline");
  });
  await assert.rejects(addReviewToPortfolio({ ...input, rank: 2 }), /offline/);
});
