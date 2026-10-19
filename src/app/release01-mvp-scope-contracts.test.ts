import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveFeatureFlags } from "@/constants/featureFlags";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

type EasProfile = { env?: Record<string, string> };

const RELEASE_PROFILES = ["internal-alpha", "preview", "production"] as const;

test("R01-SCOPE-01: favourites ship default-on in every eas release profile", () => {
  const eas = JSON.parse(read("eas.json")) as { build: Record<string, EasProfile> };

  for (const name of RELEASE_PROFILES) {
    const env = eas.build[name]?.env ?? {};
    const flags = resolveFeatureFlags(env.EXPO_PUBLIC_APP_ENV, "production", env);

    assert.equal(flags.favouritesEnabled, true, `${name} must expose favourites`);
    // eas.json and flags must agree on the versioned catalog read path.
    assert.equal(
      flags.catalogReadV2,
      env.EXPO_PUBLIC_CATALOG_READ_V2 === "1",
      `${name} env must not contradict flags`,
    );
  }

  // The internal-alpha profile keeps the narrow Release 0.1 core-only surface.
  const alphaEnv = eas.build["internal-alpha"]?.env ?? {};
  const alpha = resolveFeatureFlags(alphaEnv.EXPO_PUBLIC_APP_ENV, "production", alphaEnv);
  assert.equal(alpha.release01CoreOnly, true);
  for (const [key, value] of Object.entries(alphaEnv)) {
    if (key.startsWith("EXPO_PUBLIC_ENABLE_")) {
      assert.equal(value, "0", `internal-alpha must keep ${key} closed`);
    }
  }
  assert.equal(alpha.socialFeedEnabled, false);
  assert.equal(alpha.reviewCreationEnabled, false);
  assert.equal(alpha.activityEnabled, false);

  // Preview and production follow main's product surface (no core-only narrowing).
  for (const name of ["preview", "production"] as const) {
    const env = eas.build[name]?.env ?? {};
    const flags = resolveFeatureFlags(env.EXPO_PUBLIC_APP_ENV, "production", env);
    assert.equal(flags.release01CoreOnly, false, `${name} follows main's surface`);
    assert.equal(flags.socialFeedEnabled, true);
    assert.equal(flags.reviewCreationEnabled, true);
    assert.equal(flags.portfoliosEnabled, true);
    assert.equal(flags.stallAlertsEnabled, true);
  }
});

test("R01-WRITE-01: favourite writes resolve only after the authenticated write settles", () => {
  const store = read("src/store/useProfileStore.ts");

  assert.match(
    store,
    /toggleFavourite: \(dish: FavouriteDishInput\) => Promise<FavouriteToggleResult>/,
  );
  assert.match(store, /toggleFavourite: async \(dish\) => \{/);
  assert.match(
    store,
    /const saved = await getHungryService\(\)\.profile\.toggleFavourite\(dishId, ownerUserId\);\s*if \(!isStillOwner\(\)\) return staleFavouriteResult\(\);[\s\S]*?return \{ status: saved \? "saved" : "removed" \};/,
  );
  assert.match(
    store,
    /catch \(error\) \{\s*if \(!isStillOwner\(\)\) return staleFavouriteResult\(\);[\s\S]*?reason: "sync_failed"/,
  );
  assert.match(store, /reason: "signed_out"/);
});

test("R01-WRITE-01: favourite results are dropped when the account changes mid-write", () => {
  const store = read("src/store/useProfileStore.ts");
  const supabase = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(store, /clearProfile: \(\) => \{\s*bumpProfileAccountEpoch\(\);/);
  assert.match(
    store,
    /bumpProfileAccountEpoch\(\);\s*set\(\{\s*profile: withNeutralTasteProfile\(/,
  );
  assert.match(
    supabase,
    /async toggleFavourite\(dishId: string, expectedUserId\?: string\)[\s\S]*?if \(expectedUserId && userId !== expectedUserId\) \{\s*throw/,
  );
});

test("R01-WRITE-01: favourite toasts follow the write result, never an optimistic guess", () => {
  const catalogDetail = read("src/app/screens/catalog/CatalogRawDetailScreen.tsx");
  const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const favourites = read("src/app/screens/profile/FavouritesScreen.tsx");

  assert.match(catalogDetail, /\{isDish && FEATURE_FLAGS\.favouritesEnabled \? \(/);
  assert.match(
    catalogDetail,
    /const result = await toggleFavourite\(\{ id: dish\.id, venueId: dish\.venueId \}\);[\s\S]*?result\.status === "failed"[\s\S]*?tone: "error"/,
  );

  assert.match(
    dishDetail,
    /const result = await toggleFavourite\(dish\);\s*if \(result\.status === "failed"\) \{\s*showToast\(\{ message: result\.message, tone: "error" \}\);/,
  );
  assert.doesNotMatch(dishDetail, /Saved to favourites!/);

  assert.match(favourites, /<CatalogFavouritesScreen \{\.\.\.props\} \/>/);
  assert.match(
    favourites,
    /rootNavigation\.navigate\("CatalogRawDetail", \{ kind: "dish", id: dish\.id \}\)/,
  );
  assert.match(
    favourites,
    /result\.status === "failed"\s*\? \{ message: result\.message, tone: "error" \}/,
  );
});

test("release-reachable screens hide controls for cut features behind their flags", () => {
  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  const notFound = read("src/app/screens/detail/NotFoundScreen.tsx");
  const search = read("src/app/screens/search/DishSearchScreen.tsx");
  const dishDetail = read("src/app/screens/detail/DishDetailScreenV2.tsx");

  assert.match(settings, /const showSocialPrivacySettings = FEATURE_FLAGS\.socialFeedEnabled;/);
  assert.match(
    settings,
    /\{showSocialPrivacySettings \? \(\s*<SettingsSection title="Privacy">[\s\S]*?label="Profile visibility"/,
  );
  // Unwired preferences were removed outright (see mvp-source-of-truth-contracts).
  for (const label of [
    "Show location badge",
    "Dietary filters",
    "Show only favourite dishes",
    "Show activity feed",
    "Hide reviewed dishes from public feed",
  ]) {
    assert.doesNotMatch(settings, new RegExp(`label="${label}"`));
  }
  assert.match(settings, /onToggle=\{setLeftHandedMode\}\s*isLast\s/);

  assert.match(
    notFound,
    /label=\{FEATURE_FLAGS\.socialFeedEnabled \? "Back to Feed" : "Back to Discover"\}/,
  );

  assert.match(search, /\{!shouldUseCatalogReadV2 \? \(\s*<Pressable[\s\S]*?SUGGESTED FOR TONIGHT/);

  // DishDetailV2 is a prototype-only route; release detail links must use DishDetail.
  assert.doesNotMatch(dishDetail, /navigate\("DishDetailV2"/);
  assert.doesNotMatch(dishDetail, /name: "DishDetailV2"/);
});
