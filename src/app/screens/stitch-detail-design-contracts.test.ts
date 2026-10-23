import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const stall = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
const dish = readRepoFile("src/app/screens/detail/DishDetailScreenV2.tsx");

test("Stitch stall layout keeps catalogue and review evidence dynamic", () => {
  assert.match(stall, /Stall Profile/);
  assert.match(stall, /Signature Dishes/);
  assert.match(stall, /Community Highlights/);
  assert.match(stall, /ratingSummary\s*\?/);
  assert.match(stall, /dish\.reviewCount > 0/);
  assert.match(stall, /isPopularDish\(dish\)\s*\?/);
  assert.doesNotMatch(stall, /dish\.mustOrder/);
  assert.match(stall, /openInfo\.closureNotice/);
  assert.match(stall, /<PhotoPager/);
  assert.doesNotMatch(stall, /Michelin Bib Gourmand|NEA Grade A|2,410 reviews/);
});

test("Stitch dish layout keeps taste, rating, price, and menu data dynamic", () => {
  assert.match(dish, /Dish Details/);
  assert.match(dish, /Taste Matrix &amp; Palate Profile/);
  assert.match(dish, /Community Palate Feedback/);
  assert.match(dish, /isPopularDish\(dish\)\s*\?/);
  assert.doesNotMatch(dish, /dish\.mustOrder/);
  assert.match(dish, /hasTasteSignal\s*\?/);
  assert.match(dish, /dish\.tasteVector\[dimension\.key\]/);
  assert.match(dish, /formatDishPrice\(item\)/);
  assert.match(dish, /dish\.reviewCount > 0/);
  assert.match(dish, /<PhotoPager/);
  assert.doesNotMatch(
    dish,
    /Michelin Bib Gourmand|Halal-friendly ingredients|Grade A Hygiene|420 reviews/,
  );
});
