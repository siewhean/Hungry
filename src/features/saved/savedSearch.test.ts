import assert from "node:assert/strict";
import test from "node:test";

import {
  collectSearchNameIds,
  formatSavedSearchCount,
  savedQueryWords,
  searchSaved,
} from "@/features/saved/savedSearch";
import { buildCoverPhotos, pickCoverDishIds } from "@/features/saved/savedCovers";
import type { SavedDishCard } from "@/lib/services/types";
import type { Portfolio, PortfolioItem, Review, VenueSummary } from "@/types/domain";

const dish = (id: string, name: string, venueName: string): SavedDishCard => ({
  id,
  name,
  venueName,
  buildingName: "Maxwell Food Centre",
});
const venue = (id: string, name: string, buildingName = "Tampines Hub"): VenueSummary =>
  ({ id, name, unitNumber: "#01-01", buildingName }) as VenueSummary;
const list = (id: string, name: string): Portfolio => ({ id, name }) as Portfolio;
const item = (
  portfolioId: string,
  itemType: "dish" | "stall",
  id: string,
  position = 0,
): PortfolioItem =>
  ({
    id: `${portfolioId}-${id}`,
    portfolioId,
    itemType,
    dishId: itemType === "dish" ? id : undefined,
    stallId: itemType === "stall" ? id : undefined,
    position,
  }) as PortfolioItem;
const review = (id: string, text: string, dishId?: string, venueId?: string): Review =>
  ({ id, text, dishId, venueId, rating: 4 }) as Review;

const names = new Map([
  ["dish:d-laksa", "Laksa"],
  ["dish:d-rice", "Chicken Rice"],
  ["stall:s-nam", "Nam Sing"],
]);
const getName = (type: "dish" | "stall", id: string) => names.get(`${type}:${id}`);

const base = {
  dishes: [dish("d-laksa", "Laksa", "Nam Sing"), dish("d-rice", "Chicken Rice", "Tian Tian")],
  stalls: [venue("s-nam", "Nam Sing"), venue("s-tian", "Tian Tian", "Maxwell")],
  lists: [list("l-date", "Date night"), list("l-supper", "Supper spots")],
  itemsByList: {
    "l-date": [item("l-date", "dish", "d-laksa")],
    "l-supper": [item("l-supper", "stall", "s-nam")],
  },
  reviews: [
    review("r1", "Rich broth, worth the queue", "d-laksa", "s-nam"),
    review("r2", "Dry chicken", "d-rice"),
  ],
  getName,
};

test("an empty query matches nothing", () => {
  const results = searchSaved({ ...base, query: "   " });
  assert.equal(results.total, 0);
  assert.deepEqual(savedQueryWords("  Laksa  nam "), ["laksa", "nam"]);
});

test("one query is grouped into dishes, stalls, lists and reviews", () => {
  const results = searchSaved({ ...base, query: "laksa" });
  assert.deepEqual(
    results.dishes.map((d) => d.id),
    ["d-laksa"],
  );
  assert.equal(results.stalls.length, 0);
  // The Date night list holds Laksa; the review names Laksa as its dish.
  assert.deepEqual(
    results.lists.map((match) => [match.portfolio.id, match.matchedItems]),
    [["l-date", ["Laksa"]]],
  );
  assert.deepEqual(
    results.reviews.map((match) => match.review.id),
    ["r1"],
  );
  assert.equal(results.total, 3);
});

test("a stall name finds the stall, the list that holds it and the dishes there", () => {
  const results = searchSaved({ ...base, query: "nam sing" });
  assert.deepEqual(
    results.dishes.map((d) => d.id),
    ["d-laksa"],
  );
  assert.deepEqual(
    results.stalls.map((v) => v.id),
    ["s-nam"],
  );
  assert.deepEqual(
    results.lists.map((match) => match.portfolio.id),
    ["l-supper"],
  );
});

test("a list name matches by itself, without naming its items", () => {
  const results = searchSaved({ ...base, query: "date" });
  assert.deepEqual(
    results.lists.map((match) => [match.portfolio.id, match.matchedItems, match.itemCount]),
    [["l-date", [], 1]],
  );
});

test("review text matches, and every word must be found", () => {
  assert.equal(searchSaved({ ...base, query: "broth queue" }).reviews.length, 1);
  assert.equal(searchSaved({ ...base, query: "broth pizza" }).reviews.length, 0);
});

test("items with no name yet are left out of list matching, not matched blindly", () => {
  const results = searchSaved({ ...base, getName: () => undefined, query: "laksa" });
  assert.equal(results.lists.length, 0);
  assert.equal(results.reviews.length, 0);
  assert.equal(results.dishes.length, 1);
});

test("collectSearchNameIds gathers every id for one detail read, once", () => {
  const ids = collectSearchNameIds({
    lists: base.lists,
    itemsByList: base.itemsByList,
    reviews: base.reviews,
  });
  assert.deepEqual(ids, { dishIds: ["d-laksa", "d-rice"], stallIds: ["s-nam"] });
});

test("formatSavedSearchCount", () => {
  assert.equal(formatSavedSearchCount(0), "No results");
  assert.equal(formatSavedSearchCount(1), "1 result");
  assert.equal(formatSavedSearchCount(4), "4 results");
});

test("list covers: first four dishes per list, one id set for one read", () => {
  const itemsByList = {
    a: ["d1", "d2", "d3", "d4", "d5"].map((id, index) => item("a", "dish", id, index)),
    b: [item("b", "stall", "s1"), item("b", "dish", "d2")],
  };
  const { perList, dishIds } = pickCoverDishIds(["a", "b", "c"], itemsByList);
  assert.deepEqual(perList.get("a"), ["d1", "d2", "d3", "d4"]);
  assert.deepEqual(perList.get("b"), ["d2"]);
  assert.deepEqual(perList.get("c"), []);
  assert.deepEqual(dishIds, ["d1", "d2", "d3", "d4"]);
  const covers = buildCoverPhotos(
    perList,
    new Map([
      ["d1", "u1"],
      ["d3", "u3"],
      ["d2", "u2"],
    ]),
  );
  assert.deepEqual(covers.get("a"), ["u1", "u2", "u3"]);
  assert.deepEqual(covers.get("b"), ["u2"]);
});
