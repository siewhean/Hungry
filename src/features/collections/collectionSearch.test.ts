import assert from "node:assert/strict";
import test from "node:test";

import type { BuildingSummary, DishDetail, Portfolio, PortfolioItem } from "@/types/domain";
import {
  WANT_TO_TRY_COLLECTION_ID,
  buildCollectionFoods,
  searchCollectionFoods,
} from "./collectionSearch";

const dish = (id: string, name: string, buildingId: string, description?: string) =>
  ({ id, name, buildingId, venueName: `${name} Stall`, imageUrl: "", description }) as DishDetail;
const building = (id: string, name: string, planningArea: string) =>
  ({
    id,
    name,
    planningArea,
    coordinate: { latitude: 1.35, longitude: 103.94 },
  }) as BuildingSummary;

const dishes = new Map([
  ["d1", dish("d1", "Laksa", "b1", "Spicy coconut noodles")],
  ["d2", dish("d2", "Chicken Rice", "b2")],
  ["d3", dish("d3", "Satay", "b1")],
]);
const buildings = new Map([
  ["b1", building("b1", "Tampines Round Market", "Tampines")],
  ["b2", building("b2", "Maxwell Food Centre", "Outram")],
]);
const portfolio = { id: "p1", name: "Date night" } as Portfolio;
const items = {
  p1: [
    { id: "i1", portfolioId: "p1", dishId: "d2", publicNotes: "Silky chicken" },
    { id: "i2", portfolioId: "p1", dishId: "missing" },
  ] as PortfolioItem[],
};

const foods = buildCollectionFoods({
  savedDishIds: ["d1", "d3"],
  portfolios: [portfolio],
  itemsByPortfolio: items,
  getDish: (id) => dishes.get(id),
  getBuilding: (id) => buildings.get(id),
});

test("collects Want to try first, then each list, skipping dishes not loaded", () => {
  assert.deepEqual(
    foods.map((food) => [food.collectionId, food.dishName]),
    [
      [WANT_TO_TRY_COLLECTION_ID, "Laksa"],
      [WANT_TO_TRY_COLLECTION_ID, "Satay"],
      ["p1", "Chicken Rice"],
    ],
  );
  assert.equal(foods[2]?.caption, "Silky chicken");
  assert.equal(foods[0]?.caption, "Spicy coconut noodles");
  assert.equal(foods[0]?.areaName, "Tampines");
});

test("searches by food name, caption, place and area", () => {
  const names = (query: string) => searchCollectionFoods(foods, query).map((food) => food.dishName);
  assert.deepEqual(names(""), ["Laksa", "Satay", "Chicken Rice"]);
  assert.deepEqual(names("laksa"), ["Laksa"]);
  assert.deepEqual(names("silky"), ["Chicken Rice"]);
  assert.deepEqual(names("coconut"), ["Laksa"]);
  assert.deepEqual(names("maxwell"), ["Chicken Rice"]);
  assert.deepEqual(names("tampines"), ["Laksa", "Satay"]);
  assert.deepEqual(names("satay tampines"), ["Satay"]);
  assert.deepEqual(names("pizza"), []);
});
