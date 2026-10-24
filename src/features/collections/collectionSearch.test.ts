import assert from "node:assert/strict";
import test from "node:test";

import type { PortfolioItemDetailRow } from "@/lib/services/types";
import type { BuildingSummary, Portfolio, PortfolioItem } from "@/types/domain";
import {
  WANT_TO_TRY_COLLECTION_ID,
  buildCollectionFoods,
  buildingAreaName,
  collectCollectionItemIds,
  indexItemDetails,
  searchCollectionFoods,
} from "./collectionSearch";

const building = (id: string, name: string, planningArea: string) =>
  ({
    id,
    name,
    planningArea,
    coordinate: { latitude: 1.35, longitude: 103.94 },
  }) as BuildingSummary;

// Server detail rows (get_item_details): d1-d3 are dishes, s1 a stall. None needs the local cache.
const rows: PortfolioItemDetailRow[] = [
  { dishId: "d1", name: "Laksa", stallName: "Laksa Stall" },
  { dishId: "d2", name: "Chicken Rice", stallName: "Tian Tian" },
  { dishId: "d3", name: "Satay", stallName: "Satay Stall" },
  { stallId: "s1", name: "Ah Seng Durian", stallName: "Ah Seng Durian" },
];
const details = indexItemDetails(rows);
const places = new Map([
  [
    "d1",
    {
      placeName: "Tampines Round Market",
      areaName: buildingAreaName(building("b1", "Tampines Round Market", "Tampines")),
      description: "Spicy coconut noodles",
    },
  ],
  ["d3", { placeName: "Tampines Round Market", areaName: "Tampines" }],
  ["d2", { placeName: "Maxwell Food Centre", areaName: "Outram" }],
]);
const portfolio = { id: "p1", name: "Date night" } as Portfolio;
const items = {
  p1: [
    { id: "i1", portfolioId: "p1", itemType: "dish", dishId: "d2", publicNotes: "Silky chicken" },
    { id: "i2", portfolioId: "p1", itemType: "dish", dishId: "missing" },
    { id: "i3", portfolioId: "p1", itemType: "stall", stallId: "s1", publicNotes: "Mao shan wang" },
  ] as PortfolioItem[],
};

const foods = buildCollectionFoods({
  savedDishIds: ["d1", "d3"],
  portfolios: [portfolio],
  itemsByPortfolio: items,
  getDetail: (type, id) => details.get(`${type}:${id}`),
  getPlace: (id) => places.get(id),
});

test("collects Want to try first, then each list, with stalls, skipping items with no detail", () => {
  assert.deepEqual(
    foods.map((food) => [food.collectionId, food.itemType, food.dishName]),
    [
      [WANT_TO_TRY_COLLECTION_ID, "dish", "Laksa"],
      [WANT_TO_TRY_COLLECTION_ID, "dish", "Satay"],
      ["p1", "dish", "Chicken Rice"],
      ["p1", "stall", "Ah Seng Durian"],
    ],
  );
  assert.equal(foods[2]?.caption, "Silky chicken");
  assert.equal(foods[0]?.caption, "Spicy coconut noodles");
  assert.equal(foods[0]?.areaName, "Tampines");
  assert.equal(foods[3]?.stallId, "s1");
  assert.equal(foods[3]?.dishId, undefined);
});

test("names come from detail rows, so a dish outside the local cache is still found", () => {
  const onlyServer = buildCollectionFoods({
    savedDishIds: ["d2"],
    portfolios: [],
    itemsByPortfolio: {},
    getDetail: (type, id) => details.get(`${type}:${id}`),
  });
  assert.deepEqual(
    searchCollectionFoods(onlyServer, "tian").map((food) => food.dishName),
    ["Chicken Rice"],
  );
});

test("collectCollectionItemIds gathers every dish and stall once for one detail read", () => {
  assert.deepEqual(
    collectCollectionItemIds({
      savedDishIds: ["d2", "d1"],
      portfolios: [portfolio],
      itemsByPortfolio: items,
    }),
    { dishIds: ["d1", "d2", "missing"], stallIds: ["s1"] },
  );
});

test("searches by food name, caption, stall, place and area", () => {
  const names = (query: string) => searchCollectionFoods(foods, query).map((food) => food.dishName);
  assert.deepEqual(names(""), ["Laksa", "Satay", "Chicken Rice", "Ah Seng Durian"]);
  assert.deepEqual(names("laksa"), ["Laksa"]);
  assert.deepEqual(names("silky"), ["Chicken Rice"]);
  assert.deepEqual(names("coconut"), ["Laksa"]);
  assert.deepEqual(names("maxwell"), ["Chicken Rice"]);
  assert.deepEqual(names("tampines"), ["Laksa", "Satay"]);
  assert.deepEqual(names("satay tampines"), ["Satay"]);
  assert.deepEqual(names("durian"), ["Ah Seng Durian"]);
  assert.deepEqual(names("pizza"), []);
});

test("edge rows: no-id details are skipped, private notes are captions, a list without items is empty", () => {
  const index = indexItemDetails([
    { name: "No id" } as PortfolioItemDetailRow,
    { stallId: "s2", name: "Kopi" },
    { dishId: "d9", name: "Mee Pok", imageUrl: "" },
  ]);
  assert.deepEqual([...index.keys()], ["stall:s2", "dish:d9"]);

  const lists = [
    { id: "p1", name: "Breakfast" },
    { id: "p2", name: "Not loaded" },
  ] as Portfolio[];
  const itemsByPortfolio = {
    p1: [
      {
        id: "i1",
        portfolioId: "p1",
        itemType: "dish",
        dishId: "d9",
        privateNotes: "  Dry, extra chilli ",
      },
      { id: "i2", portfolioId: "p1", itemType: "stall", stallId: "s2" },
      { id: "i3", portfolioId: "p1", itemType: "stall" },
    ] as PortfolioItem[],
  };
  const built = buildCollectionFoods({
    savedDishIds: [],
    portfolios: lists,
    itemsByPortfolio,
    getDetail: (type, id) => index.get(`${type}:${id}`),
  });
  assert.deepEqual(
    built.map((food) => [food.key, food.venueName, food.caption, food.imageUrl]),
    [
      ["p1:dish:d9", "Mee Pok", "Dry, extra chilli", undefined],
      ["p1:stall:s2", "Kopi", undefined, undefined],
    ],
  );
  assert.deepEqual(
    collectCollectionItemIds({ savedDishIds: ["d1"], portfolios: lists, itemsByPortfolio }),
    { dishIds: ["d1", "d9"], stallIds: ["s2"] },
  );
  assert.equal(buildingAreaName(undefined), undefined);
  assert.equal(
    typeof buildingAreaName({
      coordinate: { latitude: 1.35, longitude: 103.94 },
    } as BuildingSummary),
    "string",
  );
  assert.equal(searchCollectionFoods(built, "   ").length, 2, "a blank query lists everything");
});
