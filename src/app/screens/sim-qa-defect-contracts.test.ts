import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { PUBLIC_LINKS, PUBLIC_SITE_ORIGIN } from "@/constants/supportLinks";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("D1: saved dish bookmark uses a visible brand fill, never white on the light action bar", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  assert.match(dish, /color=\{isSaved \? palette\.orange : palette\.text\}/);
  assert.match(dish, /fill=\{isSaved \? palette\.orange : "none"\}/);
  assert.doesNotMatch(dish, /isSaved \? palette\.white/);
});

test("D3: missing-dish state offers a back control with a no-history fallback", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const notFound = dish.slice(
    dish.indexOf("if (!dish || !venue)"),
    dish.indexOf('title="Dish not found"'),
  );
  assert.match(notFound, /accessibilityLabel="Go back"/);
  assert.match(notFound, /onPress=\{leaveDetail\}/);
  assert.match(
    dish,
    /navigation\.canGoBack\(\)[\s\S]{0,80}navigation\.goBack\(\)[\s\S]{0,80}"MainTabs", \{ screen: "Discover" \}/,
  );
});

test("D8: dish -> stall link goes through openStallFromDish, not navigate", () => {
  const dish = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  assert.match(dish, /openStallFromDish\(navigation, dish\.venueId\)/);
  assert.doesNotMatch(dish, /navigation\.navigate\("StallDetail"/);
});

test("D2: Edit Profile reads the name from the profile store, not a mount-time snapshot", () => {
  const edit = read("src/app/screens/profile/EditProfileScreen.tsx");
  assert.doesNotMatch(edit, /useState\(profile\.displayName\)/);
  assert.match(edit, /const displayName = displayNameDraft \?\? profile\.displayName;/);
  assert.match(edit, /useFocusEffect\([\s\S]{0,120}setDisplayNameDraft\(null\)/);
});

test("D2: applyProfile updates the store value Edit Profile renders on reopen", async () => {
  const { useProfileStore } = await import("@/store/useProfileStore");
  const before = useProfileStore.getState().profile;
  try {
    useProfileStore.getState().applyProfile({ ...before, displayName: "Renamed Diner" });
    // Edit Profile renders `draft ?? profile.displayName`; the draft is null on focus.
    const draft: string | null = null;
    assert.equal(draft ?? useProfileStore.getState().profile.displayName, "Renamed Diner");
  } finally {
    useProfileStore.getState().applyProfile(before);
  }
});

test("D5: Settings support/legal links use the live site constants", () => {
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  assert.doesNotMatch(settings, /https:\/\/hungry\.sg|mailto:/);
  for (const key of ["support", "helpCenter", "privacy", "terms", "accountDeletion"]) {
    assert.match(settings, new RegExp(`PUBLIC_LINKS\\.${key}`));
  }
  for (const url of Object.values(PUBLIC_LINKS)) {
    assert.ok(url.startsWith(`${PUBLIC_SITE_ORIGIN}/`), url);
  }
  assert.match(read("src/lib/security/safeLinking.ts"), /"usehungry\.com"/);
});

test("D6: release search inputs expose an accessible clear button and results header renders back + field", () => {
  const view = read("src/components/discover/SearchResultsView.tsx");
  const results = read("src/app/screens/search/SearchResultsScreen.tsx");
  const dishSearch = read("src/app/screens/search/DishSearchScreen.tsx");

  assert.doesNotMatch(view, /isSearchExpanded/);
  assert.match(view, /accessibilityLabel="Go back"/);
  assert.match(view, /accessibilityLabel="Search dishes"/);
  assert.match(view, /accessibilityLabel="Clear search"/);
  assert.match(results, /onBack=\{\(\) =>/);
  assert.match(results, /onPress=\{\(\) => \{\s*setSearchQuery\(""\);/);
  assert.match(dishSearch, /accessibilityLabel="Clear search"/);
});
