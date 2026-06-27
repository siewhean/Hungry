import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const menuPriorityMigration = readRepoFile(
  "supabase/migrations/20260627223000_menu_priority_search_discovery.sql",
);

const menuPriorityIndexableFixMigration = readRepoFile(
  "supabase/migrations/20260627232500_menu_priority_discovery_candidate_prefilter.sql",
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

test("Search remains menu-backed instead of surfacing unapproved menu rows", () => {
  const finalFilter =
    /where\s+public\.catalog_menu_is_displayable\(\s*d\.menu_approved_for_display,\s*d\.menu_rights_status,\s*d\.menu_source_url\s*\)[\s\S]*order\s+by\s+limited\.rank_score\s+desc/i;
  assert.match(searchMigration, finalFilter);
  assert.doesNotMatch(
    searchMigration,
    /from\s+dishes\s+d[\s\S]{0,200}where\s+params\.query\s+is\s+not\s+null(?![\s\S]{0,500}catalog_menu_is_displayable)/i,
  );
});
