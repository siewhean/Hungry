import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseSearchDeepLinkQuery } from "@/app/navigation/linking";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

test("search grid: load-more retry, stable location, analytics and labelled controls", () => {
  const grid = read("src/app/screens/search/SearchResultsScreen.tsx");

  assert.match(grid, /setLoadMoreFailed\(true\)/);
  assert.match(grid, /Couldn't load more\./);
  assert.match(grid, /roundCoordinate\(effectiveCoordinate\.latitude\)/);
  // Sign-in only: the grid loads for a signed-in user, so loading depends on isAuthenticated.
  assert.match(
    grid,
    /\[\s*coordinate,\s*filters,\s*isAuthenticated,\s*mode,\s*place,\s*query,\s*requestKey,\s*service,\s*sort,\s*widenRadius,\s*\]/,
  );
  assert.doesNotMatch(grid, /\[currentLocation, (isAuthenticated, )?mode/);
  for (const event of [
    "search_query",
    "search_zero_results",
    "search_filter_changed",
    "search_result_opened",
    "search_load_more",
  ]) {
    assert.match(grid, new RegExp(`trackAnalyticsEvent\\("${event}"`));
  }
  assert.match(grid, /keyboardShouldPersistTaps="handled"/);
  assert.match(grid, /returnKeyType="search"/);
  assert.match(grid, /accessibilityLabel="Clear search"/);
  assert.match(grid, /<IconButton[\s\S]*accessibilityLabel="Go back"[\s\S]*onPress=\{handleBack\}/);
  assert.match(grid, /if \(navigation\.canGoBack\(\)\)/);
  // No "Open now" chip until open status comes from opening hours (r2 H22).
  assert.doesNotMatch(grid, /OPEN_NOW_FILTER|openOnly:/);
  assert.match(
    read("src/features/search/browseGrid.ts"),
    /maxPrice: input\.filters\.includes\(BUDGET_FILTER\) \? BUDGET_MAX_PRICE : undefined/,
  );
  assert.match(grid, /Location is off, so distances are from central Singapore\./);
  assert.doesNotMatch(grid, /fontSize: 10/);
});

test("search home: params instead of persisted query, recents, landing view, reduce motion", () => {
  const home = read("src/app/screens/search/DishSearchScreen.tsx");
  const store = read("src/store/useSearchStore.ts");

  assert.doesNotMatch(home, /updateQuery/);
  // Search is ready for immediate typing while the Stitch quick filters and dish cards remain available.
  assert.match(home, /\bautoFocus\b/);
  assert.match(home, /Hawker Classics/);
  assert.match(home, /Dishes to Discover/);
  assert.match(home, /returnKeyType="search"/);
  assert.match(home, /Recent Searches/);
  assert.match(home, /allowSearchHistory && recentSearches\.length > 0/);
  assert.match(home, /useNativeDriver: true/);
  assert.doesNotMatch(home, /useNativeDriver: false/);
  assert.match(home, /useReduceMotion\(\)/);
  // Only recent searches are persisted; the typed query and filters never are.
  assert.match(store, /partialize: \(state\) => \(\{ recentSearches: state\.recentSearches \}\)/);
});

test("search history off stops search_query taste signals and query text", () => {
  const profileStore = read("src/store/useProfileStore.ts");
  assert.match(
    profileStore,
    /if \(!allowSearchHistory && rawInput\.type === "search_query"\) return undefined;/,
  );
});

test("search links parse a safe query, filter and mode", () => {
  assert.deepEqual(parseSearchDeepLinkQuery("search?q=chicken%20rice&filter=Halal&mode=stalls"), {
    initialQuery: "chicken rice",
    initialFilter: "Halal",
    browseMode: "stalls",
  });
  assert.deepEqual(parseSearchDeepLinkQuery("search?filter=Nope&mode=map"), {});
  assert.match(read("src/app/navigation/linking.ts"), /SearchResults: "search"/);
});

test("settings: device left-handed mode, deletion via RPC, alerts states, haptics wrapper", () => {
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  const uiStore = read("src/store/useUIStore.ts");
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const alerts = read("src/components/settings/StallAlertsSettings.tsx");
  const section = read("src/components/settings/SettingsSection.tsx");
  const row = read("src/components/settings/SettingsRow.tsx");
  const eslint = read("eslint.config.js");

  assert.match(uiStore, /leftHandedMode: state\.leftHandedMode/);
  assert.doesNotMatch(read("src/store/useProfileStore.ts"), /setLeftHandedMode/);
  assert.match(service, /client\.rpc\("request_my_account_deletion"/);
  assert.doesNotMatch(service, /from\("account_deletion_requests"\)\.insert/);
  assert.match(settings, /formatDeletionDate\(scheduledFor\)/);
  assert.doesNotMatch(settings, /label="Profile ID"|label="Display name"/);
  assert.match(settings, /SettingsChoiceSheet/);
  assert.match(settings, /title="Theme"/);
  assert.match(alerts, /busy=\{isBusy\}/);
  assert.match(alerts, /Linking\.openSettings\(\)/);
  assert.match(section, /accessibilityRole="header"/);
  assert.doesNotMatch(section, /toUpperCase\(\)/);
  assert.match(row, /offTrackColor=\{palette\.textMuted\}/);
  assert.match(eslint, /name: "expo-haptics"/);
  assert.match(read("src/lib/haptics.ts"), /hapticFeedbackEnabled/);
});

test("edit profile: no pre-prompt, honest toast, unsaved-changes guard, labelled controls", () => {
  const edit = read("src/app/screens/profile/EditProfileScreen.tsx");

  assert.doesNotMatch(edit, /confirmGalleryAccess|requestMediaLibraryPermissionsAsync/);
  assert.match(edit, /Photo selected\. Tap Save changes to use it\./);
  assert.match(edit, /addListener\("beforeRemove"/);
  assert.match(edit, /validateDisplayName\(displayName\)/);
  assert.match(read("src/features/profile/profileName.ts"), /Enter a display name\./);
  assert.match(edit, /accessibilityLabel="Change profile photo"/);
  assert.match(read("src/app/screens/profile/SettingsScreen.tsx"), /label="Change password"/);
  assert.match(read("src/lib/permissions/gallery.ts"), /onDismiss: \(\) => resolve\(false\)/);
});

test("account deletion worker removes the user's media and avatar link", () => {
  const worker = read("supabase/functions/process-account-deletions/index.ts");
  // Owner-prefixed buckets (menu photos are kept on purpose) are emptied after the purge.
  for (const bucket of ["avatars", "review-media", "bites-media", "post-media"]) {
    assert.match(worker, new RegExp(`const USER_PREFIXED_BUCKETS = \\[[\\s\\S]*?"${bucket}"`));
  }
  assert.match(worker, /\.update\(\{ avatar_url: null \}\)/);
  assert.match(worker, /deleteUserStorageObjects\(\s*client,\s*userId,/);
});
