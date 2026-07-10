import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const menuPriorityMigration = readRepoFile(
  "supabase/migrations/20260627223000_menu_priority_search_discovery.sql",
);

const menuPriorityIndexableFixMigration = readRepoFile(
  "supabase/migrations/20260627232500_menu_priority_discovery_candidate_prefilter.sql",
);

const discoveryImagePriorityMigration = readRepoFile(
  "supabase/migrations/20260628001000_discovery_image_priority.sql",
);

const discoveryVenueLogoMigration = readRepoFile(
  "supabase/migrations/20260628070000_discovery_feed_venue_logo.sql",
);

const searchMigration = readRepoFile(
  "supabase/migrations/20260621114541_search_dishes_restore_fast_guarded.sql",
);

test("Discovery feed prioritises stalls with approved priced menu coverage", () => {
  assert.match(
    menuPriorityMigration,
    /create\s+or\s+replace\s+function\s+public\.catalog_venue_menu_priority_score/i,
  );
  assert.match(menuPriorityIndexableFixMigration, /candidate_venues\s+as\s+materialized/i);
  assert.match(menuPriorityIndexableFixMigration, /priced_menu_venues\s+as\s+materialized/i);
  assert.match(
    menuPriorityIndexableFixMigration,
    /join\s+priced_menu_venues\s+pmv\s+on\s+pmv\.venue_id\s*=\s*v\.id/i,
  );
  assert.match(menuPriorityIndexableFixMigration, /union\s+all/i);
  assert.match(menuPriorityIndexableFixMigration, /limit\s+500/i);
  assert.match(menuPriorityIndexableFixMigration, /d\.price\s*>\s*0/i);
  assert.match(
    menuPriorityIndexableFixMigration,
    /catalog_menu_is_displayable\(\s*d\.menu_approved_for_display,\s*d\.menu_rights_status,\s*d\.menu_source_url\s*\)/i,
  );
  assert.match(
    menuPriorityIndexableFixMigration,
    /public\.catalog_venue_menu_priority_score\(\s*cv\.id,\s*cv\.venue_menu_approved_for_display,\s*cv\.venue_menu_rights_status,\s*cv\.venue_menu_source_url\s*\)/i,
  );
  assert.match(
    menuPriorityIndexableFixMigration,
    /where\s+d\.venue_id\s*=\s*cv\.id\s+and\s+d\.price\s*>\s*0\s+and\s+public\.catalog_menu_is_displayable/i,
  );
  assert.match(menuPriorityIndexableFixMigration, /order\s+by\s+candidates\.rank_score\s+desc/i);
});

test("Discovery feed prioritises image-backed dishes and rows when approved images exist", () => {
  assert.match(
    discoveryImagePriorityMigration,
    /exists\s*\([\s\S]*from\s+dish_images\s+di[\s\S]*catalog_display_image_url\([\s\S]*di\.url[\s\S]*\)\s+is\s+not\s+null[\s\S]*\)\s+desc/i,
  );
  assert.match(
    discoveryImagePriorityMigration,
    /catalog_display_image_url\(\s*d\.image_url,[\s\S]*d\.media_approved_for_display,[\s\S]*d\.media_rights_status,[\s\S]*d\.media_source_url[\s\S]*\)\s+is\s+not\s+null\)\s+desc/i,
  );
  assert.match(
    discoveryImagePriorityMigration,
    /where\s+di\.dish_id\s*=\s*top_dish\.id[\s\S]*catalog_display_image_url\([\s\S]*di\.url[\s\S]*\)\s+is\s+not\s+null[\s\S]*order\s+by\s+di\.sort_order/i,
  );
  assert.match(
    discoveryImagePriorityMigration,
    /order\s+by\s+\(nullif\(trim\(candidates\.top_dish_image\),\s*''\)\s+is\s+not\s+null\)\s+desc,[\s\S]*candidates\.rank_score\s+desc/i,
  );
});

test("Discovery feed exposes venue logo separately from food imagery", () => {
  assert.match(
    discoveryVenueLogoMigration,
    /drop\s+function\s+if\s+exists\s+public\.get_discovery_feed_by_location/i,
  );
  assert.match(discoveryVenueLogoMigration, /returns\s+table\s*\([\s\S]*venue_logo_url\s+text/i);
  assert.match(discoveryVenueLogoMigration, /v\.logo_url\s+as\s+venue_logo_url/i);
  assert.match(discoveryVenueLogoMigration, /candidates\.venue_logo_url/);
  assert.match(discoveryVenueLogoMigration, /top_dish_image\s+text/i);
  assert.match(
    discoveryVenueLogoMigration,
    /grant\s+execute\s+on\s+function\s+public\.get_discovery_feed_by_location[\s\S]*to\s+anon,\s+authenticated/i,
  );
  assert.doesNotMatch(
    discoveryVenueLogoMigration,
    /venue_logo_url\s+as\s+top_dish_image|top_dish_image\s+as\s+venue_logo_url/i,
  );
});

test("Search remains menu-backed instead of surfacing unapproved menu rows", () => {
  const finalFilter =
    /where\s+public\.catalog_menu_is_displayable\(\s*d\.menu_approved_for_display,\s*d\.menu_rights_status,\s*d\.menu_source_url\s*\)[\s\S]*order\s+by\s+limited\.rank_score\s+desc/i;
  assert.match(searchMigration, finalFilter);
  assert.doesNotMatch(
    searchMigration,
    /from\s+dishes\s+d[\s\S]{0,200}where\s+params\.query\s+is\s+not\s+null(?![\s\S]{0,500}catalog_menu_is_displayable)/i,
  );
});
