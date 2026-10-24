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
  // A verified merchant's weekly schedule wins; listed text hours are the fallback.
  assert.match(stall, /resolveStallOpenInfo\(\{\s*venue,\s*schedule: openingSchedule,/);
  const openState = read("src/features/detail/stallOpenState.ts");
  assert.match(openState, /getScheduleOpenState\(schedule, venue\.isOpen, now\)/);
  assert.match(openState, /getVenueOpenState\(venue\.operatingHours, venue\.isOpen, now\)/);
  assert.match(openState, /parseOperatingHours\(venue\.operatingHours\)/);
  assert.match(stall, /hoursRows\.map/);
  assert.doesNotMatch(stall, /venue\.operatingHours\.split\(" – "\)/);
  assert.doesNotMatch(stall, /Open Now/);
  assert.doesNotMatch(stall, /Check Map/);
});

test("dish detail V2 avoids invented wait times and fake hours", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  // The wait card is gone: nothing here is a measured wait (detail-M6).
  assert.doesNotMatch(dish, /formatWaitTime|waitTime/);
  assert.match(dish, /resolveStallOpenInfo\(/);
  assert.doesNotMatch(dish, /Mon-Fri/);
  assert.doesNotMatch(dish, /Sat-Sun/);
  assert.doesNotMatch(dish, /signature order/);
  assert.doesNotMatch(dish, /listPopularNearby/);
  assert.doesNotMatch(dish, /Dine-in only/);
});

test("dish detail V2 bottom bar is labelled, stateful and meets 44px targets", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const bar = read("src/components/detail/DetailActionBar.tsx");

  assert.doesNotMatch(dish, /height: (40|42),/);
  assert.doesNotMatch(dish, /Missing dish data for ID/);
  assert.doesNotMatch(dish, /Sparkles/);
  assert.match(dish, /We can't find this dish/);
  // Share, Tried, Save and Like sit in one bar of icon buttons; no three-dots menu.
  assert.match(dish, /<DetailActionBar\s+actions=\{barActions\}\s+cta=/);
  assert.match(dish, /testID="dish-action-bar"/);
  assert.doesNotMatch(dish, /secondaryActions/);
  for (const label of ["Like", "Share", "Tried"]) {
    assert.match(dish, new RegExp(`label: [^\\n]*"${label}`));
  }
  assert.match(dish, /label: isSaved \? "Saved" : "Save"/);
  assert.match(dish, /active: isSaved/);
  assert.match(dish, /role: "checkbox"/);
  assert.match(dish, /active: isDishTried/);
  // The bar itself: 44px or taller targets, brand colour when on, never white on the white bar.
  assert.match(bar, /const TARGET_SIZE = 48;/);
  assert.match(
    bar,
    /action\.active\s+\? palette\.orange\s+: action\.mutedWhenInactive\s+\? palette\.textMuted\s+: palette\.text/,
  );
  assert.match(bar, /accessibilityRole=\{action\.role \?\? "button"\}/);
  assert.match(bar, /checked: Boolean\(action\.active\)/);
  assert.doesNotMatch(bar, /palette\.white/);
  assert.match(dish, /label: "Write a review"/);
});
