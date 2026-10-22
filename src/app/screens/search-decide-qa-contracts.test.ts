import test from "node:test";

import { assertSourceExcludes, assertSourceIncludes, readRepoFile } from "@/test/sourceContracts";

test("Decide for me measures its radius from the user's location", () => {
  const screen = readRepoFile("src/app/screens/discover/DecideForMeResultScreen.tsx");
  const repository = readRepoFile("src/lib/services/supabase/supabaseRepository.ts");

  assertSourceIncludes(
    screen,
    [
      /const currentLocation = useLocationStore\(\(state\) => state\.currentLocation\)/,
      /latitude: location\.latitude,\s*longitude: location\.longitude,/,
      /getEffectiveLocation\(\{ permission: locationPermission, currentLocation, manualCoordinate \}\)/,
      /searchRadius,\s*\{ latitude: locationLatitude, longitude: locationLongitude \},\s*profile\.maxDishBudget,/,
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
