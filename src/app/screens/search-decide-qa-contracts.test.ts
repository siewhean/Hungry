import test from "node:test";

import { assertSourceExcludes, assertSourceIncludes, readRepoFile } from "@/test/sourceContracts";

test("search result rows show the stall name so identical dishes can be told apart", () => {
  const view = readRepoFile("src/components/discover/SearchResultsView.tsx");

  assertSourceIncludes(
    view,
    [
      /\{dish\.venueName \? \(\s*<AppText variant="bodySmall" tone="secondary" numberOfLines=\{1\}>\s*\{dish\.venueName\}/,
      /`Open \$\{dish\.name\} from \$\{dish\.venueName\}`/,
    ],
    "SearchResultsView row",
  );
});

test("legacy search results render the title in the search view header slot", () => {
  const screen = readRepoFile("src/app/screens/search/SearchResultsScreen.tsx");
  const view = readRepoFile("src/components/discover/SearchResultsView.tsx");

  assertSourceIncludes(
    screen,
    [/<Screen scroll=\{false\} fullWidth>\s*<SearchResultsView\s+header=\{\s*<AppHeader/],
    "LegacySearchResultsScreen",
  );
  assertSourceExcludes(
    screen,
    [/<Screen scroll=\{false\}>\s*<AppHeader/],
    "LegacySearchResultsScreen",
  );
  assertSourceIncludes(
    view,
    [
      /header\?: ReactNode;/,
      /\{header \? <View style=\{\{ paddingHorizontal: spacing\[4\] \}\}>\{header\}<\/View> : null\}/,
    ],
    "SearchResultsView header slot",
  );
});

test("Decide for me measures its radius from the user's location", () => {
  const screen = readRepoFile("src/app/screens/discover/DecideForMeResultScreen.tsx");
  const repository = readRepoFile("src/lib/services/supabase/supabaseRepository.ts");

  assertSourceIncludes(
    screen,
    [
      /const currentLocation = useLocationStore\(\(state\) => state\.currentLocation\)/,
      /latitude: location\.latitude,\s*longitude: location\.longitude,/,
      /searchRadius,\s*currentLocation,\s*profile\.maxDishBudget,/,
    ],
    "DecideForMeResultScreen candidates",
  );
  assertSourceIncludes(
    repository,
    [
      /import \{ getDistanceMetersFromBuildingId \} from "@\/lib\/geo\/distance"/,
      /typeof filters\.latitude === "number" && typeof filters\.longitude === "number"/,
      /const matched = locatedDishes\.filter\(/,
    ],
    "supabaseRepository.searchDishes",
  );
});

test("Decide for me shows the stall name even when the venue is not cached", () => {
  const screen = readRepoFile("src/app/screens/discover/DecideForMeResultScreen.tsx");

  assertSourceIncludes(
    screen,
    [
      /\.discovery\.getVenue\(dishVenueId\)/,
      /const stallLine = \[venue\?\.name \|\| dish\.venueName, venue\?\.unitNumber \|\| dish\.unitNumber\]/,
      /\{stallLine \? \(/,
    ],
    "DecideForMeResultScreen stall line",
  );
  assertSourceExcludes(
    screen,
    [/\{venue\?\.name\} · \{venue\?\.unitNumber\}/],
    "DecideForMeResultScreen stall line",
  );
});
