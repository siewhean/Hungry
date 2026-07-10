import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0031_location_directory_reads.sql"),
  "utf8",
);

const smokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/location_directory_reads.sql"),
  "utf8",
);

const repositorySource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseRepository.ts"),
  "utf8",
);

const serviceSource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseService.ts"),
  "utf8",
);

const expectedFunctions = [
  "list_buildings",
  "list_venues_by_building",
  "get_building_detail",
] as const;

const expectedIndexes = [
  "idx_building_floors_building_sort_label",
  "idx_venues_building_floor_id",
  "idx_dishes_building_rating_id",
] as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("0031 adds bounded location directory read RPCs", () => {
  for (const functionName of expectedFunctions) {
    assert.match(
      migrationSql,
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\b`, "i"),
      `${functionName} should be defined`,
    );
  }

  assert.match(migrationSql, /p_cursor_distance_meters\s+integer\s+default\s+null/i);
  assert.match(migrationSql, /p_cursor_floor_sort\s+integer\s+default\s+null/i);
  assert.match(migrationSql, /p_cursor_id\s+text\s+default\s+null/i);
  assert.match(migrationSql, /limit\s+\(select\s+result_limit\s+from\s+params\)/i);
  assert.match(migrationSql, /order\s+by\s+candidates\.distance_meters,\s+candidates\.id/i);
  assert.match(migrationSql, /order\s+by\s+coalesce\(bf\.sort_order,\s*9999\),\s*v\.id/i);
});

test("0031 keeps location reads invoker-safe and guest-browseable", () => {
  for (const functionName of expectedFunctions) {
    const functionBlock = new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}[\\s\\S]*?\\$\\$;`,
      "i",
    ).exec(migrationSql)?.[0];
    assert.ok(functionBlock, `${functionName} body should be detectable`);
    assert.match(functionBlock, /security\s+invoker/i, `${functionName} should be invoker`);
    assert.doesNotMatch(functionBlock, /security\s+definer/i);
    assert.match(functionBlock, /set\s+search_path\s+=\s+public/i);
  }

  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.list_buildings[\s\S]*?to\s+anon,\s+authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.list_venues_by_building[\s\S]*?to\s+anon,\s+authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.get_building_detail\(text\)\s+to\s+anon,\s+authenticated/i,
  );
  assert.match(
    migrationSql,
    /revoke\s+execute\s+on\s+function\s+public\.list_buildings[\s\S]*?from\s+public/i,
  );
  assert.match(
    migrationSql,
    /revoke\s+execute\s+on\s+function\s+public\.list_venues_by_building[\s\S]*?from\s+public/i,
  );
  assert.match(
    migrationSql,
    /revoke\s+execute\s+on\s+function\s+public\.get_building_detail\(text\)\s+from\s+public/i,
  );
});

test("0031 adds location indexes without deferred data models", () => {
  for (const indexName of expectedIndexes) {
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
    /\balter\s+table\s+(buildings|venues|dishes|reviews|posts)[\s\S]{0,200}\b(alter\s+column\s+id|rename\s+column|drop\s+column|rename\s+to)\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /\bcreate\s+table\s+if\s+not\s+exists\s+(feed_items|merchant_organizations|menu_versions|media_assets|background_jobs|analytics_summaries|orders|payments|refunds|payouts)\b/i,
  );
  assert.doesNotMatch(migrationSql, /left\s+join\s+venues\s+v[\s\S]*left\s+join\s+dishes\s+d/i);
  assert.match(
    migrationSql,
    /left\s+join\s+lateral\s+\([\s\S]*count\(\*\)::integer\s+as\s+total_stalls/i,
  );
});

test("Supabase discovery service uses location RPCs with cache fallback", () => {
  assert.match(repositorySource, /export\s+async\s+function\s+listBuildingsViaRpc/i);
  assert.match(repositorySource, /export\s+async\s+function\s+getBuildingDetailViaRpc/i);
  assert.match(repositorySource, /export\s+async\s+function\s+listVenuesByBuildingViaRpc/i);
  assert.match(repositorySource, /rpcRows\("list_buildings"/);
  assert.match(repositorySource, /rpcRows\("get_building_detail"/);
  assert.match(repositorySource, /rpcRows\("list_venues_by_building"/);

  assert.match(serviceSource, /await\s+listBuildingsViaRpc\(lat,\s*lng,\s*radiusMeters\)/);
  assert.match(serviceSource, /await\s+getBuildingDetailViaRpc\(id\)/);
  assert.match(serviceSource, /await\s+listVenuesByBuildingViaRpc\(buildingId\)/);
  assert.match(serviceSource, /\?\?\s+supabaseRepository\./);
});

test("location directory smoke SQL checks functions, grants, indexes, and samples", () => {
  for (const functionName of expectedFunctions) {
    assert.match(smokeSql, new RegExp(`'${functionName}'`, "i"));
  }
  for (const indexName of ["idx_buildings_location", ...expectedIndexes]) {
    assert.match(smokeSql, new RegExp(`'${escapeRegExp(indexName)}'`, "i"));
  }

  assert.match(smokeSql, /security_definer_not_allowed/i);
  assert.match(smokeSql, /has_function_privilege/i);
  assert.match(smokeSql, /public\.list_buildings\(null,\s*null,\s*null,\s*10,\s*null,\s*null\)/i);
  assert.match(smokeSql, /public\.get_building_detail/i);
  assert.match(smokeSql, /public\.list_venues_by_building/i);
  assert.match(smokeSql, /building_detail_count_mismatch/i);
  assert.match(smokeSql, /location_directory_reads_smoke_passed/i);
});
