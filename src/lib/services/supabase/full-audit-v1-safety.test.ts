import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

const socialSafetySql = read("supabase/migrations/0041_full_audit_social_safety.sql");
const gamificationSql = read("supabase/migrations/0042_full_audit_gamification.sql");
const postgisRelocationPrepSql = read(
  "supabase/migrations/20260522160920_postgis_relocation_search_path_prep.sql",
);
const stallInteractionFixSql = read(
  "supabase/migrations/20260524031000_fix_upsert_stall_interaction_conflict.sql",
);
const stallInteractionReturnFixSql = read(
  "supabase/migrations/20260524032500_fix_upsert_stall_interaction_return_query.sql",
);
const serviceTypes = read("src/lib/services/types.ts");
const supabaseService = read("src/lib/services/supabase/supabaseService.ts");
const supabaseRepository = read("src/lib/services/supabase/supabaseRepository.ts");
const readinessSmoke = read("supabase/smoke/full_audit_v1_readiness.sql");
const readinessSmokeScript = read("scripts/supabase-full-audit-v1-smoke.mjs");
const socialGamificationSmokeScript = read("scripts/supabase-social-gamification-smoke.mjs");
const advisorSecurityClassifierScript = read("scripts/supabase-advisor-security-classifier.mjs");
const advisorSupportSnapshotScript = read("scripts/supabase-advisor-support-snapshot.mjs");
const advisorNonPasswordRunbook = read("supabase/manual/security_advisor_non_password_runbook.md");
const legacyPaymentOrderRpcCleanupSql = read(
  "supabase/manual/legacy_payment_order_rpc_advisor_cleanup.sql",
);
const packageJson = JSON.parse(read("package.json")) as {
  scripts?: Record<string, string>;
};
const foodCredStore = read("src/store/useFoodCredStore.ts");
const missionStore = read("src/store/useMissionStore.ts");
const stallInteractionStore = read("src/store/useStallInteractionStore.ts");

test("Full Audit V1 social safety adds checked report and moderation surfaces", () => {
  assert.match(socialSafetySql, /create table if not exists post_comment_moderation_states/i);
  assert.match(socialSafetySql, /create or replace function public\.report_content/i);
  assert.match(
    socialSafetySql,
    /create or replace function public\.list_content_moderation_queue/i,
  );
  assert.match(socialSafetySql, /public\.app_is_current_user_ops_admin\(\)/);
  assert.match(socialSafetySql, /count\(distinct reporter_id\)[\s\S]*report_count >= 3/i);
  assert.match(socialSafetySql, /post_comment_moderation_states[\s\S]*state = 'hidden'/i);
  assert.match(socialSafetySql, /post_moderation_states[\s\S]*state = 'hidden'/i);
  assert.match(socialSafetySql, /target_type in \([\s\S]*'story'[\s\S]*'message'/i);
  assert.match(
    socialSafetySql,
    /revoke insert, update, delete on table content_reports from anon, authenticated/i,
  );
});

test("Full Audit V1 chat sends are RPC-gated by participants, blocks, and rate limits", () => {
  assert.match(socialSafetySql, /create or replace function public\.app_user_block_exists/i);
  assert.match(socialSafetySql, /create or replace function public\.send_chat_message/i);
  assert.match(socialSafetySql, /public\.can_access_conversation\(p_conversation_id\)/i);
  assert.match(
    socialSafetySql,
    /public\.app_user_block_exists\(v_user_id, cp\.participant_user_id\)/i,
  );
  assert.match(socialSafetySql, /chat_message_minute[\s\S]*30/i);
  assert.match(socialSafetySql, /chat_message_hour[\s\S]*120/i);
  assert.match(
    socialSafetySql,
    /revoke insert, update, delete on table messages from anon, authenticated/i,
  );
  assert.match(supabaseService, /\.rpc\("send_chat_message"/);
  assert.doesNotMatch(supabaseService, /\.from\("messages"\)\s*\.insert\(\{/);
});

test("Full Audit V1 gamification persists Food Cred, stall interactions, and missions", () => {
  for (const tableName of [
    "user_food_cred",
    "food_cred_events",
    "user_stall_interactions",
    "weekly_missions",
    "user_mission_progress",
  ]) {
    assert.match(gamificationSql, new RegExp(`create table if not exists ${tableName}\\b`, "i"));
    assert.match(
      gamificationSql,
      new RegExp(`alter table ${tableName} enable row level security`, "i"),
    );
  }

  assert.match(gamificationSql, /create or replace function public\.award_food_cred/i);
  assert.match(gamificationSql, /create or replace function public\.upsert_stall_interaction/i);
  assert.match(gamificationSql, /create or replace function public\.increment_mission_progress/i);
  assert.match(gamificationSql, /food_cred_daily_cap/i);
  assert.match(gamificationSql, /mission-save-3-stalls/i);
  assert.match(gamificationSql, /previous_completed_at timestamptz/i);
  assert.match(
    gamificationSql,
    /previous_completed_at is null[\s\S]*next_completed_at is not null[\s\S]*award_food_cred/i,
  );
  assert.match(stallInteractionFixSql, /app_private\.upsert_stall_interaction/i);
  assert.match(stallInteractionFixSql, /on conflict on constraint user_stall_interactions_pkey/i);
  assert.doesNotMatch(
    stallInteractionFixSql,
    /create or replace function public\.upsert_stall_interaction/i,
  );
  assert.match(stallInteractionReturnFixSql, /app_private\.upsert_stall_interaction/i);
  assert.match(
    stallInteractionReturnFixSql,
    /return query[\s\S]*insert into public\.user_stall_interactions/i,
  );
  assert.doesNotMatch(
    stallInteractionReturnFixSql,
    /create or replace function public\.upsert_stall_interaction/i,
  );
});

test("mobile services use the Full Audit V1 gamification persistence hooks", () => {
  for (const methodName of [
    "awardFoodCred",
    "upsertStallInteraction",
    "incrementMissionProgress",
  ]) {
    assert.match(serviceTypes, new RegExp(`${methodName}\\?`));
    assert.match(supabaseRepository, new RegExp(`async ${methodName}\\(`));
  }

  assert.match(foodCredStore, /repo\.awardFoodCred\?\.\(/);
  assert.match(missionStore, /if\s+\(repo\.incrementMissionProgress\)/);
  assert.match(missionStore, /repo\.incrementMissionProgress\(userId,\s*missionType\)/);
  assert.match(stallInteractionStore, /upsertStallInteraction\?\.\(/);
});

test("Full Audit V1 smoke checks the applied social and gamification controls", () => {
  assert.match(readinessSmoke, /send_chat_message/);
  assert.match(readinessSmoke, /report_content/);
  assert.match(readinessSmoke, /list_content_moderation_queue/);
  assert.match(readinessSmoke, /award_food_cred/);
  assert.match(readinessSmoke, /app_private/);
  assert.match(readinessSmoke, /public_rpc\.prosecdef is false/);
  assert.match(readinessSmoke, /private_body\.prosecdef/);
  assert.match(readinessSmoke, /unsafe_direct_user_table_privilege/);
  assert.match(readinessSmoke, /mission_reward_transition_guard_missing/);
});

test("PostGIS relocation prep keeps app-owned geo RPCs schema-ready", () => {
  for (const functionName of [
    "get_taste_recommendations",
    "search_dishes",
    "get_nearby_open_venues",
    "list_buildings",
    "list_venues_by_building",
  ]) {
    assert.match(postgisRelocationPrepSql, new RegExp(`public\\.${functionName}`));
    assert.match(readinessSmoke, new RegExp(`\\('${functionName}'\\)`));
  }

  assert.match(postgisRelocationPrepSql, /set search_path = public, extensions/i);
  assert.match(readinessSmoke, /postgis_relocation_search_path_missing/);
  assert.match(readinessSmoke, /search_path=%public%extensions%/);
});

test("Full Audit V1 smoke command is skip-safe for local network gaps", () => {
  assert.equal(
    packageJson.scripts?.["smoke:supabase-full-audit-v1"],
    "node scripts/supabase-full-audit-v1-smoke.mjs",
  );
  assert.match(readinessSmokeScript, /HUNGRY_SUPABASE_SMOKE_REQUIRED/);
  assert.match(readinessSmokeScript, /isSkippableEnvironmentError/);
  assert.match(readinessSmokeScript, /readiness findings returned/);
  assert.match(readinessSmokeScript, /full_audit_v1_readiness\.sql/);
});

test("Full Audit V1 live behavior smoke covers social safety and gamification", () => {
  assert.equal(
    packageJson.scripts?.["smoke:supabase-social-gamification"],
    "node scripts/supabase-social-gamification-smoke.mjs",
  );
  assert.match(socialGamificationSmokeScript, /HUNGRY_ALLOW_SERVICE_ROLE_SMOKE/);
  assert.match(socialGamificationSmokeScript, /HUNGRY_SUPABASE_SMOKE_PROJECT_REF/);
  assert.match(socialGamificationSmokeScript, /\.rpc\("report_content"/);
  assert.match(socialGamificationSmokeScript, /\.rpc\("list_content_moderation_queue"/);
  assert.match(socialGamificationSmokeScript, /\.from\("user_blocks"\)\.upsert/);
  assert.match(socialGamificationSmokeScript, /\.rpc\("open_chat_conversation"/);
  assert.match(socialGamificationSmokeScript, /\.rpc\("award_food_cred"/);
  assert.match(socialGamificationSmokeScript, /\.rpc\("upsert_stall_interaction"/);
  assert.match(socialGamificationSmokeScript, /\.rpc\("increment_mission_progress"/);
  assert.match(socialGamificationSmokeScript, /direct content report insert/);
  assert.match(socialGamificationSmokeScript, /direct food cred insert/);
  assert.match(socialGamificationSmokeScript, /cleanup failed/);
});

test("Supabase Security Advisor classifier fails new app-owned findings only", () => {
  assert.equal(
    packageJson.scripts?.["audit:supabase:advisor-security"],
    "node scripts/supabase-advisor-security-classifier.mjs",
  );
  assert.equal(
    packageJson.scripts?.["audit:supabase:advisor-security:non-password"],
    "node scripts/supabase-advisor-security-classifier.mjs --fail-on-external --ignore-leaked-password",
  );
  assert.match(advisorSecurityClassifierScript, /HUNGRY_SUPABASE_ADVISOR_REQUIRED/);
  assert.match(advisorSecurityClassifierScript, /HUNGRY_SUPABASE_ADVISOR_FAIL_ON_EXTERNAL/);
  assert.match(advisorSecurityClassifierScript, /HUNGRY_SUPABASE_ADVISOR_IGNORE_LEAKED_PASSWORD/);
  assert.match(advisorSecurityClassifierScript, /rls_disabled_in_public/);
  assert.match(advisorSecurityClassifierScript, /spatial_ref_sys/);
  assert.match(advisorSecurityClassifierScript, /extension_in_public/);
  assert.match(advisorSecurityClassifierScript, /postgis/);
  assert.match(advisorSecurityClassifierScript, /st_estimatedextent/);
  assert.match(advisorSecurityClassifierScript, /auth_leaked_password_protection/);
  assert.match(advisorSecurityClassifierScript, /release_reserved_order/);
  assert.match(advisorSecurityClassifierScript, /submit_payment_proof/);
  assert.match(advisorSecurityClassifierScript, /legacy linked Supabase payment RPC/);
  assert.match(advisorSecurityClassifierScript, /unexpected app-owned Advisor findings/);
  assert.match(advisorSecurityClassifierScript, /--fail-on-external/);
  assert.match(advisorSecurityClassifierScript, /--ignore-leaked-password/);
});

test("legacy payment/order Advisor blocker has an owner-approved cleanup runbook", () => {
  assert.match(advisorNonPasswordRunbook, /legacy payment\/order RPC grants/);
  assert.match(advisorNonPasswordRunbook, /legacy_payment_order_rpc_advisor_cleanup\.sql/);
  assert.match(advisorNonPasswordRunbook, /owner approval/i);
  assert.match(advisorNonPasswordRunbook, /audit:supabase:advisor-security:non-password/);

  for (const functionName of ["release_reserved_order", "submit_payment_proof"]) {
    assert.match(legacyPaymentOrderRpcCleanupSql, new RegExp(functionName));
  }

  assert.match(
    legacyPaymentOrderRpcCleanupSql,
    /revoke all on function public\.release_reserved_order\(text, text, text, text\)/i,
  );
  assert.match(
    legacyPaymentOrderRpcCleanupSql,
    /revoke all on function public\.release_reserved_order\(text, text\)/i,
  );
  assert.match(
    legacyPaymentOrderRpcCleanupSql,
    /revoke all on function public\.submit_payment_proof\(text, text, text\)/i,
  );
  assert.match(legacyPaymentOrderRpcCleanupSql, /from public, anon, authenticated/i);
  assert.match(legacyPaymentOrderRpcCleanupSql, /has_function_privilege\('anon'/i);
  assert.match(legacyPaymentOrderRpcCleanupSql, /has_function_privilege\('authenticated'/i);
  assert.match(legacyPaymentOrderRpcCleanupSql, /Do not run this file as an app migration/i);
  assert.match(legacyPaymentOrderRpcCleanupSql, /Rollback/i);
});

test("Supabase Security Advisor support snapshot captures owner-blocker evidence", () => {
  assert.equal(
    packageJson.scripts?.["audit:supabase:advisor-support-snapshot"],
    "node scripts/supabase-advisor-support-snapshot.mjs",
  );
  assert.match(advisorSupportSnapshotScript, /HUNGRY_SUPABASE_ADVISOR_SNAPSHOT_REQUIRED/);
  assert.match(advisorSupportSnapshotScript, /support_snapshot/);
  assert.match(advisorSupportSnapshotScript, /spatial_ref_sys_state/);
  assert.match(advisorSupportSnapshotScript, /st_estimatedextent_state/);
  assert.match(advisorSupportSnapshotScript, /postgis_state/);
  assert.match(advisorSupportSnapshotScript, /postgis_typed_columns/);
  assert.match(advisorSupportSnapshotScript, /geo_rpc_search_paths/);
  assert.match(advisorSupportSnapshotScript, /pg_has_role\(current_user, 'supabase_admin'/);
  assert.match(advisorSupportSnapshotScript, /format_type\(a\.atttypid, a\.atttypmod\)/);
});
