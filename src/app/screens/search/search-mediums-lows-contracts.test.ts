import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), "utf8");

const DISHES_AND_STALLS = "supabase/migrations/20261022020200_catalog_search_quality_hardening.sql";
const SEARCH_DISHES = "supabase/migrations/20261022020100_search_dishes_all_dietary_flags.sql";
const SUGGEST = "supabase/migrations/20261022020300_catalog_suggest_fuzzy_food_types.sql";
const SMOKE = "supabase/smoke/catalog_search_quality_hardening.sql";

test("M1/L2: the page RPCs cap, escape and require two characters of text", () => {
  const sql = read(DISHES_AND_STALLS);
  assert.equal(sql.match(/left\(nullif\(trim\(coalesce\(p_query, ''\)\), ''\), 80\)/g)?.length, 2);
  assert.equal(sql.match(/char_length\(v_query\) < 2/g)?.length, 2);
  assert.equal(
    sql.match(
      /replace\(replace\(replace\(coalesce\(v_query, ''\), '\\', '\\\\'\), '%', '\\%'\), '_', '\\_'\)/g,
    )?.length,
    2,
    "typed text is escaped for LIKE in both RPCs",
  );
  // Typed text never reaches ilike unescaped.
  assert.doesNotMatch(sql, /ilike '%' \|\| p_query/);
  assert.doesNotMatch(sql, /ilike '%' \|\| v_query/);
});

test("M3/M4/M11: price sort, capped match count, quality term and food keywords", () => {
  const sql = read(DISHES_AND_STALLS);
  assert.equal(sql.match(/p_sort = 'price'/g)?.length, 10);
  assert.equal(sql.match(/'match_count', v_match_count/g)?.length, 2);
  assert.equal(sql.match(/limit 100\) capped/g)?.length, 2);
  // At most 0.04 + 0.03 + 0.02 + 0.01 = 0.10 on top of the text and distance terms.
  assert.equal(sql.match(/0\.04 \* least\(ln\(1 \+ greatest\(/g)?.length, 2);
  assert.equal(sql.match(/0\.03 \* least\(greatest\(/g)?.length, 2);
  assert.equal(
    sql.match(/verification_status in \('verified', 'approved'\) then 0\.02/g)?.length,
    2,
  );
  assert.equal(sql.match(/image_url is not null then 0\.01/g)?.length, 2);
  assert.match(sql, /p_food_keywords text\[\] default '\{\}'/);
  assert.match(
    sql,
    /c\.food_type ilike any\(v_food_patterns\) or c\.name ilike any\(v_food_patterns\)/,
  );
});

test("the old RPC signatures are dropped and the new ones stay guest-callable definers", () => {
  const sql = read(DISHES_AND_STALLS);
  assert.match(sql, /drop function if exists public\.catalog_raw_dishes_page\(/);
  assert.match(sql, /drop function if exists public\.catalog_raw_venues_page\(/);
  assert.equal(sql.match(/security definer set search_path = public, extensions/g)?.length, 2);
  assert.match(
    sql,
    /grant execute on function public\.catalog_raw_dishes_page\([^)]*text\[\], text\[\], text\) to anon, authenticated;/,
  );
  assert.match(
    sql,
    /grant execute on function public\.catalog_raw_venues_page\([^)]*text\[\], text\[\], text\) to anon, authenticated;/,
  );
  assert.match(sql, /revoke all on function public\.catalog_raw_dishes_page\([^)]*\) from public;/);
  // No other migration or smoke file may still name the old 14-argument dish signature.
  for (const file of [
    "supabase/smoke/catalog_raw_reads.sql",
    "supabase/smoke/catalog_search_dietary_distance.sql",
    "supabase/smoke/catalog_search_round_two_highs.sql",
  ]) {
    assert.doesNotMatch(read(file), /uuid,integer,text,text\[\]\)/, file);
    assert.doesNotMatch(read(file), /uuid,integer,text\[\]\)/, file);
  }
});

test("onboarding-M5: search_dishes needs every requested dietary flag", () => {
  const sql = read(SEARCH_DISHES);
  assert.match(sql, /create or replace function public\.search_dishes\(/);
  assert.doesNotMatch(sql, /d\.availability_flags && params\.dietary_flags/);
  assert.doesNotMatch(sql, /v\.dietary_tags && params\.dietary_flags/);
  assert.match(sql, /requested\.flag = any\(coalesce\(d\.availability_flags/);
  assert.match(sql, /requested\.flag = any\(coalesce\(v\.dietary_tags/);
  // Same function as before: invoker, stable, same search_path, no grant changes.
  assert.match(sql, /security invoker/);
  assert.match(sql, /set search_path = public, extensions/);
  assert.doesNotMatch(sql, /\bgrant\b|\brevoke\b/);
});

test("M10: catalog_suggest falls back to similar food types", () => {
  const sql = read(SUGGEST);
  assert.match(sql, /c\.food_type % v_prefix/);
  assert.match(sql, /security definer/);
  assert.match(
    sql,
    /grant execute on function public\.catalog_suggest\(text, integer\) to anon, authenticated;/,
  );
});

test("the new migrations are paired with a rolled-back smoke file", () => {
  assert.ok(existsSync(path.join(root, SMOKE)));
  const smoke = read(SMOKE);
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;\s*$/m);
  for (const migration of ["20261022020100", "20261022020200", "20261022020300"]) {
    assert.ok(smoke.includes(migration), migration);
  }
});

test("M2/M3/M5/M6/M10/L8/L10/L12: the results grid", () => {
  const grid = read("src/app/screens/search/SearchResultsScreen.tsx");
  // M2: stale results are dimmed with a progress indicator and the list returns to the top.
  assert.match(grid, /const isRefreshing = isLoading && items\.length > 0/);
  assert.match(grid, /opacity: isRefreshing \? 0\.45 : 1/);
  assert.match(grid, /listRef\.current\?\.scrollToOffset\(\{ offset: 0, animated: false \}\)/);
  // M3: chips combine (in the Filters sheet, where the selected ones also show in the header),
  // with a sort sheet and a count line.
  assert.match(
    grid,
    /selectedIds=\{filters\.length \? filters : foodTypes\.length \? \[\] : \[BROWSE_ALL_FILTER\]\}/,
  );
  assert.match(grid, /accessibilityLabel=\{`Remove \$\{filter\} filter`\}/);
  assert.match(grid, /accessibilityLabel=\{`Sort by, \$\{sortLabel\}`\}/);
  assert.match(grid, /describeResultsSummary\(\{\s*count: matchCount,\s*mode,/);
  // M5/M6: card line, rating pill, full spoken label, result announcement.
  assert.match(grid, /cardSubtitle\(mode, item\)/);
  assert.match(grid, /ratingPillText\(dish\.rating, dish\.reviewCount\)/);
  assert.match(grid, /accessibilityLabel=\{cardAccessibilityLabel\(mode, item\)\}/);
  assert.match(
    grid,
    /AccessibilityInfo\.announceForAccessibility\(describeMatchCount\(count, mode\)\)/,
  );
  assert.doesNotMatch(grid, /accessibilityLabel=\{`Open \$\{title\}`\}/);
  assert.doesNotMatch(grid, /Menu details available/);
  // M7: chain outlets merge for stalls.
  assert.match(grid, /mergeStallOutlets\(items as CatalogRawVenueCard\[\]\)/);
  assert.match(grid, /\+\$\{outlets\} \$\{outlets === 1 \? "outlet" : "outlets"\}/);
  // M10: ways forward from an empty result.
  assert.match(grid, /label="Clear filters"/);
  assert.match(grid, /label="Search all Singapore"/);
  assert.match(grid, /Did you mean "\$\{suggestedQuery\}"\?/);
  // L8: the field can grow with the system font size, and takes at most 80 characters.
  assert.match(grid, /minHeight: 48/);
  assert.doesNotMatch(grid, /height: 48/);
  assert.match(grid, /maxLength=\{CATALOG_QUERY_MAX_CHARS\}/);
  // L10: the location-off note offers to turn location on (there is no area picker).
  assert.doesNotMatch(grid, /ManualLocationPicker/);
  assert.match(grid, /Turn on location/);
  // L12: one stable press handler; the live query is read from a ref when a card is tapped.
  assert.match(grid, /onOpen=\{handleOpen\}/);
  assert.match(grid, /queryRef\.current \|\| undefined/);
  assert.doesNotMatch(grid, /onPress=\{\(\) => \{\s*navigation\.navigate\("CatalogRawDetail"/);
  // L4/L9: no v1-only prop, clearer loading text, one verification badge.
  assert.doesNotMatch(grid, /estimatedItemSize|@ts-ignore/);
  assert.match(grid, /Finding dishes/);
  assert.doesNotMatch(grid, /Preparing dishes|Source verified/);
  // M9: the Halal chip says where the tag comes from.
  assert.match(grid, /not all MUIS-certified/);
  // L5: the search can be shared.
  assert.match(grid, /accessibilityLabel="Share this search"/);
  assert.match(grid, /buildSearchShareUrl\(\{ query: typedQuery, filters, mode, place, sort \}\)/);
});

test("M8: one search event for guests and members; zero results only for submitted queries", () => {
  const grid = read("src/app/screens/search/SearchResultsScreen.tsx");
  // The initial query is recorded for everyone (the taste signal alone needs a session).
  assert.match(grid, /recordTaste: isAuthenticated && !fromDiscoverChip/);
  assert.doesNotMatch(grid, /if \(!isAuthenticated \|\| initialQueryRecordedRef/);
  assert.equal(grid.match(/trackAnalyticsEvent\("search_query"/g)?.length, 1);
  assert.equal(grid.match(/trackAnalyticsEvent\("search_zero_results"/g)?.length, 1);
  // Zero results need a committed query that equals what is on screen, once per request.
  assert.match(grid, /committedQuery\.toLowerCase\(\) !== query\.toLowerCase\(\)/);
  assert.match(grid, /loggedZeroKeyRef\.current === requestKey/);
  // SEARCH-8: the text only when search history is allowed.
  assert.match(
    grid,
    /allowSearchHistory \? \{ query: committedQuery\.slice\(0, CATALOG_QUERY_MAX_CHARS\) \}/,
  );
  // The Halal chip is reported as "dietary".
  assert.match(grid, /filter === "Halal" \? "dietary" : filter/);
  assert.doesNotMatch(read("src/store/useSearchStore.ts"), /search_submitted/);
});

test("L6/L7: recents come from submitted queries, and a Discover chip logs only once", () => {
  const grid = read("src/app/screens/search/SearchResultsScreen.tsx");
  const home = read("src/app/screens/search/DishSearchScreen.tsx");
  const discover = read("src/app/screens/discover/DiscoverHomeScreen.tsx");
  const types = read("src/app/navigation/navigationTypes.ts");
  assert.match(grid, /if \(options\.remember\) rememberSearch\(committed\)/);
  assert.match(grid, /remember: !fromDiscoverChip/);
  assert.match(discover, /source: "discover_chip"/);
  assert.doesNotMatch(discover, /rememberSearch/);
  assert.match(types, /source\?:\s*\| "discover_chip"/);
  // Search home never saves recents on its own; a place is not saved as a text recent either
  // (SEARCH-X4: tapping it would run a name search). Each recent has a remove button.
  assert.equal(home.match(/rememberSearch\(/g), null);
  assert.match(home, /removeRecentSearch\(query\)/);
  assert.match(home, /accessibilityLabel=\{`Remove \$\{query\} from recent searches`\}/);
});

test("L9/SR4-22: Search home has one browse-near-me action, the Near me chip", () => {
  const home = read("src/app/screens/search/DishSearchScreen.tsx");
  assert.match(home, /label: "Near me"/);
  assert.doesNotMatch(home, /Browse dishes near you|View search results/);
});

test("L3: dead search state is removed and the persisted version bumped", () => {
  const store = read("src/store/useSearchStore.ts");
  assert.doesNotMatch(
    store,
    /toggleCategory|toggleDietary|addHistoryEntry|removeHistoryEntry|clearHistory\b/,
  );
  assert.doesNotMatch(store, /filters:|history:/);
  assert.match(store, /version: 2/);
  assert.match(store, /migrate:/);
  assert.match(store, /name: "hungry-search-v1"/, "recent searches survive the upgrade");
  assert.doesNotMatch(read("src/features/search/search.ts"), /groupResultsByVenue/);
});

test("L11: the results and browse routes use the default push", () => {
  const navigator = read("src/app/navigation/RootNavigator.tsx");
  for (const name of ["SearchResults", "BrowseDishes", "BrowseStalls"]) {
    assert.match(navigator, new RegExp(`name="${name}" />`), name);
  }
});

test("L1: the search sanitiser no longer deletes SQL words", () => {
  const source = read("src/lib/security/inputSanitization.ts");
  assert.doesNotMatch(source, /SQL_META_REGEX/);
});

test("SR4 re-audit: Search home fits a 320 screen and a failed featured photo shows a tile", () => {
  const source = read("src/app/screens/search/DishSearchScreen.tsx");
  // A web <input> keeps its default width unless it may shrink; at 320 it pushed the page 21pt sideways.
  assert.match(source, /<View style=\{\{ flex: 1, minWidth: 0 \}\}>\s*<Input/);
  assert.match(source, /style=\{\{ minWidth: 0 \}\}/);
  assert.match(source, /fallback=\{<FeaturedDishPlaceholder \/>\}/);
});
