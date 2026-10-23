import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

// UX research doc section 17: one obvious primary action per screen, advanced options
// behind a control, and nothing shown for a feature that is switched off.

const dish = readRepoFile("src/app/screens/detail/DishDetailScreenV2.tsx");
const stall = readRepoFile("src/app/screens/detail/StallDetailScreen.tsx");
const search = readRepoFile("src/app/screens/search/DishSearchScreen.tsx");
const profile = readRepoFile("src/app/screens/profile/ProfileHomeScreen.tsx");
const reviewHistory = readRepoFile("src/app/screens/profile/ReviewHistoryScreen.tsx");

test("dish detail leads with Directions and keeps the taste profile behind a control", () => {
  assert.match(dish, /useState\(false\);\s*\n\s*const \[operatingHoursOpen/);
  assert.match(dish, /variant="secondary"\s*\n\s*label=\{tasteProfileOpen \? "Hide Taste Profile"/);
  // The filled dock control is Directions; Review only turns into the filled one without an address.
  assert.match(dish, /\{stallAddress \? \(\s*\/\/ The one filled control in the dock/);
  assert.match(
    dish,
    /stallAddress\s*\?\s*\{\s*alignItems: "center",\s*borderColor: palette\.border/,
  );
});

test("stall detail makes Directions the single filled control above the menu", () => {
  assert.match(stall, /<Button\s+label="Directions"/);
  assert.doesNotMatch(stall, /<Chip\s+label="Directions"/);
});

test("search landing has one filled button and reports load failures", () => {
  assert.doesNotMatch(search, /primary: true/);
  assert.doesNotMatch(search, /\.catch\(\(\) => undefined\)/);
  assert.equal(search.match(/reportError\(error, \{ surface: "search_landing"/g)?.length, 3);
  assert.match(search, /manualLocation \?\? "Singapore"/);
  assert.doesNotMatch(search, /backgroundColor: palette\.text,/);
});

test("profile hides the passport entry points while gamification is off", () => {
  assert.match(profile, /\{gamificationEnabled \? "SINGAPORE FOODIE PASSPORT" : "MY PROFILE"\}/);
  assert.match(profile, /\{gamificationEnabled \? \(\s*<StatBlock\s+label="Badges"/);
  assert.match(profile, /label="Recalibrate Taste Vector"\s*\n\s*variant="secondary"/);
});

test("review history shows its write button only with history and keeps the visible name", () => {
  assert.match(reviewHistory, /\{hasHistory \? \(\s*<Button\s+label="Write another review"/);
  assert.match(reviewHistory, /variant="secondary"/);
  assert.doesNotMatch(reviewHistory, /accessibilityLabel="Write Review"/);
});

test("stall detail opens on the menu: the save-to-list card sits after it", () => {
  assert.ok(
    stall.indexOf("{/* Menu */}") < stall.indexOf("<DetailSaveActionsCard"),
    "Save this stall must come after the menu",
  );
});

test("Popular badges come from reviews, not the editorial must-order flag", () => {
  const decide = readRepoFile("src/app/screens/discover/DecideForMeResultScreen.tsx");
  assert.doesNotMatch(decide, /dish\.mustOrder/);
  assert.match(decide, /isPopularDish\(dish\)\s*\?\s*\(\s*<Badge label="Popular nearby"/);
  assert.doesNotMatch(dish, /MUST ORDER/);
});

test("the weekly picks button does not squeeze its heading to nothing", () => {
  const rail = readRepoFile("src/components/dish/WeeklyPicksRail.tsx");
  assert.match(rail, /<Button label="Decide for me" size="sm" fullWidth=\{false\}/);
});
