import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const baseMigrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0036_merchant_change_requests.sql"),
  "utf8",
);

const grantHardeningSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0037_merchant_change_request_helper_grants.sql"),
  "utf8",
);

const migrationSql = `${baseMigrationSql}\n${grantHardeningSql}`;

const smokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/merchant_change_requests.sql"),
  "utf8",
);

const newTables = ["merchant_change_requests", "merchant_change_request_events"] as const;

const helperFunctions = [
  "is_platform_operator",
  "merchant_org_owns_venue",
  "submit_merchant_change_request",
  "list_merchant_change_requests",
  "get_merchant_change_request_detail",
  "cancel_merchant_change_request",
  "review_merchant_change_request",
] as const;

const requiredIndexes = [
  "idx_merchant_change_requests_org_status_cursor",
  "idx_merchant_change_requests_venue_status_cursor",
  "idx_merchant_change_requests_requester_cursor",
  "idx_merchant_change_requests_target",
  "idx_merchant_change_request_events_request_created",
  "idx_merchant_change_request_events_actor_created",
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

const functionBlock = (functionName: string) => {
  const pattern = new RegExp(
    `create\\s+or\\s+replace\\s+function\\s+public\\.${functionName}\\b[\\s\\S]*?\\$\\$;`,
    "i",
  );

  return migrationSql.match(pattern)?.[0] ?? "";
};

test("0036 adds an additive merchant change request queue only", () => {
  for (const tableName of newTables) {
    assert.match(
      migrationSql,
      createTablePattern(tableName),
      `${tableName} should be created additively`,
    );
  }

  assert.doesNotMatch(migrationSql, /\bdrop\s+table\b/i);
  assert.doesNotMatch(migrationSql, /\btruncate\s+table\b/i);
  assert.doesNotMatch(
    migrationSql,
    /\bdelete\s+from\s+(merchant_accounts|merchant_roles|merchant_outlets|merchant_organizations|merchant_members|merchant_organization_outlets|venues|dishes|reviews|posts)\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /\bupdate\s+(merchant_accounts|merchant_roles|merchant_outlets|merchant_organizations|merchant_members|merchant_organization_outlets|venues|dishes|reviews|posts)\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /\bcreate\s+table\s+if\s+not\s+exists\s+(menu_versions|menu_items|media_assets|background_jobs|analytics_summaries|orders|payments|refunds|payouts)\b/i,
  );
});

test("0036 preserves canonical text IDs and does not apply canonical mutations", () => {
  assert.match(migrationSql, /\bvenue_id\s+text\s+not\s+null\s+references\s+venues\(id\)/i);
  assert.match(migrationSql, /\btarget_id\s+text\b/i);
  assert.doesNotMatch(
    migrationSql,
    /\b(venue_id|dish_id|building_id|target_id)\s+uuid\s+references\s+(venues|dishes|buildings)\(id\)/i,
  );
  assert.match(migrationSql, /does not mutate canonical venues, dishes, menu, or media rows/i);
  assert.doesNotMatch(
    migrationSql,
    /\binsert\s+into\s+(venues|dishes|dish_images|dish_taste_vectors)\b/i,
  );
});

test("0036 enables RLS with service-role management and RPC-gated merchant writes", () => {
  for (const tableName of newTables) {
    assert.match(migrationSql, rlsPattern(tableName), `${tableName} should enable RLS`);
    assert.match(
      migrationSql,
      servicePolicyPattern(tableName),
      `${tableName} should have a service-role manage policy`,
    );
  }

  assert.match(migrationSql, /create\s+policy\s+"merchant_change_requests_select_member"/i);
  assert.match(migrationSql, /create\s+policy\s+"merchant_change_request_events_select_member"/i);
  assert.match(
    migrationSql,
    /revoke\s+all\s+on\s+table\s+merchant_change_requests\s+from\s+anon,\s*authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+select\s+on\s+table\s+merchant_change_requests\s+to\s+authenticated/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /grant\s+(?:insert|update|delete|all)[^;]+on\s+table\s+merchant_change_requests\s+to\s+authenticated/i,
  );
  assert.doesNotMatch(migrationSql, /create\s+policy[\s\S]{0,220}\bto\s+anon\b/i);
});

test("0036/0037 add queue indexes and hardened security-definer RPCs", () => {
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

  for (const functionName of helperFunctions) {
    const block = functionBlock(functionName);
    assert.ok(block, `${functionName} should be defined`);
    assert.match(block, /security\s+definer/i, `${functionName} should avoid RLS recursion`);
    assert.match(
      block,
      /set\s+search_path\s+=\s+public/i,
      `${functionName} should pin search_path`,
    );
    assert.match(
      migrationSql,
      new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\(`, "i"),
      `${functionName} should have explicit execute grant`,
    );
  }

  assert.match(
    grantHardeningSql,
    /revoke\s+execute\s+on\s+function\s+public\.merchant_org_owns_venue\(uuid,\s*text\)\s+from\s+authenticated/i,
  );
  assert.match(
    grantHardeningSql,
    /grant\s+execute\s+on\s+function\s+public\.merchant_org_owns_venue\(uuid,\s*text\)\s+to\s+service_role/i,
  );
  assert.doesNotMatch(
    grantHardeningSql,
    /grant\s+execute\s+on\s+function\s+public\.merchant_org_owns_venue\(uuid,\s*text\)\s+to\s+authenticated/i,
  );

  assert.match(functionBlock("submit_merchant_change_request"), /merchant_can_view_organization/i);
  assert.match(functionBlock("submit_merchant_change_request"), /merchant_org_owns_venue/i);
  assert.match(functionBlock("review_merchant_change_request"), /is_platform_operator/i);
  assert.match(
    functionBlock("list_merchant_change_requests"),
    /created_at\s+desc,\s*merchant_change_requests\.id\s+desc/i,
  );
});

test("merchant change request smoke SQL covers schema, grants, behavior, and platform review", () => {
  for (const tableName of newTables) {
    assert.match(smokeSql, new RegExp(`'${escapeRegExp(tableName)}'`, "i"));
  }

  for (const functionName of helperFunctions) {
    assert.match(smokeSql, new RegExp(`'${escapeRegExp(functionName)}'`, "i"));
  }

  for (const indexName of requiredIndexes) {
    assert.match(smokeSql, new RegExp(`'${escapeRegExp(indexName)}'`, "i"));
  }

  assert.match(smokeSql, /rls_not_enabled/i);
  assert.match(smokeSql, /missing_service_role_policy/i);
  assert.match(smokeSql, /missing_authenticated_policy/i);
  assert.match(smokeSql, /unexpected_anon_policy/i);
  assert.match(smokeSql, /unexpected_anon_table_grant/i);
  assert.match(smokeSql, /unexpected_authenticated_table_write_grant/i);
  assert.match(smokeSql, /unexpected_anon_function_grant/i);
  assert.match(smokeSql, /unexpected_authenticated_internal_function_grant/i);
  assert.match(smokeSql, /behavior_submit_failed/i);
  assert.match(smokeSql, /behavior_event_missing/i);
  assert.match(smokeSql, /behavior_list_failed/i);
  assert.match(smokeSql, /behavior_cursor_duplicate/i);
  assert.match(smokeSql, /behavior_cancel_failed/i);
  assert.match(smokeSql, /behavior_direct_insert_allowed/i);
  assert.match(smokeSql, /behavior_member_review_allowed/i);
  assert.match(smokeSql, /behavior_non_member_submit_allowed/i);
  assert.match(smokeSql, /behavior_non_member_list_leaked/i);
  assert.match(smokeSql, /behavior_platform_review_failed/i);
  assert.match(smokeSql, /behavior_review_event_missing/i);
  assert.match(smokeSql, /merchant_change_requests_smoke_passed/i);
});
