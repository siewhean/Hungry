import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";

const MIGRATION_PATH = "supabase/migrations/20260713120000_order_write_integrity_hardening.sql";
const SMOKE_PATH = "supabase/smoke/order_write_integrity.sql";

function repoRoot(): string {
  return process.env.HUNGRY_TEST_REPO_ROOT ?? process.cwd();
}

function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(resolve(repoRoot(), pathFromRepoRoot), "utf8");
}

test("customer roles have no direct order write policy or table privilege", () => {
  const sql = readRepoFile(MIGRATION_PATH);

  assert.match(sql, /drop policy if exists "orders_insert_own" on public\.orders/i);
  assert.match(sql, /drop policy if exists "orders_update_own" on public\.orders/i);
  assert.match(
    sql,
    /revoke insert, update, delete on table public\.orders from public, anon, authenticated/i,
  );
  assert.doesNotMatch(sql, /create policy[\s\S]*on public\.orders[\s\S]*for (insert|update)/i);
  assert.doesNotMatch(sql, /\b(drop table|truncate|delete from)\b/i);
});

test("order integrity smoke rejects direct customer writes and preserves owner reads", () => {
  const sql = readRepoFile(SMOKE_PATH);

  for (const marker of [
    "orders_owner_select_policy_missing",
    "orders_customer_write_policy_leaked",
    "orders_anon_write_privilege_leaked",
    "orders_authenticated_write_privilege_leaked",
    "order_write_integrity_smoke_passed",
  ]) {
    assert.ok(sql.includes(marker), `Expected smoke marker '${marker}'.`);
  }

  assert.match(sql, /has_table_privilege\('authenticated', 'public\.orders', 'insert'/i);
  assert.match(sql, /has_table_privilege\('authenticated', 'public\.orders', 'update'/i);
  assert.match(sql, /has_table_privilege\('authenticated', 'public\.orders', 'delete'/i);
});

test("static Supabase audit recognizes schema-qualified order policy drops", () => {
  const output = execFileSync(process.execPath, ["scripts/supabase-neutral-audit.mjs"], {
    cwd: repoRoot(),
    encoding: "utf8",
  });
  const report = JSON.parse(output) as {
    policies: { active: { name: string; table: string }[] };
  };
  const activeOrderPolicyNames = report.policies.active
    .filter((policy) => policy.table === "orders")
    .map((policy) => policy.name);

  assert.doesNotMatch(activeOrderPolicyNames.join("\n"), /orders_(insert|update)_own/i);
});
