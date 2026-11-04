import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

test("detail screens hydrate specific Supabase records before showing not-found states", () => {
  const dishDetailV2 = read("src/app/screens/detail/DishDetailScreenV2.tsx");
  const stallDetail = read("src/app/screens/detail/StallDetailScreen.tsx");

  assert.match(dishDetailV2, /discovery\.getDish\(dishId\)/);
  assert.match(dishDetailV2, /discovery\.getVenue\(readVenueId\)/);
  assert.match(dishDetailV2, /accessibilityLabel=\{`Open \$\{venueName\} stall details`\}/);
  assert.match(dishDetailV2, /openStallFromDish\(navigation, dish\.venueId\)/);
  assert.match(dishDetailV2, /!dish && !hasLoadedDishDetail/);
  // The dish renders as soon as it loads; the stall read fills in its own sections (detail-M16).
  assert.doesNotMatch(dishDetailV2, /hasLoadedVenueDetail/);

  assert.match(stallDetail, /discovery\.getVenue\(venueId\)/);
  assert.match(stallDetail, /discovery\.listDishesByVenue\(venue\.id\)/);
  assert.match(stallDetail, /venue\?\.buildingName \?\? building\?\.name/);
  // Header: "Centre · unit · distance"; the full address is only in the Address card.
  assert.match(
    stallDetail,
    /\[buildingLocation\.name, venue\.unitNumber\?\.trim\(\), distanceLabel\]/,
  );
  // The subtitle names centre and unit; the Address row only adds street and postcode (R5-STALL-6).
  assert.match(stallDetail, /const streetAddress = \[/);
  assert.match(stallDetail, /const EMPTY_DISHES: DishDetail\[\] = \[\]/);
  assert.match(stallDetail, /serviceProviderMode === "supabase" \? EMPTY_DISHES : cachedDishes/);
  assert.match(stallDetail, /!venue && !hasLoadedVenueDetail/);

  const supabaseRepository = read("src/lib/services/supabase/supabaseRepository.ts");
  const domainTypes = read("src/types/domain.ts");
  assert.match(domainTypes, /buildingName\?: string/);
  assert.match(domainTypes, /address\?: string/);
  assert.match(domainTypes, /postalCode\?: string/);
  assert.match(supabaseRepository, /const building = toRecord\(row\.building\)/);
  assert.match(
    supabaseRepository,
    /buildingName: toString\(row\.building_name, toString\(building\.name\)\)/,
  );
});
