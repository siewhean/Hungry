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
  const legacyStall = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(stall, /EmptyState/);
  assert.match(stall, /Stall not found/);
  assert.doesNotMatch(stall, /if \(!venue\) return null/);
  assert.match(stall, /Math\.max\(insets\.bottom, spacing\[4\]\)/);
  assert.match(stall, /formatDistance\(leadDish\?\.distanceMeters\)/);
  assert.match(stall, /formatVenueStatus\(venue\)/);
  assert.match(stall, /PopularVisitorsSection/);
  assert.match(legacyStall, /PopularVisitorsSection/);
  assert.match(
    stall,
    /const isVenueOpen = isVenueOpenFromHours\(venue\.operatingHours, venue\.isOpen\)/,
  );
  assert.doesNotMatch(stall, /style=\{\{ color: palette\.success \}\}[\s\S]*\{statusLabel\}/);
  assert.match(stall, /Saved top dish to favourites/);
  assert.doesNotMatch(stall, /Save stall/);
  assert.match(
    legacyStall,
    /const isVenueOpen = isVenueOpenFromHours\(venue\.operatingHours, venue\.isOpen\)/,
  );
  assert.match(legacyStall, /formatWeeklyOperatingHours\(venue\.operatingHours\)/);
  assert.match(legacyStall, /weeklyOperatingHours\.map/);
  assert.doesNotMatch(legacyStall, /venue\.operatingHours\.split\(" – "\)/);
  assert.doesNotMatch(legacyStall, /Open Now/);
  assert.doesNotMatch(legacyStall, /Check Map/);
});

test("dish detail V2 avoids invented wait times and fake hours", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const legacyDish = read("src/app/screens/detail/DishDetailScreen.tsx");

  assert.match(dish, /const waitTime = formatWaitTime/);
  assert.match(dish, /\.\.\.\(waitTime/);
  assert.doesNotMatch(dish, /Mon-Fri/);
  assert.doesNotMatch(dish, /Sat-Sun/);
  assert.doesNotMatch(dish, /signature order/);
  assert.doesNotMatch(dish, /listPopularNearby/);
  assert.match(legacyDish, /No delivery links listed/);
  assert.match(legacyDish, /We do not have verified delivery links for this stall yet\./);
  assert.doesNotMatch(legacyDish, /Dine-in only/);
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
