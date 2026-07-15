import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("normal Supabase synchronous getters cannot start the legacy whole-catalog warmup", () => {
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.match(
    repository,
    /function ensureHydrated\(\): void \{\s*if \(process\.env\.EXPO_PUBLIC_HUNGRY_LEGACY_CACHE_WARMUP !== "1"\) \{\s*return;/,
  );
  assert.match(repository, /client\.from\("buildings"\)\.select\("\*"\)/);
  assert.doesNotMatch(service, /refreshSupabaseRepositoryCache/);
});

test("Supabase browse and search use async bounded services without an empty sync fallback", () => {
  const screen = read("src/app/screens/search/SearchResultsScreen.tsx");
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const prefetch = read("src/features/navigation/prefetch.ts");

  assert.match(screen, /loadScopedBrowseCatalog\(discoveryService/);
  assert.match(screen, /radiusMeters: 3000/);
  assert.match(screen, /limit: 100/);
  assert.match(screen, /discoveryService\.discovery\s*\.searchDishes/);
  assert.match(screen, /radius: 5000/);
  assert.match(screen, /setTimeout\(\(\) =>[\s\S]*250\)/);
  assert.doesNotMatch(screen, /serviceResults \?\? getSearchResults/);
  assert.match(screen, /searchLoadError/);

  assert.match(service, /throw new Error\("Nearby catalog is temporarily unavailable\."\)/);
  assert.match(service, /throw new Error\("Dish search is temporarily unavailable\."\)/);
  assert.doesNotMatch(service, /return getFallbackDiscoveryFeed/);

  assert.match(prefetch, /provider\.mode === "supabase"/);
  assert.match(prefetch, /provider\.service\.discovery\s*\.searchDishes/);
});

test("production Crave and Post Composer use bounded async catalog reads", () => {
  const crave = read("src/app/screens/discover/CraveScreen.tsx");
  const composer = read("src/app/screens/post/PostComposerScreen.tsx");

  assert.match(crave, /listDiscoveryFeedByLocation\(\{/);
  assert.match(crave, /radiusMeters: 3000/);
  assert.match(crave, /limit: 20/);
  assert.doesNotMatch(crave, /repository\.listBuildings/);

  assert.match(composer, /hungryService\.discovery\s*\.searchDishes\(/);
  assert.match(composer, /hungryService\.discovery\s*\.getDish\(selectedDishId\)/);
  assert.doesNotMatch(composer, /repository\.listBuildings/);
  assert.doesNotMatch(composer, /listDishesByVenue\([^)]*\)\[0\]/);
});

test("review feed and Wheel avoid synchronous Supabase catalog hydration", () => {
  const reviews = read("src/app/screens/review/ReviewFeedScreen.tsx");
  const wheelEntry = read("src/app/screens/wheel/WheelEntryAddSheet.tsx");
  const wheelResult = read("src/app/screens/wheel/WheelResultModal.tsx");

  assert.match(reviews, /listDiscoveryFeedByLocation\(\{/);
  assert.match(reviews, /limit: 20/);
  assert.match(reviews, /getReviewsForDishes/);
  assert.doesNotMatch(reviews, /repository\s*\.listBuildings/);

  assert.match(wheelEntry, /listDiscoveryFeedByLocation\(\{/);
  assert.match(wheelEntry, /limit: 100/);
  assert.doesNotMatch(wheelEntry, /getDataRepository/);
  assert.match(wheelResult, /hungryService\.discovery\.listDishesByVenue/);
  assert.doesNotMatch(wheelResult, /getDataRepository/);
});

test("production map cards and list use the scoped location feed", () => {
  const map = read("src/app/screens/discover/HomeMapScreen.tsx");

  assert.match(map, /isSupabaseDataSource/);
  assert.match(map, /listDiscoveryFeedByLocation\(\{/);
  assert.match(map, /radiusMeters: 5000/);
  assert.match(map, /if \(isSupabaseDataSource\) return scopedDishes/);
  assert.match(map, /isSupabaseDataSource[\s\S]*\? scopedVenues/);
  assert.match(map, /mapFilters\.nearMe[\s\S]*distanceMeters > 2000/);
  assert.match(map, /mapFilters\.topRated[\s\S]*rating < 4/);
  assert.match(map, /mapFilters\.openNow[\s\S]*!venue\.isOpen/);
  assert.match(map, /mapLoadError/);
});
