import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0028_data_import_provenance_foundation.sql"),
  "utf8",
);

const smokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/database_foundation.sql"),
  "utf8",
);

const newFoundationTables = [
  "external_sources",
  "import_runs",
  "staging_food_businesses",
  "staging_google_places_observations",
  "staging_menu_items",
  "staging_photos",
  "staging_import_errors",
  "external_place_refs",
  "venue_source_observations",
  "dish_source_observations",
  "photo_source_observations",
  "google_places_observations",
  "venue_aliases",
  "venue_merge_events",
  "data_quality_flags",
] as const;

const requiredIndexes = [
  "idx_import_runs_status_created",
  "idx_import_runs_source_created",
  "idx_staging_food_businesses_import_status",
  "idx_staging_food_businesses_source_row",
  "idx_staging_food_businesses_normalized_trgm",
  "idx_staging_google_places_google_place",
  "idx_staging_menu_items_import_status",
  "idx_staging_menu_items_normalized_trgm",
  "idx_staging_photos_import_status",
  "idx_staging_photos_source_reference",
  "idx_staging_import_errors_run_created",
  "external_place_refs_source_external_unique",
  "idx_external_place_refs_venue",
  "idx_venue_source_observations_venue_source",
  "idx_venue_source_observations_location",
  "idx_dish_source_observations_dish_source",
  "dish_source_observations_source_external_unique",
  "idx_photo_source_observations_venue",
  "photo_source_observations_source_external_unique",
  "idx_google_places_observations_place_fetched",
  "idx_google_places_observations_venue_fetched",
  "venue_aliases_venue_alias_source_unique",
  "idx_venue_aliases_normalized_trgm",
  "idx_venue_merge_events_surviving",
  "idx_data_quality_flags_status",
  "idx_data_quality_flags_entity",
] as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createTablePattern = (tableName: string) =>
  new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+${escapeRegExp(tableName)}\\s*\\(`, "i");

const rlsPattern = (tableName: string) =>
  new RegExp(
    `alter\\s+table\\s+${escapeRegExp(tableName)}\\s+enable\\s+row\\s+level\\s+security`,
    "i",
  );

const servicePolicyPattern = (tableName: string) => {
  const policyName = `${tableName}_service_role_all`;

  return new RegExp(
    `create\\s+policy\\s+"${escapeRegExp(policyName)}"[\\s\\S]*?on\\s+${escapeRegExp(
      tableName,
    )}\\s+for\\s+all\\s+to\\s+service_role[\\s\\S]*?using\\s*\\(true\\)[\\s\\S]*?with\\s+check\\s*\\(true\\)`,
    "i",
  );
};

test("0028 creates only the Phase 0-1 additive foundation tables", () => {
  for (const tableName of newFoundationTables) {
    assert.match(
      migrationSql,
      createTablePattern(tableName),
      `${tableName} should be created additively`,
    );
  }

  assert.doesNotMatch(migrationSql, /\bdrop\s+table\b/i, "migration must not drop tables");
  assert.doesNotMatch(migrationSql, /\btruncate\s+table\b/i, "migration must not truncate tables");
  assert.doesNotMatch(
    migrationSql,
    /\b(delete\s+from)\s+(buildings|venues|dishes|reviews|posts|merchant_accounts|user_profiles)\b/i,
    "migration must not delete existing production data",
  );
});

test("0028 keeps canonical app-facing IDs unchanged and referenced as text", () => {
  assert.doesNotMatch(
    migrationSql,
    /\balter\s+table\s+(buildings|venues|dishes|reviews|posts|merchant_accounts|user_profiles)[\s\S]{0,200}\b(alter\s+column\s+id|rename\s+column|drop\s+column|rename\s+to)\b/i,
    "migration must not mutate existing production table IDs or columns",
  );
  assert.doesNotMatch(
    migrationSql,
    /\b(venue_id|dish_id|building_id|candidate_venue_id|candidate_dish_id|candidate_building_id)\s+uuid\s+references\s+(venues|dishes|buildings)\(id\)/i,
    "new references to canonical fixture IDs must remain text, not UUID",
  );
  assert.match(migrationSql, /candidate_venue_id\s+text\s+references\s+venues\(id\)/i);
  assert.match(migrationSql, /candidate_dish_id\s+text\s+references\s+dishes\(id\)/i);
  assert.match(migrationSql, /candidate_building_id\s+text\s+references\s+buildings\(id\)/i);
});

test("0028 enables RLS and keeps raw import data service-role only", () => {
  for (const tableName of newFoundationTables) {
    assert.match(migrationSql, rlsPattern(tableName), `${tableName} should have RLS enabled`);
    assert.match(
      migrationSql,
      servicePolicyPattern(tableName),
      `${tableName} should have service-role manage policy`,
    );
  }

  assert.doesNotMatch(
    migrationSql,
    /\bto\s+(authenticated|anon)\b/i,
    "raw import/provenance/dedupe tables must not expose broad user policies",
  );
});

test("0028 includes queue, source, place, reference, and trigram indexes", () => {
  for (const indexName of requiredIndexes) {
    assert.match(
      migrationSql,
      new RegExp(
        `create\\s+(?:unique\\s+)?index\\s+if\\s+not\\s+exists\\s+${escapeRegExp(indexName)}\\b`,
        "i",
      ),
      `${indexName} should exist`,
    );
  }
});

test("0028 does not implement deferred server-side app features", () => {
  const deferredPatterns = [
    /\bcreate\s+(?:or\s+replace\s+)?function\s+public\./i,
    /\balter\s+publication\s+supabase_realtime\b/i,
    /\bstorage\.buckets\b/i,
    /\bcreate\s+table\s+if\s+not\s+exists\s+(user_feed_items|feed_items|merchant_organizations|menu_versions|media_assets|background_jobs|orders|payments|refunds|payouts)\b/i,
  ];

  for (const pattern of deferredPatterns) {
    assert.doesNotMatch(migrationSql, pattern, `deferred scope must be absent: ${pattern}`);
  }
});

test("database foundation smoke SQL covers tables, RLS, policies, indexes, seeds, and user-policy guards", () => {
  for (const tableName of newFoundationTables) {
    assert.match(
      smokeSql,
      new RegExp(`'${escapeRegExp(tableName)}'`, "i"),
      `${tableName} should be in smoke SQL`,
    );
  }

  for (const indexName of requiredIndexes) {
    assert.match(
      smokeSql,
      new RegExp(`'${escapeRegExp(indexName)}'`, "i"),
      `${indexName} should be in smoke SQL`,
    );
  }

  assert.match(smokeSql, /relrowsecurity\s+is\s+distinct\s+from\s+true/i);
  assert.match(smokeSql, /'service_role'::name\s+=\s+any\(roles\)/i);
  assert.match(smokeSql, /'authenticated'::name\s+=\s+any\(roles\)/i);
  assert.match(smokeSql, /'anon'::name\s+=\s+any\(roles\)/i);
  assert.match(smokeSql, /missing_external_source_seed/i);
  assert.match(smokeSql, /database_foundation_smoke_passed/i);
});
