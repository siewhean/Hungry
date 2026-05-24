import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migration0032Sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0032_social_governance_feed_foundation.sql"),
  "utf8",
);

const migration0033Sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0033_social_governance_feed_foundation_fixes.sql"),
  "utf8",
);

const migration0034Sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0034_post_report_write_integrity.sql"),
  "utf8",
);

const migrationSql = `${migration0032Sql}\n${migration0033Sql}\n${migration0034Sql}`;

const smokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/social_governance_feed_foundation.sql"),
  "utf8",
);

const serviceSource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseService.ts"),
  "utf8",
);

const serviceTypes = readFileSync(resolve(process.cwd(), "src/lib/services/types.ts"), "utf8");

const mockServiceSource = readFileSync(
  resolve(process.cwd(), "src/lib/services/mock/mockService.ts"),
  "utf8",
);

const newTables = [
  "hidden_posts",
  "post_reports",
  "moderation_actions",
  "post_moderation_states",
  "home_feed_items",
] as const;

const requiredIndexes = [
  "idx_hidden_posts_post_id",
  "idx_post_reports_post_status",
  "idx_post_reports_reporter_status",
  "idx_moderation_actions_target",
  "idx_moderation_actions_actor",
  "idx_post_moderation_states_state_updated",
  "idx_home_feed_items_viewer_cursor",
  "idx_home_feed_items_post_id",
  "idx_home_feed_items_bucket_cursor",
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

const lastFunctionBlock = (functionName: string) => {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}[\\s\\S]*?\\$\\$;`,
    "gi",
  );
  const matches = [...migrationSql.matchAll(pattern)];
  return matches.at(-1)?.[0];
};

test("social governance migrations create only additive tables", () => {
  for (const tableName of newTables) {
    assert.match(migrationSql, createTablePattern(tableName), `${tableName} should be additive`);
  }

  assert.doesNotMatch(migrationSql, /\bdrop\s+table\b/i);
  assert.doesNotMatch(migrationSql, /\btruncate\s+table\b/i);
  assert.doesNotMatch(
    migrationSql,
    /\b(delete\s+from)\s+(buildings|venues|dishes|reviews|posts|merchant_accounts|user_profiles)\b/i,
  );
  assert.doesNotMatch(migrationSql, /\bpartition\s+by\b/i);
  assert.doesNotMatch(
    migrationSql,
    /\bcreate\s+table\s+if\s+not\s+exists\s+(merchant_organizations|menu_versions|media_assets|background_jobs|orders|payments|refunds|payouts)\b/i,
  );
});

test("social governance migrations enable RLS with service-role and bounded user policies", () => {
  for (const tableName of newTables) {
    assert.match(migrationSql, rlsPattern(tableName), `${tableName} should enable RLS`);
    assert.match(
      migrationSql,
      servicePolicyPattern(tableName),
      `${tableName} should have a service-role manage policy`,
    );
  }

  assert.match(migrationSql, /create\s+policy\s+"hidden_posts_select_own"/i);
  assert.match(migrationSql, /create\s+policy\s+"hidden_posts_insert_own"/i);
  assert.match(migrationSql, /create\s+policy\s+"hidden_posts_delete_own"/i);
  assert.match(migrationSql, /create\s+policy\s+"hidden_posts_update_own"/i);
  assert.match(migrationSql, /create\s+policy\s+"post_reports_select_own"/i);
  assert.match(
    migrationSql,
    /drop\s+policy\s+if\s+exists\s+"post_reports_insert_own_visible_post"/i,
  );
  assert.match(
    migrationSql,
    /drop\s+policy\s+if\s+exists\s+"post_reports_update_own_visible_post"/i,
  );
  assert.match(
    migrationSql,
    /revoke\s+insert,\s*update,\s*delete\s+on\s+table\s+post_reports\s+from\s+anon,\s*authenticated/i,
  );
  assert.match(migrationSql, /grant\s+select\s+on\s+table\s+post_reports\s+to\s+authenticated/i);
  assert.match(migrationSql, /create\s+policy\s+"home_feed_items_select_scoped"/i);
  assert.doesNotMatch(migrationSql, /\bto\s+anon\b/i);
  assert.doesNotMatch(
    migrationSql,
    /moderation_actions[\s\S]{0,200}\bto\s+authenticated\b/i,
    "moderation audit rows must not be broadly user-readable or user-writable",
  );
});

test("social governance migrations add indexes without mutating canonical app-facing IDs", () => {
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

  assert.doesNotMatch(
    migrationSql,
    /\balter\s+table\s+(buildings|venues|dishes|reviews|posts|merchant_accounts|user_profiles)[\s\S]{0,200}\b(alter\s+column\s+id|rename\s+column|drop\s+column|rename\s+to)\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /\b(venue_id|dish_id|building_id)\s+uuid\s+references\s+(venues|dishes|buildings)\(id\)/i,
  );
});

test("social governance migrations gate reads through moderation, hidden-post state, and feed read model", () => {
  const canReadPostBlock = lastFunctionBlock("can_read_post");
  assert.ok(canReadPostBlock, "can_read_post should be updated");
  assert.match(canReadPostBlock, /security\s+definer/i);
  assert.match(canReadPostBlock, /post_moderation_states/i);
  assert.match(canReadPostBlock, /pms\.state\s+in\s+\('hidden',\s*'removed'\)/i);

  const feedV2Block = lastFunctionBlock("get_home_social_feed_v2");
  assert.ok(feedV2Block, "get_home_social_feed_v2 should be detectable");
  assert.match(feedV2Block, /security\s+invoker/i);
  assert.doesNotMatch(feedV2Block, /security\s+definer/i);
  assert.match(feedV2Block, /home_feed_items/i);
  assert.match(feedV2Block, /hidden_posts/i);
  assert.match(feedV2Block, /post_moderation_states/i);
  assert.match(feedV2Block, /public\.can_read_post\(p\.id\)/i);
  assert.match(feedV2Block, /p_cursor_feed_created_at\s+timestamptz\s+default\s+null/i);
  assert.match(feedV2Block, /order\s+by\s+p\.feed_created_at\s+desc,\s*p\.id\s+desc/i);
  assert.doesNotMatch(feedV2Block, /order\s+by[\s\S]{0,120}rank_score/i);
});

test("social governance migrations expose safe RPCs with correct grants", () => {
  for (const functionName of [
    "hide_post",
    "unhide_post",
    "report_post",
    "set_post_moderation_state",
    "get_home_social_feed_v2",
  ]) {
    assert.match(
      migrationSql,
      new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\b`, "i"),
    );
  }

  assert.match(
    migrationSql,
    /revoke\s+execute\s+on\s+function\s+public\.hide_post\(uuid,\s*text\)\s+from\s+public/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.hide_post\(uuid,\s*text\)\s+to\s+authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.unhide_post\(uuid\)\s+to\s+authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.report_post\(uuid,\s*text,\s*text\)\s+to\s+authenticated/i,
  );
  assert.match(
    lastFunctionBlock("report_post") ?? "",
    /security\s+definer/i,
    "report_post should be definer because authenticated users cannot write post_reports directly",
  );
  assert.match(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.set_post_moderation_state\(uuid,\s*text,\s*text,\s*uuid,\s*jsonb\)\s+to\s+service_role/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /grant\s+execute\s+on\s+function\s+public\.set_post_moderation_state\(uuid,\s*text,\s*text,\s*uuid,\s*jsonb\)\s+to\s+authenticated/i,
  );
});

test("Supabase service uses v2 feed first and routes post safety actions to RPCs", () => {
  const v2Index = serviceSource.indexOf('client.rpc("get_home_social_feed_v2"');
  const legacyIndex = serviceSource.indexOf('client.rpc("get_home_social_feed"');
  assert.ok(v2Index >= 0, "service should call get_home_social_feed_v2");
  assert.ok(legacyIndex > v2Index, "legacy feed RPC should remain a fallback after v2");
  assert.match(serviceSource, /if\s+\(legacyResult\.error\)/);
  assert.match(
    serviceSource,
    /const\s+rpcBites\s+=\s+await\s+fetchHomeSocialFeedBitesViaRpc\(client\)/,
  );
  assert.match(serviceSource, /if\s+\(request\.targetType\s+===\s+"post"\)/);
  assert.match(serviceSource, /Post reports require a valid post id/);
  assert.match(serviceSource, /client\.rpc\("report_post"/);
  assert.match(serviceSource, /client\.rpc\("hide_post"/);
  assert.match(serviceSource, /client\.rpc\("unhide_post"/);

  assert.match(serviceTypes, /"profile"\s+\|\s+"post"/);
  assert.match(serviceTypes, /hidePost\(postId:\s*string,\s*reason\?:\s*string\):\s*Promise<void>/);
  assert.match(serviceTypes, /unhidePost\(postId:\s*string\):\s*Promise<void>/);
  assert.match(mockServiceSource, /async\s+hidePost/);
  assert.match(mockServiceSource, /async\s+unhidePost/);
});

test("social governance smoke SQL covers schema, RLS, grants, guards, and samples", () => {
  for (const tableName of newTables) {
    assert.match(smokeSql, new RegExp(`'${escapeRegExp(tableName)}'`, "i"));
  }
  for (const indexName of requiredIndexes) {
    assert.match(smokeSql, new RegExp(`'${escapeRegExp(indexName)}'`, "i"));
  }

  assert.match(smokeSql, /rls_not_enabled/i);
  assert.match(smokeSql, /missing_service_role_policy/i);
  assert.match(smokeSql, /missing_authenticated_policy/i);
  assert.match(smokeSql, /unexpected_anon_policy/i);
  assert.match(smokeSql, /missing_report_post_security_definer/i);
  assert.match(smokeSql, /unexpected_post_reports_authenticated_write_policy/i);
  assert.match(smokeSql, /unexpected_post_reports_authenticated_insert/i);
  assert.match(smokeSql, /unexpected_post_reports_authenticated_update/i);
  assert.match(smokeSql, /unexpected_post_reports_authenticated_delete/i);
  assert.match(smokeSql, /missing_can_read_post_moderation_guard/i);
  assert.match(smokeSql, /missing_feed_read_model_guard/i);
  assert.match(smokeSql, /missing_feed_cursor_order/i);
  assert.match(smokeSql, /unexpected_rank_score_cursor_order/i);
  assert.match(smokeSql, /public\.get_home_social_feed_v2\(10,\s*null,\s*null\)/i);
  assert.match(smokeSql, /social_governance_feed_foundation_smoke_passed/i);
});
