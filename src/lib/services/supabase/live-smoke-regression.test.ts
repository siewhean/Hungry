import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const initialMigrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260621103850_discovery_search_live_smoke_fix.sql"),
  "utf8",
);

const indexableAreaMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260621104927_discovery_search_indexable_area_fix.sql",
  ),
  "utf8",
);

const searchLateEnrichmentMigrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260621110042_search_dishes_late_enrichment.sql"),
  "utf8",
);

const searchCandidateIdsMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260621110642_search_dishes_bounded_candidate_ids.sql",
  ),
  "utf8",
);

const searchScopedCandidateIdsMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260621112116_search_dishes_scoped_candidate_ids.sql",
  ),
  "utf8",
);

const searchInlineScopedCandidatesMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260621112815_search_dishes_inline_scoped_candidates.sql",
  ),
  "utf8",
);

const searchBranchScopedCandidateIdsMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260621113326_search_dishes_branch_scoped_candidate_ids.sql",
  ),
  "utf8",
);

const searchFastUnfilteredPathMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260621113951_search_dishes_fast_unfiltered_path.sql",
  ),
  "utf8",
);

const searchRestoreFastGuardedMigrationSql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260621114541_search_dishes_restore_fast_guarded.sql",
  ),
  "utf8",
);

test("live discovery smoke migration prefilters venues before top-dish lookup", () => {
  assert.match(
    initialMigrationSql,
    /create\s+index\s+if\s+not\s+exists\s+idx_dishes_displayable_top_by_venue/i,
  );
  assert.match(
    initialMigrationSql,
    /on\s+public\.dishes\s+\(venue_id,\s*must_order\s+desc,\s*is_featured\s+desc,\s*rating_avg\s+desc,\s*id\)/i,
  );
  assert.match(indexableAreaMigrationSql, /candidate_venues\s+as\s+materialized/i);
  assert.match(
    indexableAreaMigrationSql,
    /from\s+candidate_venues\s+cv[\s\S]*?join\s+lateral\s+\(/i,
  );
  assert.match(indexableAreaMigrationSql, /union\s+all/i);
  assert.match(
    indexableAreaMigrationSql,
    /lower\(trim\(v\.planning_area\)\)\s+=\s+params\.area_key/i,
  );
  assert.match(
    indexableAreaMigrationSql,
    /v\.planning_area\s+is\s+null[\s\S]*?lower\(trim\(b\.planning_area\)\)\s+=\s+params\.area_key/i,
  );
  assert.match(indexableAreaMigrationSql, /limit\s+500/i);
});

test("live search smoke migration treats area-name queries as bounded location searches", () => {
  assert.match(indexableAreaMigrationSql, /query_area_match\s+as\s+\(/i);
  assert.match(indexableAreaMigrationSql, /coalesce\(p_area_name,\s*p_query\)/i);
  assert.match(
    indexableAreaMigrationSql,
    /case\s+when\s+exists\s+\(select\s+1\s+from\s+query_area_match\)[\s\S]*?then\s+null\s+else\s+nullif\(trim\(coalesce\(p_query,\s*''\)\),\s*''\)\s+end\s+as\s+query/i,
  );
  assert.match(
    indexableAreaMigrationSql,
    /coalesce\(\(select\s+center_lat\s+from\s+query_area_match\),\s*p_lat\)\s+as\s+lat/i,
  );
  assert.match(
    indexableAreaMigrationSql,
    /coalesce\(\(select\s+center_lng\s+from\s+query_area_match\),\s*p_lng\)\s+as\s+lng/i,
  );
  assert.doesNotMatch(indexableAreaMigrationSql, /similarity\(b\.name,\s*params\.query\)/);
  assert.doesNotMatch(indexableAreaMigrationSql, /v\.postal_code/);
  assert.doesNotMatch(indexableAreaMigrationSql, /b\.postal_code/);
});

test("live search smoke migration enriches only the limited result page", () => {
  assert.match(searchLateEnrichmentMigrationSql, /lean_candidates\s+as\s+\(/i);
  assert.match(searchLateEnrichmentMigrationSql, /limited\s+as\s+materialized\s+\(/i);
  assert.match(
    searchLateEnrichmentMigrationSql,
    /limit\s+\(select\s+result_limit\s+from\s+params\)/i,
  );
  assert.match(
    searchLateEnrichmentMigrationSql,
    /from\s+limited[\s\S]*?left\s+join\s+dish_taste_vectors\s+dtv\s+on\s+dtv\.dish_id\s+=\s+limited\.dish_id/i,
  );

  const leanCandidateBody =
    searchLateEnrichmentMigrationSql.match(
      /lean_candidates\s+as\s+\(([\s\S]*?)\),\s*scored\s+as/i,
    )?.[1] ?? "";
  assert.doesNotMatch(leanCandidateBody, /dish_taste_vectors/i);
  assert.doesNotMatch(leanCandidateBody, /dish_images/i);
  assert.doesNotMatch(leanCandidateBody, /array_agg\(df\.slug/i);
});

test("live search smoke migration bounds candidate IDs before scoring", () => {
  assert.match(searchCandidateIdsMigrationSql, /candidate_ids\s+as\s+materialized\s+\(/i);
  assert.match(searchCandidateIdsMigrationSql, /select\s+distinct\s+dish_id/i);
  assert.match(searchCandidateIdsMigrationSql, /d\.name\s+%\s+params\.query/i);
  assert.match(searchCandidateIdsMigrationSql, /v\.name\s+%\s+params\.query/i);
  assert.match(searchCandidateIdsMigrationSql, /limit\s+250/i);
  assert.match(searchCandidateIdsMigrationSql, /limit\s+750/i);
  assert.match(
    searchCandidateIdsMigrationSql,
    /from\s+candidate_ids\s+ci[\s\S]*?join\s+dishes\s+d\s+on\s+d\.id\s+=\s+ci\.dish_id/i,
  );
});

test("live search smoke migration applies app filters before candidate limits", () => {
  assert.match(searchScopedCandidateIdsMigrationSql, /base_scope\s+as\s+materialized\s+\(/i);
  assert.match(
    searchInlineScopedCandidatesMigrationSql,
    /base_scope\s+as\s+not\s+materialized\s+\(/i,
  );
  assert.match(
    searchBranchScopedCandidateIdsMigrationSql,
    /candidate_ids\s+as\s+materialized\s+\(/i,
  );
  assert.match(
    searchBranchScopedCandidateIdsMigrationSql,
    /join\s+buildings\s+b\s+on\s+b\.id\s+=\s+d\.building_id[\s\S]*?limit\s+250/i,
  );
  assert.match(
    searchBranchScopedCandidateIdsMigrationSql,
    /from\s+candidate_ids\s+ci[\s\S]*?join\s+dishes\s+d\s+on\s+d\.id\s+=\s+ci\.dish_id/i,
  );
  assert.match(
    searchBranchScopedCandidateIdsMigrationSql,
    /not\s+params\.area_requested\s+or\s+params\.area_found/i,
  );
  assert.match(
    searchBranchScopedCandidateIdsMigrationSql,
    /not\s+params\.open_only\s+or\s+\(v\.is_open\s+=\s+true\s+and\s+b\.is_closed_today\s+=\s+false\)/i,
  );
  assert.match(
    searchBranchScopedCandidateIdsMigrationSql,
    /params\.max_price\s+is\s+null\s+or\s+d\.price\s+<=\s+params\.max_price/i,
  );
  assert.match(
    searchBranchScopedCandidateIdsMigrationSql,
    /cardinality\(params\.cuisine_tags\)\s+=\s+0[\s\S]*?d\.cuisine_tags\s+&&\s+params\.cuisine_tags/i,
  );
  assert.match(
    searchBranchScopedCandidateIdsMigrationSql,
    /cardinality\(params\.dietary_flags\)\s+=\s+0[\s\S]*?dish_dietary_flags/i,
  );
});

test("live search smoke migration keeps common unfiltered text search on a fast path", () => {
  assert.match(searchFastUnfilteredPathMigrationSql, /as\s+fast_unfiltered_text/i);
  assert.match(
    searchFastUnfilteredPathMigrationSql,
    /where\s+params\.fast_unfiltered_text[\s\S]*?d\.name\s+%\s+params\.query/i,
  );
  assert.match(
    searchFastUnfilteredPathMigrationSql,
    /where\s+params\.fast_unfiltered_text[\s\S]*?v\.name\s+%\s+params\.query/i,
  );
  assert.match(
    searchFastUnfilteredPathMigrationSql,
    /where\s+params\.query\s+is\s+not\s+null\s+and\s+not\s+params\.fast_unfiltered_text/i,
  );
  assert.match(
    searchFastUnfilteredPathMigrationSql,
    /cardinality\(coalesce\(p_dietary_flags,\s*'\{\}'::text\[\]\)\)\s+=\s+0/i,
  );
  assert.match(
    searchFastUnfilteredPathMigrationSql,
    /cardinality\(coalesce\(p_cuisine_tags,\s*'\{\}'::text\[\]\)\)\s+=\s+0/i,
  );
});

test("live search smoke migration restores fast bounded candidates with invalid-area guard", () => {
  assert.match(searchRestoreFastGuardedMigrationSql, /candidate_ids\s+as\s+materialized\s+\(/i);
  assert.match(searchRestoreFastGuardedMigrationSql, /d\.name\s+%\s+params\.query/i);
  assert.match(searchRestoreFastGuardedMigrationSql, /v\.name\s+%\s+params\.query/i);
  assert.match(searchRestoreFastGuardedMigrationSql, /limited\s+as\s+materialized\s+\(/i);
  assert.match(
    searchRestoreFastGuardedMigrationSql,
    /not\s+params\.area_requested\s+or\s+params\.area_found/i,
  );
});
