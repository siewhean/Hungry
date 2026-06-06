import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260606120000_database_excel_integration_foundation.sql"),
  "utf8",
);

const smokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/database_excel_integration.sql"),
  "utf8",
);

const validateScript = readFileSync(
  resolve(process.cwd(), "scripts/validate_excel_workbook.py"),
  "utf8",
);

const importScript = readFileSync(
  resolve(process.cwd(), "scripts/import_excel_to_supabase.py"),
  "utf8",
);

const packageJson = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
const envExample = readFileSync(resolve(process.cwd(), ".env.example"), "utf8");
const repositorySource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseRepository.ts"),
  "utf8",
);
const serviceSource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseService.ts"),
  "utf8",
);
const discoverSource = readFileSync(
  resolve(process.cwd(), "src/app/screens/discover/DiscoverHomeScreen.tsx"),
  "utf8",
);

const requiredColumns = [
  "buildings.address",
  "buildings.postal_code",
  "buildings.planning_area",
  "venues.cuisine_tags",
  "venues.dietary_tags",
  "venues.location",
  "venues.google_place_id",
  "dishes.cuisine_tags",
  "dishes.is_featured",
  "staging_food_businesses.google_place_id",
  "staging_food_businesses.menu_items_text",
] as const;

const requiredIndexes = [
  "idx_buildings_planning_area",
  "idx_venues_planning_area_open",
  "idx_venues_cuisine_tags",
  "idx_venues_google_place_id",
  "idx_staging_food_businesses_google_place_id",
  "idx_areas_name_normalized",
  "idx_venue_images_venue_order",
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("database Excel foundation migration extends catalog and staging tables safely", () => {
  for (const column of requiredColumns) {
    const [table, name] = column.split(".");
    assert.match(
      migrationSql,
      new RegExp(`alter\\s+table\\s+${escapeRegExp(table)}[\\s\\S]*?add\\s+column\\s+if\\s+not\\s+exists\\s+${escapeRegExp(name)}\\b`, "i"),
      `${column} should be added with if-not-exists`,
    );
  }

  assert.match(migrationSql, /create\s+table\s+if\s+not\s+exists\s+areas\b/i);
  assert.match(migrationSql, /create\s+table\s+if\s+not\s+exists\s+venue_images\b/i);
  assert.match(migrationSql, /source_type\s+in\s+\([\s\S]*'spreadsheet'/i);
  assert.match(migrationSql, /building_type\s+in\s+\([\s\S]*'mall'[\s\S]*'chain_outlet'/i);
  for (const areaName of ["Jurong East", "Pioneer", "Tampines"]) {
    assert.match(migrationSql, new RegExp(escapeRegExp(areaName), "i"));
  }
  assert.match(migrationSql, /create\s+extension\s+if\s+not\s+exists\s+pg_trgm/i);

  for (const indexName of requiredIndexes) {
    assert.match(
      migrationSql,
      new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${escapeRegExp(indexName)}\\b`, "i"),
      `${indexName} should exist`,
    );
  }

  assert.doesNotMatch(migrationSql, /\bdrop\s+table\b/i);
  assert.doesNotMatch(migrationSql, /\btruncate\s+table\b/i);
  assert.doesNotMatch(
    migrationSql,
    /\balter\s+table\s+(buildings|venues|dishes|reviews|posts)[\s\S]{0,220}\b(alter\s+column\s+id|rename\s+column|drop\s+column|rename\s+to)\b/i,
  );
});

test("new public read tables use RLS and restricted writes", () => {
  for (const tableName of ["areas", "venue_images"]) {
    assert.match(
      migrationSql,
      new RegExp(`alter\\s+table\\s+${tableName}\\s+enable\\s+row\\s+level\\s+security`, "i"),
      `${tableName} should enable RLS`,
    );
  }

  assert.match(migrationSql, /create\s+policy\s+"public_select_areas"[\s\S]*for\s+select\s+to\s+anon,\s+authenticated\s+using\s+\(true\)/i);
  assert.match(migrationSql, /create\s+policy\s+"areas_service_role_all"[\s\S]*for\s+all\s+to\s+service_role/i);
  assert.match(migrationSql, /create\s+policy\s+"public_select_venue_images"[\s\S]*for\s+select\s+to\s+anon,\s+authenticated\s+using\s+\(true\)/i);
  assert.match(migrationSql, /create\s+policy\s+"venue_images_service_role_all"[\s\S]*for\s+all\s+to\s+service_role/i);
});

test("location RPCs support named areas and live discovery feed without definer privileges", () => {
  for (const functionName of [
    "search_dishes",
    "get_discovery_feed_by_location",
    "search_venues_by_location",
  ]) {
    const block = new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}[\\s\\S]*?\\$\\$;`,
      "i",
    ).exec(migrationSql)?.[0];
    assert.ok(block, `${functionName} body should be present`);
    assert.match(block, /security\s+invoker/i);
    assert.doesNotMatch(block, /security\s+definer/i);
    assert.match(block, /set\s+search_path\s+=\s+public,\s*extensions/i);
  }

  assert.match(migrationSql, /p_area_name\s+text\s+default\s+null/i);
  assert.match(migrationSql, /p_cuisine_tags\s+text\[\]\s+default\s+null/i);
  assert.match(migrationSql, /p_max_price\s+numeric\s+default\s+null/i);
  assert.match(migrationSql, /p_open_only\s+boolean\s+default\s+false/i);
  assert.match(migrationSql, /grant\s+execute\s+on\s+function\s+public\.get_discovery_feed_by_location[\s\S]*to\s+anon,\s+authenticated/i);
  assert.match(migrationSql, /grant\s+execute\s+on\s+function\s+public\.search_venues_by_location[\s\S]*to\s+anon,\s+authenticated/i);
});

test("Excel scripts are staging-only, schema-aware, and service-role guarded", () => {
  assert.match(validateScript, /EXPECTED_COLUMNS\s*=\s*\[/);
  assert.match(validateScript, /"Google Place ID"/);
  assert.match(validateScript, /"Menu Items"/);
  assert.match(validateScript, /missing_stall_name/);
  assert.match(validateScript, /invalid_latitude/);

  assert.match(importScript, /SOURCE_SLUG\s*=\s*"hungry_fnb_excel_workbook"/);
  assert.match(importScript, /STAGING_COLUMNS\s*=\s*\[/);
  assert.match(importScript, /staging_food_businesses/);
  assert.match(importScript, /staging_import_errors/);
  assert.match(importScript, /HUNGRY_ALLOW_SERVICE_ROLE_IMPORT/);
  assert.match(importScript, /HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY/);
  assert.match(importScript, /"status":\s+"running"/);
  assert.match(importScript, /"status":\s+"failed"/);
  assert.match(importScript, /"status":\s+"completed"/);
  assert.match(importScript, /if\s+any\(item\["severity"\]\s+==\s+"error"/);
  assert.doesNotMatch(importScript, /insert\s+into\s+(buildings|venues|dishes)\b/i);
});

test("repo wiring exposes validation, import, smoke checks, and app discovery RPCs", () => {
  for (const scriptName of [
    "data:excel:validate",
    "data:excel:import",
    "smoke:database:location",
    "smoke:database:search",
    "smoke:database:rls",
  ]) {
    assert.match(packageJson, new RegExp(`"${escapeRegExp(scriptName)}"`), `${scriptName} missing`);
  }

  for (const envName of [
    "HUNGRY_SUPABASE_IMPORT_URL",
    "HUNGRY_SUPABASE_IMPORT_PROJECT_REF",
    "HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY",
    "HUNGRY_ALLOW_SERVICE_ROLE_IMPORT",
  ]) {
    assert.match(envExample, new RegExp(`^${envName}=`, "m"), `${envName} missing`);
  }

  assert.match(repositorySource, /export\s+async\s+function\s+listDiscoveryFeedByLocationViaRpc/i);
  assert.match(repositorySource, /rpcRows\("get_discovery_feed_by_location"/);
  assert.match(repositorySource, /export\s+async\s+function\s+searchVenuesByLocationViaRpc/i);
  assert.match(repositorySource, /rpcRows\("search_venues_by_location"/);
  assert.match(serviceSource, /async\s+listDiscoveryFeedByLocation\(request\)/);
  assert.match(serviceSource, /async\s+searchVenuesByLocation\(request\)/);
  assert.match(discoverSource, /listDiscoveryFeedByLocation\(\{/);
  assert.match(discoverSource, /supabaseDiscoveryFeed\?\.venues/);
});

test("database Excel smoke SQL checks the live contract", () => {
  for (const token of [
    "missing_database_excel_columns",
    "missing_database_excel_tables",
    "missing_database_excel_functions",
    "database_excel_integration_smoke_passed",
  ]) {
    assert.match(smokeSql, new RegExp(escapeRegExp(token)));
  }
  assert.match(smokeSql, /raise\s+exception\s+'database_excel_integration_smoke_failed/i);
  assert.match(smokeSql, /has_function_privilege/);
});
