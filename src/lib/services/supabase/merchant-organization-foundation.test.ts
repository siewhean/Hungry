import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationSql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/0035_merchant_organization_foundation.sql"),
  "utf8",
);

const smokeSql = readFileSync(
  resolve(process.cwd(), "supabase/smoke/merchant_organization_foundation.sql"),
  "utf8",
);

const supabaseServiceSource = readFileSync(
  resolve(process.cwd(), "src/lib/services/supabase/supabaseService.ts"),
  "utf8",
);

const newTables = [
  "merchant_organizations",
  "merchant_members",
  "merchant_organization_outlets",
] as const;

const helperFunctions = [
  "merchant_is_org_member",
  "merchant_can_view_organization",
  "merchant_can_manage_organization",
  "merchant_can_manage_legacy_outlet",
  "merchant_can_manage_outlet_v2",
] as const;

const requiredIndexes = [
  "idx_merchant_organizations_legacy_account",
  "idx_merchant_organizations_status_created",
  "merchant_members_org_user_unique",
  "merchant_members_org_email_unique",
  "idx_merchant_members_org_role_status",
  "idx_merchant_members_user_status",
  "idx_merchant_members_email_status",
  "idx_merchant_organization_outlets_outlet",
  "idx_merchant_organization_outlets_org_source",
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

test("0035 creates only the merchant organization compatibility foundation", () => {
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
    /\bdelete\s+from\s+(merchant_accounts|merchant_roles|merchant_outlets|merchant_verifications|merchant_claim_interests|merchant_promotions|merchant_notification_preferences|venues|dishes|reviews|posts)\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /\bcreate\s+table\s+if\s+not\s+exists\s+(merchant_change_requests|merchant_claims|merchant_verification_events|menu_versions|media_assets|background_jobs|analytics_summaries|orders|payments|refunds|payouts)\b/i,
  );
});

test("0035 preserves legacy merchant surfaces and canonical text IDs", () => {
  assert.doesNotMatch(
    migrationSql,
    /\balter\s+table\s+(merchant_accounts|merchant_roles|merchant_outlets|merchant_verifications|merchant_claim_interests|merchant_promotions|merchant_notification_preferences)[\s\S]{0,200}\b(drop\s+column|rename\s+column|rename\s+to|alter\s+column\s+id)\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /create\s+or\s+replace\s+function\s+(?:public\.)?merchant_can_manage_venue\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /create\s+or\s+replace\s+function\s+public\.is_merchant_member\b/i,
  );
  assert.doesNotMatch(
    migrationSql,
    /\b(venue_id|dish_id|building_id)\s+uuid\s+references\s+(venues|dishes|buildings)\(id\)/i,
  );
  assert.match(supabaseServiceSource, /from\("merchant_outlets"\)/);
  assert.doesNotMatch(supabaseServiceSource, /from\("merchant_organizations"\)/);
});

test("0035 backfills compatibility from legacy accounts, roles, and outlets", () => {
  assert.match(
    migrationSql,
    /insert\s+into\s+merchant_organizations[\s\S]*from\s+merchant_accounts/i,
  );
  assert.match(
    migrationSql,
    /insert\s+into\s+merchant_members[\s\S]*'owner'[\s\S]*from\s+merchant_organizations[\s\S]*join\s+merchant_accounts/i,
  );
  assert.match(migrationSql, /insert\s+into\s+merchant_members[\s\S]*join\s+merchant_roles/i);
  assert.match(
    migrationSql,
    /insert\s+into\s+merchant_organization_outlets[\s\S]*join\s+merchant_outlets/i,
  );
  assert.match(migrationSql, /on\s+conflict\s+\(legacy_merchant_account_id\)\s+do\s+update/i);
  assert.match(
    migrationSql,
    /on\s+conflict\s+\(organization_id,\s*user_id\)\s+where\s+user_id\s+is\s+not\s+null\s+do\s+update/i,
  );
});

test("0035 enables RLS with service-role and bounded merchant policies", () => {
  for (const tableName of newTables) {
    assert.match(migrationSql, rlsPattern(tableName), `${tableName} should enable RLS`);
    assert.match(
      migrationSql,
      servicePolicyPattern(tableName),
      `${tableName} should have a service-role manage policy`,
    );
  }

  assert.match(migrationSql, /create\s+policy\s+"merchant_organizations_select_member"/i);
  assert.match(migrationSql, /create\s+policy\s+"merchant_members_select_org_member"/i);
  assert.match(migrationSql, /create\s+policy\s+"merchant_members_insert_manager"/i);
  assert.match(
    migrationSql,
    /role\s+in\s+\('manager',\s*'staff',\s*'ops',\s*'accountant',\s*'viewer'\)/i,
  );
  assert.match(migrationSql, /create\s+policy\s+"merchant_organization_outlets_insert_manager"/i);
  assert.match(
    migrationSql,
    /revoke\s+all\s+on\s+table\s+merchant_organizations\s+from\s+anon,\s*authenticated/i,
  );
  assert.match(
    migrationSql,
    /grant\s+select\s+on\s+table\s+merchant_organizations\s+to\s+authenticated/i,
  );
  assert.doesNotMatch(migrationSql, /create\s+policy[\s\S]{0,220}\bto\s+anon\b/i);
});

test("0035 adds expanded role model, indexes, and recursion-safe helper functions", () => {
  assert.match(
    migrationSql,
    /role\s+in\s+\('owner',\s*'manager',\s*'staff',\s*'ops',\s*'accountant',\s*'viewer'\)/i,
  );

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
      new RegExp(
        `grant\\s+execute\\s+on\\s+function\\s+public\\.${functionName}\\(uuid\\)\\s+to\\s+authenticated,\\s*service_role`,
        "i",
      ),
      `${functionName} should grant execute only to app/service roles`,
    );
  }
});

test("merchant organization smoke SQL covers schema, RLS, grants, backfill, behavior, and legacy guards", () => {
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
  assert.match(smokeSql, /missing_legacy_org_backfill/i);
  assert.match(smokeSql, /missing_owner_member_backfill/i);
  assert.match(smokeSql, /missing_outlet_bridge_backfill/i);
  assert.match(smokeSql, /behavior_manager_org_select_failed/i);
  assert.match(smokeSql, /behavior_manager_member_select_failed/i);
  assert.match(smokeSql, /behavior_manager_outlet_bridge_select_failed/i);
  assert.match(smokeSql, /behavior_manager_member_update_failed/i);
  assert.match(smokeSql, /behavior_manager_member_delete_failed/i);
  assert.match(smokeSql, /behavior_manager_owner_insert_allowed/i);
  assert.match(smokeSql, /behavior_non_member_org_select_leaked/i);
  assert.match(smokeSql, /behavior_non_member_insert_allowed/i);
  assert.match(smokeSql, /behavior_anon_table_grant_leaked/i);
  assert.match(smokeSql, /legacy_manage_venue_replaced_unexpectedly/i);
  assert.match(smokeSql, /merchant_organization_foundation_smoke_passed/i);
});
