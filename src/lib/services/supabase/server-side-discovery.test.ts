import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0029_server_side_discovery_reads.sql"),
  "utf8",
);

const smokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/server_side_discovery_reads.sql"),
  "utf8",
);

const discoverAreaCountMigrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260527090000_discover_area_venue_count.sql"),
  "utf8",
);

const discoverAreaCountSmokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/discover_area_venue_count.sql"),
  "utf8",
);

const provenanceGuardrailSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260610120000_catalog_display_provenance_guardrails.sql",
  ),
  "utf8",
);

const repositorySource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseRepository.ts"),
  "utf8",
);

const discoverSource = readFileSync(
  resolve(process.cwd(), "src/app/screens/discover/DiscoverHomeScreen.tsx"),
  "utf8",
);

const serviceSource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseService.ts"),
  "utf8",
);

const expectedFunctions = [
  "search_dishes",
  "get_dish_detail",
  "get_venue_detail",
  "get_nearby_open_venues",
] as const;

const expectedIndexes = [
  "idx_dishes_rating_id",
  "idx_dishes_price_id",
  "idx_dishes_venue_rating_id",
  "idx_venues_open_building",
  "idx_dish_images_dish_order",
  "idx_reviews_dish_created",
  "idx_dish_dietary_flags_flag_dish",
] as const;

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

test("0029 adds bounded server-side discovery read RPCs", () => {
  for (const functionName of expectedFunctions) {
    assert.match(
      migrationSql,
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\b`, "i"),
      `${functionName} should be defined`,
    );
  }

  assert.match(migrationSql, /p_cursor_score\s+double\s+precision/i);
  assert.match(migrationSql, /p_cursor_distance_meters\s+integer/i);
  assert.match(migrationSql, /order\s+by\s+scored\.rank_score\s+desc,\s+scored\.dish_id/i);
  assert.match(migrationSql, /order\s+by\s+candidates\.distance_meters,\s+candidates\.venue_id/i);
});

test("0029 keeps discovery RPCs invoker-safe and executable by app clients", () => {
  for (const functionName of expectedFunctions) {
    const functionBlock = new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}[\\s\\S]*?\\$\\$;`,
      "i",
    ).exec(migrationSql)?.[0];
    assert.ok(functionBlock, `${functionName} body should be detectable`);
    assert.match(functionBlock, /security\s+invoker/i, `${functionName} should be invoker`);
    assert.doesNotMatch(
      functionBlock,
      /security\s+definer/i,
      `${functionName} must not be definer`,
    );
    assert.match(functionBlock, /set\s+search_path\s+=\s+public/i);
  }

  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.search_dishes[\s\S]*?to\s+anon,\s+authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.get_dish_detail\(text\)\s+to\s+anon,\s+authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.get_venue_detail\(text\)\s+to\s+anon,\s+authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.get_nearby_open_venues[\s\S]*?to\s+anon,\s+authenticated/i,
  );
});

test("0029 adds query indexes without mutating canonical IDs or deferred models", () => {
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
    /\bcreate\s+(?:or\s+replace\s+)?function\s+public\.(get_home_feed|get_merchant_dashboard)\b/i,
  );
  assert.doesNotMatch(migrationSql, /\bidx_posts_feed_cursor\b/i);
  assert.doesNotMatch(
    migrationSql,
    /\bcreate\s+table\s+if\s+not\s+exists\s+(feed_items|merchant_organizations|menu_versions|media_assets|background_jobs|orders|payments|refunds|payouts)\b/i,
  );
});

test("Supabase discovery service uses RPC-first read paths with cache fallback", () => {
  assert.match(repositorySource, /export\s+async\s+function\s+searchDishesViaRpc/i);
  assert.match(repositorySource, /client\.rpc\(functionName,\s+args\)/);
  assert.match(repositorySource, /rpcRows\("search_dishes"/);
  assert.match(repositorySource, /rpcRows\("get_dish_detail"/);
  assert.match(repositorySource, /rpcRows\("get_venue_detail"/);
  assert.match(repositorySource, /rpcRows\("get_nearby_open_venues"/);

  assert.match(serviceSource, /await\s+searchDishesViaRpc\(filters,\s*tasteProfile\)/);
  assert.match(serviceSource, /await\s+getDishByIdViaRpc\(id\)/);
  assert.match(serviceSource, /await\s+getVenueByIdViaRpc\(id\)/);
  assert.match(serviceSource, /await\s+listDishesByVenueViaRpc\(venueId\)/);
  assert.match(serviceSource, /await\s+listPopularNearbyViaRpc\(lat,\s*lng\)/);
  assert.match(serviceSource, /\?\?\s+supabaseRepository\./);
});

test("Discover area count uses exact RPC before location-scoped building fallback", () => {
  assert.match(
    discoverAreaCountMigrationSql,
    /create\s+or\s+replace\s+function\s+public\.count_venues_in_area\b/i,
  );
  assert.match(discoverAreaCountMigrationSql, /returns\s+integer/i);
  assert.match(discoverAreaCountMigrationSql, /security\s+invoker/i);
  assert.doesNotMatch(discoverAreaCountMigrationSql, /security\s+definer/i);
  assert.match(discoverAreaCountMigrationSql, /set\s+search_path\s+=\s+public/i);
  assert.match(
    discoverAreaCountMigrationSql,
    /st_dwithin\([\s\S]*b\.location[\s\S]*st_setsrid\(st_makepoint\(p_lng,\s*p_lat\),\s*4326\)::geography[\s\S]*p_radius_meters[\s\S]*\)/i,
  );
  assert.match(
    discoverAreaCountMigrationSql,
    /grant\s+execute\s+on\s+function\s+public\.count_venues_in_area[\s\S]*to\s+anon,\s+authenticated/i,
  );

  assert.match(repositorySource, /export\s+async\s+function\s+countVenuesInAreaViaRpc/i);
  assert.match(
    repositorySource,
    /\.from\("venues"\)[\s\S]*?\.ilike\("planning_area",\s*normalizedAreaName\)/,
  );
  assert.match(repositorySource, /client\.rpc\("count_venues_in_area"/);
  const countServiceBlock =
    /async\s+countVenuesInArea\(lat,\s*lng,\s*radiusMeters,\s*areaName\)[\s\S]*?\n    },/.exec(
      serviceSource,
    )?.[0];
  assert.ok(countServiceBlock, "countVenuesInArea service method should be detectable");
  assert.match(
    countServiceBlock,
    /await\s+countVenuesInAreaViaRpc\(lat,\s*lng,\s*radiusMeters,\s*areaName\)/,
  );
  assert.match(countServiceBlock, /await\s+listBuildingsViaRpc\(lat,\s*lng,\s*radiusMeters\)/);
  assert.doesNotMatch(countServiceBlock, /supabaseRepository\.listBuildings\(\)/);

  assert.match(discoverAreaCountSmokeSql, /count_venues_in_area/);
  assert.match(discoverAreaCountSmokeSql, /nearby_venue_count/);
});

test("Discover feed ratings are sourced from the same dish aggregates as details", () => {
  assert.match(provenanceGuardrailSql, /top_dish_rating\s+numeric/i);
  assert.match(provenanceGuardrailSql, /top_dish_review_count\s+integer/i);
  assert.match(provenanceGuardrailSql, /top_dish\.rating_avg\s+as\s+top_dish_rating/i);
  assert.match(provenanceGuardrailSql, /top_dish\.review_count\s+as\s+top_dish_review_count/i);
  assert.match(repositorySource, /rating_avg:\s+row\.top_dish_rating/);
  assert.match(repositorySource, /review_count:\s+row\.top_dish_review_count/);
  assert.match(
    repositorySource,
    /const imageUrl = gallery\[0\] \|\| catalogDisplayImageUrl\(row\) \|\| "";/,
  );
  assert.match(
    serviceSource,
    /const imageUrl = gallery\[0\] \?\? asString\(row\.image_url\) \?\? "";/,
  );
  assert.match(
    discoverSource,
    /const normalizedRating = Number\.isFinite\(dish\.rating\) \? dish\.rating : 0;/,
  );
  assert.doesNotMatch(discoverSource, /dish\.rating > 0 \? dish\.rating : 4/);
});

test("server-side discovery smoke SQL checks functions, grants, indexes, and sample calls", () => {
  for (const functionName of expectedFunctions) {
    assert.match(
      smokeSql,
      new RegExp(`'${functionName}'`, "i"),
      `${functionName} should be in smoke SQL`,
    );
  }

  for (const indexName of expectedIndexes) {
    assert.match(
      smokeSql,
      new RegExp(`'${escapeRegExp(indexName)}'`, "i"),
      `${indexName} should be in smoke SQL`,
    );
  }

  assert.match(smokeSql, /security_definer_not_allowed/i);
  assert.match(smokeSql, /has_function_privilege/i);
  assert.match(smokeSql, /public\.search_dishes\(null,\s*null,\s*null/i);
  assert.match(smokeSql, /public\.get_nearby_open_venues\(null,\s*null/i);
  assert.match(smokeSql, /server_side_discovery_reads_smoke_passed/i);
});
