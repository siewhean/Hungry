// Home's first-read skeleton and its time limit. Run with
// `TSX_TSCONFIG_PATH=tsconfig.test.json HUNGRY_DATA_SOURCE=mock node --import tsx --test <file>`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const home = readFileSync("src/app/screens/discover/DiscoverHomeScreen.tsx", "utf8");
const feed = readFileSync("src/features/discover/useDiscoverFeed.ts", "utf8");
const rail = readFileSync("src/components/discover/home/DiscoverBiteRail.tsx", "utf8");

test("while the first read is out, only the lead rail shows a skeleton", () => {
  // Rails other than "Dishes near you" may not be on the finished page, so they wait for dishes.
  assert.match(home, /showInitialDiscoverSkeleton\s*\?\s*showWhileLoading/);
  assert.match(
    home,
    /shouldRenderDiscoverRail\(\s*quickBiteCards\.length,\s*MIN_DISCOVER_RAIL_ITEMS,\s*true,?\s*\)/,
  );
});

test("skeleton rails and the classics row show a bar instead of a section name", () => {
  assert.match(rail, /isLoading \? \(\s*\/\/ While the dishes load the title is a bar/);
  assert.match(home, /showInitialDiscoverSkeleton \? \(\s*<Skeleton width="45%" height=\{24\} \/>/);
});

test("a feed read that never answers hands Home to the offline page", () => {
  assert.match(feed, /export const DISCOVER_FEED_TIMEOUT_MS = 15_000/);
  assert.match(feed, /setTimeout\(\(\) => \{[\s\S]*setDiscoverLoadError\(true\)/);
  assert.match(feed, /clearTimeout\(timeoutId\)/);
  // A feed already on screen (saved copy, first page, earlier area) is never replaced by it.
  assert.match(feed, /hasFeedOnScreen \|\| loadedFeedKeyRef\.current !== null/);
  // The load error is what switches Home to the offline page.
  assert.match(home, /discoverLoadError \|\|/);
});
