import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const map = readRepoFile("src/app/screens/discover/HomeMapScreen.tsx");

test("H14: map pins, cards and list rows open the full stall page", () => {
  assert.doesNotMatch(map, /navigate\("CatalogRawDetail"/);
  // One opener, used by both card layouts and by a pin whose card is already selected.
  assert.equal(map.match(/navigation\.navigate\("StallDetail", \{ venueId \}\)/g)?.length, 1);
  // Cards and rows go through openCard (which counts the open), a pin through openStall itself.
  assert.equal(map.match(/openStall\((item\.id|venueId)\)/g)?.length, 2);
  assert.equal(map.match(/openCard\(venue\.id, index\)/g)?.length, 2);
});

test("H15: raw catalog publish and refresh apply the Discover display-rights rule", () => {
  const migration = readRepoFile(
    "supabase/migrations/20261021140000_catalog_raw_display_rights.sql",
  );
  for (const name of ["catalog_raw_publish_release", "catalog_raw_refresh_venue"]) {
    const block =
      new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`).exec(
        migration,
      )?.[0] ?? "";
    assert.ok(block, `${name} should be redefined`);
    assert.match(block, /security definer/);
    // Venue photo, dish photo, gallery photos and menu rows all pass the helpers.
    assert.match(block, /catalog_display_image_url\(v\.image_url, v\.media_approved_for_display/);
    assert.match(block, /catalog_display_image_url\(di\.url, di\.media_approved_for_display/);
    assert.match(block, /catalog_menu_is_displayable\(d\.menu_approved_for_display/);
    assert.match(block, /where media\.display_url is not null/);
    assert.doesNotMatch(block, /coalesce\(d\.image_url, primary_media\.url\)/);
    assert.doesNotMatch(block, /\bv\.operating_hours, v\.image_url,/);
  }
  // Rows already published are scrubbed too.
  assert.match(
    migration,
    /delete from public\.catalog_raw_dish_media m[\s\S]*catalog_display_image_url\(m\.url/,
  );
  assert.match(migration, /update public\.catalog_raw_venue_cards vc/);

  const smoke = readRepoFile("supabase/smoke/catalog_raw_display_rights.sql");
  assert.match(smoke, /set local role anon;/);
  assert.match(smoke, /guest read returned an unapproved photo/);
  assert.match(smoke, /guest read returned a non-displayable menu item/);
  assert.match(
    smoke,
    /select 'catalog_raw_display_rights_smoke_passed' as result;\s*rollback;\s*$/,
  );

  const detail = readRepoFile("src/app/screens/catalog/CatalogRawDetailScreen.tsx");
  assert.match(detail, /\.filter\(\(media\) => media\.approvedForDisplay\)/);
});

test("H16: the Discover feed returns and maps the top dish's dietary flags", () => {
  const migration = readRepoFile(
    "supabase/migrations/20261021140100_discovery_feed_top_dish_dietary_flags.sql",
  );
  assert.match(migration, /drop function if exists public\.get_discovery_feed_by_location\(/);
  assert.match(migration, /top_dish_dietary_flags text\[\],/);
  assert.match(migration, /where ddf\.dish_id = top_dish\.id/);
  assert.match(migration, /security invoker/);
  assert.match(
    migration,
    /grant execute on function public\.get_discovery_feed_by_location\([\s\S]*?\) to anon, authenticated;/,
  );
  const repository = readRepoFile("src/lib/services/supabase/supabaseRepository.ts");
  assert.match(
    repository,
    /dietaryFlags: toStringArray\(row\.top_dish_dietary_flags\) as DietaryFlag\[\]/,
  );
  assert.doesNotMatch(repository, /\{ gallery, dietaryFlags: \[\] \}/);
});

test("H17: Near me needs a GPS fix and turns off when the map is panned away", () => {
  assert.match(
    map,
    /const canUseNearMe = locationPermission === "granted" && !isLocationApproximate;/,
  );
  assert.match(
    map,
    /calculateDistanceMeters\(mapCenter, currentLocation\) <= NEAR_ME_PAN_TOLERANCE_METERS/,
  );
  assert.match(map, /if \(mapFilters\.nearMe && !nearMeActive\) toggleMapFilter\("nearMe"\);/);
  assert.match(map, /const nearCoordinate = nearMeActive \? currentLocation : undefined;/);
  assert.doesNotMatch(map, /mapFilters\.nearMe \? currentLocation/);
  const store = readRepoFile("src/store/useDiscoveryStore.ts");
  assert.match(store, /nearMe: false,/);
});

test("H18/H19: Decide for Me picks from the server and prefers open stalls", () => {
  const decide = readRepoFile("src/app/screens/discover/DecideForMeResultScreen.tsx");
  assert.match(decide, /service\.discovery\.searchDishes\(/);
  assert.doesNotMatch(decide, /repository\.searchDishes\(/);
  assert.match(decide, /preferOpenStalls\(ranked, venueCache\)/);
  assert.match(
    decide,
    /const hasNoMatch =\s*!isLocationApproximate &&\s*!isLoadingCandidates &&\s*!loadFailed &&\s*answerResult\.dishes\.length === 0 &&\s*!selectedDish;/,
  );
  assert.match(decide, /if \(!dish && isLoadingCandidates\)/);
  assert.match(decide, /<Badge\s+label=\{openLabel\}/);
});
