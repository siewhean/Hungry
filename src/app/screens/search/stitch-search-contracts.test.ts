import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

test("Stitch Search quick filters use supported result filters", () => {
  const home = read("src/app/screens/search/DishSearchScreen.tsx");
  const filters = read("src/features/search/browseFilters.ts");
  assert.match(home, /accessibilityLabel="Go back to Discover"/);
  assert.match(home, /navigation\.canGoBack\(\)[\s\S]*navigation\.goBack\(\)/);
  assert.match(home, /navigation\.navigate\("MainTabs", \{ screen: "Discover" \}\)/);
  assert.match(home, /if \(isAuthenticated\)[\s\S]*screen: "TasteQuiz",[\s\S]*mode: "profile"/);
  assert.match(home, /label: "Near Me",\s*filter: undefined/);
  assert.match(home, /label: "Under S\$6",\s*filter: "Under S\$6"/);
  assert.match(home, /label: "Halal",\s*filter: "Halal"/);
  // Owner decision (round 2): no Rice chip.
  assert.doesNotMatch(home, /label: "Rice"/);
  assert.doesNotMatch(home, /filter: "Open Now"/);
  assert.match(filters, /export const BROWSE_FILTER_IDS = \[/);
  assert.match(home, /initialFilter: filter/);
});

test("Stitch Search featured cards show catalog dishes and open the corresponding detail", () => {
  const home = read("src/app/screens/search/DishSearchScreen.tsx");
  assert.match(home, /\.listDishes\(\{ limit: 3, sort: "quality" \}\)/);
  assert.match(home, /featuredDishes\.map\(\(dish\) => \(/);
  assert.match(
    home,
    /navigation\.navigate\("CatalogRawDetail", \{ kind: "dish", id: dish\.id \}\)/,
  );
  assert.match(home, /dish\.imageUrl \?\s*\(\s*<AccessibleImage/);
  assert.match(home, /dish\.price != null/);
  assert.match(home, /Recent Searches/);
  assert.match(home, /Hawker Classics/);
});
