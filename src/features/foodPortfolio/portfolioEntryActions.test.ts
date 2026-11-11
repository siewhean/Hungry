// The owner's sheet on one Food Portfolio diary entry (portfolioEntryActions): which choices it offers,
// that a pick names the dish it replaces, and how the diary updates after a change.

import assert from "node:assert/strict";
import test from "node:test";

import {
  applyEntryChange,
  entryActionSheet,
  entryName,
  replacedBest,
  topThreePlaceOptions,
} from "@/features/foodPortfolio/portfolioEntryActions";
import type { Bite, PortfolioDiaryEntry, PortfolioPicks } from "@/lib/services/types";

const post = (id: string, dishName = `Dish ${id}`, venueName = "Hill Street") =>
  ({ id, dishName, venueName }) as Bite;
const entry = (id: string, overrides: Partial<PortfolioDiaryEntry> = {}): PortfolioDiaryEntry => ({
  post: post(id),
  visibility: "public",
  dishFoodType: "Chicken Rice",
  pickKinds: [],
  ...overrides,
});
const picks: PortfolioPicks = {
  topThree: [{ place: 1, post: post("a") }],
  bests: [{ foodType: "Chicken Rice", post: post("a") }],
};

test("an entry's name is its dish at its stall", () => {
  assert.equal(entryName(post("x", "Laksa", "Sungei Road")), "Laksa at Sungei Road");
  assert.equal(entryName(post("x", "", "")), "A dish");
});

test("a new best names the best it replaces; the best itself replaces nothing", () => {
  assert.equal(replacedBest(entry("b"), picks)?.id, "a");
  assert.equal(replacedBest(entry("a"), picks), undefined);
  assert.equal(replacedBest(entry("b", { dishFoodType: undefined }), picks), undefined);
  assert.deepEqual(entryActionSheet(entry("b"), picks), {
    title: "Dish b at Hill Street",
    message: "It replaces Dish a at Hill Street, which stays in your diary.",
    options: [
      { id: "best", label: "Make this my best chicken rice" },
      { id: "top_three", label: "Put in my top three" },
      { id: "private", label: "Make it Only me" },
    ],
  });
});

test("an entry with no dish type cannot be a best; an Only me entry can only go public", () => {
  const untyped = entryActionSheet(entry("c", { dishFoodType: undefined }), picks);
  assert.deepEqual(
    untyped.options.map((option) => option.id),
    ["top_three", "private"],
  );
  const onlyMe = entryActionSheet(entry("c", { visibility: "private" }), picks);
  assert.deepEqual(
    onlyMe.options.map((option) => option.id),
    ["public"],
  );
});

test("the top three places name what they replace and where the entry is now", () => {
  assert.deepEqual(
    topThreePlaceOptions(entry("b"), picks).map((option) => option.label),
    ["#1, replaces Dish a at Hill Street", "#2", "#3"],
  );
  assert.equal(topThreePlaceOptions(entry("a"), picks)[0].label, "#1 (here now)");
});

test("a change updates the entry and takes the pick off the entry it replaced", () => {
  const diary = [entry("a", { pickKinds: ["dish_type", "overall"] }), entry("b")];
  const best = applyEntryChange(diary, "b", "best", "a");
  assert.deepEqual(best[0].pickKinds, ["overall"]);
  assert.deepEqual(best[1].pickKinds, ["dish_type"]);
  const top = applyEntryChange(best, "b", "top_three", "a");
  assert.deepEqual(top[0].pickKinds, []);
  assert.deepEqual(top[1].pickKinds, ["dish_type", "overall"]);
  const removed = applyEntryChange(top, "b", "remove_top_three");
  assert.deepEqual(removed[1].pickKinds, ["dish_type"]);
  const hidden = applyEntryChange(removed, "b", "private");
  assert.deepEqual(hidden[1], { ...removed[1], visibility: "private", pickKinds: [] });
  assert.equal(applyEntryChange(hidden, "b", "public")[1].visibility, "public");
});
