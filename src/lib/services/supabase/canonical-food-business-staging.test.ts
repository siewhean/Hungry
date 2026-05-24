import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), "utf8");
}

const migrationSql = read("supabase/migrations/0043_canonical_food_business_staging.sql");
const smokeSql = read("supabase/smoke/canonical_food_business_staging.sql");
const importer = read("scripts/stage_canonical_food_businesses.py");
const smokeWrapper = read("scripts/supabase-canonical-food-business-staging-smoke.mjs");
const chunkApplyWrapper = read("scripts/supabase-apply-canonical-food-business-staging-chunks.mjs");
const packageJson = JSON.parse(read("package.json"));
const csvHeader = read("data/singapore_food_businesses_canonical.csv").split(/\r?\n/, 1)[0];

const csvToStagingColumns = [
  ["Business ID", "business_id"],
  ["Stall ID", "stall_id"],
  ["Licence No", "licence_no"],
  ["Stall / Restaurant Name", "business_name"],
  ["Business Name Normalized", "normalized_name"],
  ["Stall Type", "stall_type"],
  ["Cuisine", "cuisine"],
  ["Signature Dish", "signature_dish"],
  ["Menu", "menu_text"],
  ["Price", "price_text"],
  ["Price Min (SGD)", "price_min_sgd"],
  ["Price Max (SGD)", "price_max_sgd"],
  ["Opening Hours", "opening_hours_text"],
  ["Closed Days", "closed_days"],
  ["NEA Hygiene Grade", "hygiene_grade"],
  ["Michelin Recognition", "michelin_recognition"],
  ["Dietary Options", "dietary_options"],
  ["Delivery Platforms", "delivery_platforms"],
  ["Contact", "contact"],
  ["Instagram", "instagram"],
  ["Image URL", "image_url"],
  ["Hawker Centre / Building", "building_name"],
  ["Building Name", "building_display_name"],
  ["Unit No.", "unit_number"],
  ["Address", "address"],
  ["Postal Code", "postal_code"],
  ["Region", "region"],
  ["Location", "location_text"],
  ["Location Key", "location_key"],
  ["Latitude", "latitude"],
  ["Longitude", "longitude"],
  ["Source Type", "source_type_label"],
  ["Source URL", "source_url"],
  ["Last Verified Date", "last_verified_date"],
  ["Coverage Status", "coverage_status"],
  ["Notes", "notes"],
] as const;

const requiredIndexes = [
  "idx_staging_food_businesses_business_id",
  "idx_staging_food_businesses_stall_id",
  "idx_staging_food_businesses_licence_no",
  "idx_staging_food_businesses_source_hash",
  "idx_staging_food_businesses_location",
  "idx_staging_food_businesses_coverage_status",
] as const;

function expectColumn(columnName: string) {
  assert.match(
    migrationSql,
    new RegExp(`add\\s+column\\s+if\\s+not\\s+exists\\s+${columnName}\\b`, "i"),
    `${columnName} should be added to staging_food_businesses`,
  );
}

test("0043 aligns staging_food_businesses to the canonical CSV header", () => {
  for (const [csvColumn, stagingColumn] of csvToStagingColumns) {
    assert.match(csvHeader, new RegExp(`(^|,)${csvColumn.replace(/[()]/g, "\\$&")}(,|$)`));
    if (
      [
        "business_name",
        "normalized_name",
        "building_name",
        "unit_number",
        "postal_code",
        "latitude",
        "longitude",
      ].includes(stagingColumn)
    ) {
      assert.match(
        read("supabase/migrations/0028_data_import_provenance_foundation.sql"),
        new RegExp(`${stagingColumn}\\b`, "i"),
        `${stagingColumn} should already exist from 0028`,
      );
      continue;
    }
    expectColumn(stagingColumn);
  }

  assert.match(migrationSql, /singapore_food_businesses_csv/);
  assert.match(migrationSql, /data\/singapore_food_businesses_canonical\.csv/);
});

test("0043 adds validation and dedupe indexes without promoting canonical data", () => {
  assert.match(migrationSql, /observed_location\s+geography\(point,\s*4326\)\s+generated always/i);
  assert.match(migrationSql, /staging_food_businesses_price_range_check/i);
  assert.match(migrationSql, /staging_food_businesses_coverage_status_check/i);
  assert.match(migrationSql, /price_min_sgd <= price_max_sgd/i);
  assert.match(
    migrationSql,
    /lower\(coverage_status\) in \('complete', 'partial', 'unknown', 'out_of_scope'\)/i,
  );

  for (const indexName of requiredIndexes) {
    assert.match(
      migrationSql,
      new RegExp(`create\\s+index\\s+if\\s+not\\s+exists\\s+${indexName}\\b`, "i"),
      `${indexName} should be present`,
    );
  }

  assert.doesNotMatch(
    migrationSql,
    /\b(insert\s+into|update|delete\s+from)\s+(buildings|venues|dishes|dish_images|dish_taste_vectors)\b/i,
    "0043 must not promote staging rows into canonical app tables",
  );
});

test("canonical food business staging smoke covers schema, policy, and source controls", () => {
  for (const [, stagingColumn] of csvToStagingColumns) {
    assert.match(smokeSql, new RegExp(`'${stagingColumn}'`, "i"));
  }
  for (const indexName of requiredIndexes) {
    assert.match(smokeSql, new RegExp(`'${indexName}'`, "i"));
  }
  assert.match(smokeSql, /singapore_food_businesses_csv/);
  assert.match(smokeSql, /unexpected_user_policy/);
  assert.match(smokeSql, /import_total_mismatch/);
  assert.match(smokeSql, /incomplete_import_payload/);
  assert.match(smokeSql, /unexpected_import_summary/);
  assert.match(smokeSql, /32253/);
  assert.match(smokeSql, /9122e73836bf74f0b59a7817409f874f9064fa0acc65cd07f195929ce7892ccb/);
  assert.match(smokeSql, /canonical_food_business_staging_smoke_passed/);
});

test("canonical CSV staging importer generates a staging-only SQL load", () => {
  const tempDir = mkdtempSync(resolve(tmpdir(), "hungry-canonical-import-"));
  const outputPath = resolve(tempDir, "canonical-staging.sql");

  try {
    const rawSummary = execFileSync(
      "python3",
      ["scripts/stage_canonical_food_businesses.py", "--limit", "8", "--output", outputPath],
      { cwd: root, encoding: "utf8" },
    );
    const summary = JSON.parse(rawSummary);
    const generatedSql = readFileSync(outputPath, "utf8");

    assert.equal(summary.total_rows, 8);
    assert.equal(summary.source_slug, "singapore_food_businesses_csv");
    assert.match(summary.import_run_id, /^[0-9a-f-]{36}$/);
    assert.match(generatedSql, /insert into import_runs/i);
    assert.match(generatedSql, /insert into staging_food_businesses/i);
    assert.match(generatedSql, /staging_import_errors/i);
    assert.match(generatedSql, /building_display_name/i);
    assert.match(generatedSql, /source_hash/i);
    assert.doesNotMatch(
      generatedSql,
      /\b(insert\s+into|update|delete\s+from)\s+(buildings|venues|dishes|dish_images|dish_taste_vectors)\b/i,
      "generated import SQL must not mutate production catalog tables",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("canonical CSV staging importer is guarded and exposes package scripts", () => {
  assert.match(importer, /HUNGRY_SUPABASE_IMPORT_URL/);
  assert.match(importer, /HUNGRY_SUPABASE_IMPORT_SERVICE_ROLE_KEY/);
  assert.match(importer, /HUNGRY_ALLOW_SERVICE_ROLE_IMPORT/);
  assert.match(importer, /--apply-supabase/);
  assert.match(importer, /--split-output-dir/);
  assert.match(importer, /must be a valid Supabase project URL/);
  assert.match(importer, /buildings, venues, dishes, or media tables/i);

  assert.equal(
    packageJson.scripts["data:supabase:stage:canonical"],
    "python3 scripts/stage_canonical_food_businesses.py",
  );
  assert.equal(
    packageJson.scripts["data:supabase:stage:canonical:split"],
    "python3 scripts/stage_canonical_food_businesses.py --split-output-dir",
  );
  assert.equal(
    packageJson.scripts["data:supabase:stage:canonical:apply"],
    "python3 scripts/stage_canonical_food_businesses.py --apply-supabase",
  );
  assert.equal(
    packageJson.scripts["data:supabase:stage:canonical:apply-sql-chunks"],
    "node scripts/supabase-apply-canonical-food-business-staging-chunks.mjs",
  );
  assert.equal(
    packageJson.scripts["smoke:supabase-canonical-food-business-staging"],
    "node scripts/supabase-canonical-food-business-staging-smoke.mjs",
  );

  assert.match(smokeWrapper, /canonical_food_business_staging\.sql/);
  assert.match(smokeWrapper, /canonical_food_business_staging_smoke_passed/);
  assert.match(smokeWrapper, /missing_\|unexpected_\|mismatch\|invalid_\|incomplete_/);
  assert.match(chunkApplyWrapper, /supabase",\s*"db",\s*"query"/);
  assert.ok(chunkApplyWrapper.includes("/^\\d{4}_.+\\.sql$/"));
});

test("canonical CSV staging importer can split SQL for remote CLI limits", () => {
  const tempDir = mkdtempSync(resolve(tmpdir(), "hungry-canonical-import-split-"));

  try {
    const rawSummary = execFileSync(
      "python3",
      [
        "scripts/stage_canonical_food_businesses.py",
        "--limit",
        "8",
        "--batch-size",
        "3",
        "--split-output-dir",
        tempDir,
      ],
      { cwd: root, encoding: "utf8" },
    );
    const summary = JSON.parse(rawSummary);
    const files = readdirSync(tempDir)
      .filter((entry) => entry.endsWith(".sql"))
      .sort();
    const joinedSql = files.map((file) => readFileSync(resolve(tempDir, file), "utf8")).join("\n");

    assert.equal(summary.total_rows, 8);
    assert.equal(summary.split_file_count, 5);
    assert.deepEqual(files, [
      "0001_prepare_import.sql",
      "0002_staging_food_businesses_00001.sql",
      "0003_staging_food_businesses_00004.sql",
      "0004_staging_food_businesses_00007.sql",
      "0005_complete_import.sql",
    ]);
    assert.match(joinedSql, /insert into import_runs/i);
    assert.match(joinedSql, /delete from staging_food_businesses/i);
    assert.match(joinedSql, /insert into staging_food_businesses/i);
    assert.match(joinedSql, /status = 'completed'/i);
    assert.doesNotMatch(
      joinedSql,
      /\b(insert\s+into|update|delete\s+from)\s+(buildings|venues|dishes|dish_images|dish_taste_vectors)\b/i,
      "split import SQL must not mutate production catalog tables",
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
