import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

function segmentBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Expected to find segment start: ${start}`);
  const endIndex = source.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, `Expected to find segment end: ${end}`);
  return source.slice(startIndex, endIndex);
}

const migrationPath = "supabase/migrations/0027_taste_recommendation_events.sql";

test("taste recommendation migration adds vector metadata, interaction tables, and indexes", () => {
  const sql = readRepoFile(migrationPath);

  assert.match(sql, /alter table if exists user_taste_vectors[\s\S]*confidence/i);
  assert.match(sql, /signal_count integer not null default 0/i);
  assert.match(sql, /last_signal_at timestamptz/i);
  assert.match(sql, /source text not null default 'profile'/i);

  for (const tableName of ["taste_interaction_events", "quiz_responses", "dish_flavor_tags"]) {
    assert.match(sql, new RegExp(`create table if not exists ${tableName}`, "i"));
    assert.match(sql, new RegExp(`alter table ${tableName} enable row level security`, "i"));
  }

  assert.match(sql, /dish_taste_vectors_vector_hnsw_idx[\s\S]*using hnsw/i);
  assert.match(sql, /user_taste_vectors_vector_hnsw_idx[\s\S]*using hnsw/i);
  assert.match(sql, /taste_interaction_events_user_created_idx/i);
  assert.match(sql, /taste_interaction_events_dish_idx/i);
  assert.match(sql, /taste_interaction_events_low_value_cap_idx/i);
});

test("taste recommendation migration adds RLS policies and live recommendation RPCs", () => {
  const sql = readRepoFile(migrationPath);

  for (const policyName of [
    "taste_interaction_events_select_own",
    "taste_interaction_events_insert_own",
    "quiz_responses_select_own",
    "quiz_responses_insert_own",
    "dish_flavor_tags_select_applied",
  ]) {
    assert.match(sql, new RegExp(`create policy "${policyName}"`, "i"));
  }

  assert.match(sql, /create or replace function public\.get_taste_recommendations/i);
  assert.match(sql, /dtv\.vector <=> params\.user_vector/i);
  assert.match(sql, /0\.50 \* vc\.taste_score/i);
  assert.match(sql, /0\.15 \* vc\.distance_score/i);
  assert.match(sql, /0\.10 \* vc\.rating_score/i);
  assert.match(sql, /grant execute on function public\.get_taste_recommendations/i);

  assert.match(sql, /create or replace function public\.record_taste_interaction_event/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /insert into taste_interaction_events/i);
  assert.match(sql, /p_metadata jsonb default '\{\}'::jsonb/i);
  assert.match(sql, /v_vector_after double precision\[\] := array\[/i);
  assert.match(sql, /least\(10, greatest\(0, coalesce\(p_user_vector_after\[1\], 5\)\)\)/i);
  assert.match(sql, /and tie\.applied/i);
  assert.match(sql, /jsonb_build_object\('reason', 'capped'\)/i);
  assert.match(sql, /metadata,\s+created_at/i);
  assert.match(sql, /on conflict \(user_id\) do update set/i);
  assert.match(
    sql,
    /confidence = least\(1, greatest\(0, user_taste_vectors\.confidence \+ v_delta\)\)/i,
  );
  assert.match(sql, /grant execute on function public\.record_taste_interaction_event/i);
});

test("supabase service prefers live recommendation RPC with mock-compatible fallback", () => {
  const source = readRepoFile("src/lib/services/supabase/supabaseService.ts");
  const getSlate = segmentBetween(
    source,
    "async getSlate(request)",
    "async recordExplicitFeedback",
  );

  assert.match(source, /async function getLiveTasteRecommendations/i);
  assert.match(source, /client\.rpc\("get_taste_recommendations"/);
  assert.match(source, /refreshSupabaseRepositoryCache\(\)/);
  assert.match(getSlate, /getLiveTasteRecommendations\(client, request, profile\)/);
  assert.match(getSlate, /liveItems \?\? getRankedRecommendations\(request, profile\)/);
});

test("supabase service records explicit feedback through RPC and preserves fallback update", () => {
  const source = readRepoFile("src/lib/services/supabase/supabaseService.ts");
  const persistEvent = segmentBetween(
    source,
    "async function persistFeedbackEvent",
    "function confidenceDeltaForFeedback",
  );
  const recordFeedback = segmentBetween(
    source,
    "async recordExplicitFeedback(feedback)",
    "\n    },\n  },\n\n  ai:",
  );

  assert.match(source, /function confidenceDeltaForFeedback/i);
  assert.match(source, /function isLiveFeedbackCapped/i);
  assert.match(source, /\.eq\("applied", true\)/);
  assert.match(source, /function createServiceTasteEvent/i);
  assert.match(source, /function feedbackMetadata/i);
  assert.match(source, /function toPersistedFeedbackType/i);
  assert.match(source, /feedback\.feedbackType === "save"[\s\S]*return "saved"/);
  assert.match(source, /feedback\.feedbackType === "unsave"[\s\S]*return "unsaved"/);
  assert.match(source, /async function persistFeedbackEvent/i);
  assert.match(persistEvent, /client\.rpc\("record_taste_interaction_event"/);
  assert.match(persistEvent, /client\.from\("taste_interaction_events"\)\.insert/);
  assert.match(recordFeedback, /const persistedType = toPersistedFeedbackType\(feedback\)/);
  assert.match(persistEvent, /p_type: persistedType/);
  assert.match(recordFeedback, /type: persistedType/);
  assert.match(persistEvent, /p_user_vector_before: tasteVectorToArray\(vectorBefore\)/);
  assert.match(persistEvent, /p_user_vector_after: tasteVectorToArray\(vectorAfter\)/);
  assert.match(persistEvent, /p_applied: applied/);
  assert.match(persistEvent, /p_metadata: metadata/);
  assert.match(persistEvent, /return true/);
  assert.match(recordFeedback, /await persistFeedbackEvent\(\{[\s\S]*reason: "missing_dish"/);
  assert.match(recordFeedback, /await persistFeedbackEvent\(\{[\s\S]*reason: "missing_signal"/);
  assert.match(recordFeedback, /const persistedWithRpc = await persistFeedbackEvent/);
  assert.match(
    recordFeedback,
    /if \(applied && !persistedWithRpc\)[\s\S]*updateTasteVector\(updatedVector\)/,
  );
});

test("implicit feedback remains no-op until the explicit learning loop is stable", () => {
  const supabaseSource = readRepoFile("src/lib/services/supabase/supabaseService.ts");
  const mockSource = readRepoFile("src/lib/services/mock/mockService.ts");
  const collector = readRepoFile("src/hooks/useImplicitSignalCollector.ts");
  const supabaseImplicit = segmentBetween(
    supabaseSource,
    "async processImplicitFeedback(_signals",
    "async getTagSuggestions",
  );
  const mockImplicit = segmentBetween(
    mockSource,
    "async processImplicitFeedback(_signals",
    "// Extended — Community Calibration",
  );

  assert.match(collector, /const IMPLICIT_LEARNING_ENABLED = false/);
  assert.match(collector, /if \(!IMPLICIT_LEARNING_ENABLED\)[\s\S]*return/);
  assert.doesNotMatch(supabaseImplicit, /processImplicitFeedbackCore/);
  assert.match(supabaseImplicit, /return profile\.tasteVector/);
  assert.doesNotMatch(mockImplicit, /processImplicitFeedbackCore/);
  assert.match(mockImplicit, /return resolve\(_profile\.tasteVector\)/);
});

test("taste recommendation smoke SQL checks functions, indexes, policies, and compile path", () => {
  const smoke = readRepoFile("supabase/smoke/taste_recommendations.sql");

  assert.match(smoke, /expected_tables/i);
  assert.match(smoke, /expected_columns/i);
  assert.match(smoke, /expected_indexes/i);
  assert.match(smoke, /expected_policies/i);
  assert.match(smoke, /expected_functions/i);
  assert.match(smoke, /dish_taste_vectors_vector_hnsw_idx/i);
  assert.match(smoke, /taste_interaction_events_low_value_cap_idx/i);
  assert.match(smoke, /record_taste_interaction_event/i);
  assert.match(smoke, /public\.get_taste_recommendations/i);
});
