import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("stall detail V2 handles missing data and uses real venue/dish values", () => {
  const stall = read("src/app/screens/detail/StallDetailScreenV2.tsx");

  assert.match(stall, /EmptyState/);
  assert.match(stall, /Stall not found/);
  assert.doesNotMatch(stall, /if \(!venue\) return null/);
  assert.match(stall, /Math\.max\(insets\.bottom, spacing\[4\]\)/);
  assert.match(stall, /formatDistance\(leadDish\?\.distanceMeters\)/);
  assert.match(stall, /formatVenueStatus\(venue\)/);
  assert.match(stall, /Saved top dish to favourites/);
  assert.doesNotMatch(stall, /Save stall/);
});

test("dish detail V2 avoids invented wait times and fake hours", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.match(dish, /const waitTime = formatWaitTime/);
  assert.match(dish, /\.\.\.\(waitTime/);
  assert.doesNotMatch(dish, /Mon-Fri/);
  assert.doesNotMatch(dish, /Sat-Sun/);
  assert.doesNotMatch(dish, /signature order/);
  assert.doesNotMatch(dish, /listPopularNearby/);
});
