import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("dish detail location pill shows only the stall name and taste profile animates", () => {
  const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const reveal = read("src/features/detail/ExpandableReveal.tsx");

  assert.doesNotMatch(dishDetail, /\{venue\.name\} - \{venue\.unitNumber\}/);
  assert.match(dishDetail, /<ExpandableReveal open=\{tasteProfileOpen\}>/);
  assert.match(dishDetail, /accessibilityState=\{\{ expanded: tasteProfileOpen \}\}/);
  assert.match(reveal, /useReduceMotion\(\)/);
  assert.match(reveal, /withTiming\(/);
});

test("stall detail header uses a building label and organised address lines", () => {
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(stallDetail, /<AppText variant="h3" numberOfLines=\{2\}>\s*\{venue\.name\}/);
  assert.match(stallDetail, /\[stallBuildingLabel, distanceLabel\]/);
  assert.match(stallDetail, /stallAddressLines\.map/);
});

test("discover 'More from' stall showcase cards do not show prices", () => {
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  assert.doesNotMatch(discover, /card\.heroDish\.price/);
});
