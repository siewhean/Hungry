import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { readHomeSource } from "@/test/sourceContracts";

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const MIGRATION = "supabase/migrations/20261021190000_catalog_places_and_place_scoped_reads.sql";

test("place migration: page RPCs filter on one building and drop the old signatures", () => {
  const sql = read(MIGRATION);
  assert.equal(
    sql.match(/and \(p_building_id is null or c\.building_id = p_building_id\)/g)?.length,
    2,
  );
  // The id is part of the cursor fingerprint, so a cursor cannot cross scopes.
  assert.equal(sql.match(/coalesce\(p_building_id, ''\)/g)?.length, 2);
  assert.match(sql, /drop function if exists public\.catalog_raw_dishes_page\(/);
  assert.match(sql, /drop function if exists public\.catalog_raw_venues_page\(/);
  assert.match(sql, /drop function if exists public\.get_discovery_feed_by_location\(/);
  assert.match(
    sql,
    /grant execute on function public\.catalog_raw_places\([^)]*\) to anon, authenticated;/,
  );
});

test("place migration: a place is a building with 3+ stalls whatever its type", () => {
  const sql = read(MIGRATION);
  assert.equal(sql.match(/having count\(\*\) >= 3/g)?.length, 2, "places RPC and suggestions");
  assert.doesNotMatch(sql, /building_type in \(/);
});

test("place migration: the Discover feed puts the viewer's building first, capped at 60", () => {
  const sql = read(MIGRATION);
  assert.match(sql, /p_building_id text default null\n\)/);
  assert.match(sql, /coalesce\(filtered\.building_id = p_building_id, false\) desc/);
  assert.match(sql, /candidates\.place_rank <= 60\) desc/);
  assert.match(sql, /security invoker/);
});

test("catalog client sends p_building_id only for a place", () => {
  const service = read("src/lib/services/catalog/index.ts");
  assert.match(
    service,
    /\.\.\.\(request\.buildingId \? \{ p_building_id: request\.buildingId \} : \{\}\)/,
  );
  assert.match(service, /callRawRpc<unknown>\("catalog_raw_places"/);
  const repository = read("src/lib/services/supabase/supabaseRepository.ts");
  assert.match(
    repository,
    /request\.buildingId \? \{ p_building_id: request\.buildingId \} : \{\}/,
  );
});

test("place suggestions open the stalls of that building, not a fuzzy text search", () => {
  const search = read("src/app/screens/search/DishSearchScreen.tsx");
  assert.match(search, /suggestion\.kind === "place" && suggestion\.placeId/);
  assert.match(search, /placeId: suggestion\.placeId/);
  const results = read("src/app/screens/search/SearchResultsScreen.tsx");
  assert.match(results, /buildingId: place\?\.id/);
  assert.match(results, /\.listPlaces\(\{ query, coordinate, limit: 3 \}\)/);
});

test("Discover names the mall the phone is inside and lists its stalls first", () => {
  const discover = readHomeSource();
  // Only a real GPS fix counts; a picked area is never "inside" a place.
  assert.match(discover, /locationPermission === "granted" && !manualCoordinate/);
  assert.match(discover, /\{discoverHeaderLabel\}/);
  assert.match(discover, /buildingId: currentPlaceId/);
  assert.match(discover, /preferBuildingId: currentPlaceId/);
  assert.match(discover, /Number\(isInCurrentPlace\(b\)\) - Number\(isInCurrentPlace\(a\)\)/);
  // Only a manual area pick drives the feed query by area name; the header only changes label.
  assert.match(discover, /areaName: discoverAreaRequest/);
});
