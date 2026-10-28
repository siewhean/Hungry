import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const stall = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
const dish = readRepoFile("src/app/screens/detail/DishDetailScreenV2.tsx");

test("Stitch stall layout keeps catalogue and review evidence dynamic", () => {
  assert.match(stall, /<DetailCollapsingHeader/);
  // The whole menu is titled "Menu", not "Signature dishes" (STALL-10).
  assert.match(stall, /<AppText variant="h2">Menu<\/AppText>/);
  assert.doesNotMatch(stall, /Signature dishes/);
  assert.match(stall, /<AppText variant="h2">Reviews<\/AppText>/);
  assert.doesNotMatch(stall, /Community Highlights/);
  assert.match(stall, /ratingSummary\s*\?/);
  assert.match(stall, /dish\.reviewCount > 0/);
  assert.match(stall, /dish\.mustOrder\s*\?/);
  assert.match(stall, /openInfo\.extraNotice/);
  assert.match(stall, /<PhotoPager/);
  assert.doesNotMatch(stall, /Michelin Bib Gourmand|NEA Grade A|2,410 reviews/);
});

test("Stitch dish layout keeps taste, rating, price, and menu data dynamic", () => {
  assert.match(dish, /<DetailCollapsingHeader/);
  assert.match(dish, /How it tastes to you/);
  assert.match(dish, /<AppText variant="h2">Reviews<\/AppText>/);
  assert.match(dish, /dish\.mustOrder\s*\?/);
  assert.match(dish, /hasTasteSignal\s*\?/);
  assert.match(dish, /perceivedTasteRows\(dish\.tasteVector, profile\.tasteVector\)/);
  assert.match(dish, /formatDishPrice\(item\)/);
  assert.match(dish, /dish\.reviewCount > 0/);
  assert.match(dish, /<PhotoPager/);
  assert.doesNotMatch(
    dish,
    /Michelin Bib Gourmand|Halal-friendly ingredients|Grade A Hygiene|420 reviews/,
  );
});
