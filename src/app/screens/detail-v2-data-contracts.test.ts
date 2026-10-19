import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("stall detail uses real venue hours and popular visitors", () => {
  const stall = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(stall, /PopularVisitorsSection/);
  assert.match(
    stall,
    /const openState = getVenueOpenState\(venue\.operatingHours, venue\.isOpen\)/,
  );
  assert.match(stall, /parseOperatingHours\(venue\.operatingHours\)/);
  assert.match(stall, /weeklyOperatingHours\.map/);
  assert.doesNotMatch(stall, /venue\.operatingHours\.split\(" – "\)/);
  assert.doesNotMatch(stall, /Open Now/);
  assert.doesNotMatch(stall, /Check Map/);
});

test("dish detail V2 avoids invented wait times and fake hours", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.match(dish, /const waitTime = formatWaitTime/);
  assert.match(dish, /\.\.\.\(waitTime/);
  assert.doesNotMatch(dish, /Mon-Fri/);
  assert.doesNotMatch(dish, /Sat-Sun/);
  assert.doesNotMatch(dish, /signature order/);
  assert.doesNotMatch(dish, /listPopularNearby/);
  assert.doesNotMatch(dish, /Dine-in only/);
});

test("dish detail V2 action dock is labelled, stateful and meets 44px targets", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.match(dish, /const dockTargetSize = 44;/);
  assert.doesNotMatch(dish, /height: (40|42),/);
  assert.doesNotMatch(dish, /Missing dish data for ID/);
  assert.doesNotMatch(dish, /Sparkles/);
  assert.match(dish, /We can't find this dish/);
  assert.match(
    dish,
    /accessibilityLabel=\{isSaved \? "Saved" : "Save"\}[\s\S]*accessibilityState=\{\{ selected: isSaved \}\}/,
  );
  assert.match(dish, /color=\{isSaved \? palette\.orange : palette\.text\}/);
  assert.doesNotMatch(dish, /isSaved \? palette\.white/);
  assert.match(
    dish,
    /accessibilityRole="checkbox"\s*accessibilityLabel="Tried"\s*accessibilityState=\{\{ checked: isDishTried/,
  );
  assert.match(dish, /accessibilityLabel="Write a review"[\s\S]*?>\s*Review\s*<\/AppText>/);
});
