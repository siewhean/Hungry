import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const MIGRATION = "20261019090000_merchant_live_sync_caller_verification.sql";
const migrationsDir = resolve(process.cwd(), "supabase/migrations");
const sql = readFileSync(resolve(migrationsDir, MIGRATION), "utf8");

function functionBody(name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} should be defined`);
  return sql.slice(start, sql.indexOf("$$;", start));
}

test("caller verification migration is the latest definition of the redefined functions", () => {
  const later = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql") && file > MIGRATION)
    .filter((file) =>
      /function public\.(merchant_can_manage_venue|merchant_outlet_matches_catalog_link|enforce_merchant_dish_write_guard|enforce_merchant_dish_image_write_guard|sync_merchant_outlet_to_venue|get_public_merchant_profile)\(/.test(
        readFileSync(resolve(migrationsDir, file), "utf8"),
      ),
    );
  assert.deepEqual(later, []);
});

test("caller-scoped verification helper checks auth.uid() owner/manager of a verified outlet", () => {
  const helper = functionBody("merchant_venue_is_verified_for_current_user");
  assert.match(helper, /security definer\s+set search_path = ''/);
  assert.match(helper, /mv\.status = 'verified'/);
  assert.match(helper, /mv\.expires_at is null or mv\.expires_at > now\(\)/);
  assert.match(helper, /ma\.user_id = auth\.uid\(\)/);
  assert.match(helper, /mr\.user_id = auth\.uid\(\)\s+and mr\.role in \('owner', 'manager'\)/);
  assert.match(
    sql,
    /revoke all on function public\.merchant_venue_is_verified_for_current_user\(text\) from public, anon/,
  );
});

test("auto-approval depends on the writer being verified, not any outlet for the venue", () => {
  for (const guard of [
    "enforce_merchant_dish_write_guard",
    "enforce_merchant_dish_image_write_guard",
  ]) {
    const body = functionBody(guard);
    assert.match(body, /merchant_venue_is_verified_for_current_user\(/, guard);
    assert.doesNotMatch(body, /merchant_venue_is_verified\(/, guard);
    // service_role/admin bypasses are kept.
    assert.match(body, /app_is_current_user_ops_admin\(\)/, guard);
  }
  assert.match(
    functionBody("enforce_merchant_dish_write_guard"),
    /current_user in \('postgres', 'supabase_admin', 'service_role'\)/,
  );
});

test("unverified claimants lose write paths on venues that already have a verified outlet", () => {
  for (const helper of ["merchant_can_manage_venue", "merchant_outlet_matches_catalog_link"]) {
    const body = functionBody(helper);
    assert.match(body, /security invoker/, helper);
    assert.match(
      body,
      /if auth\.uid\(\) is null or p_venue_id is null then\s+return false;/,
      helper,
    );
    assert.match(
      body,
      /return not public\.merchant_venue_is_verified\(p_venue_id\)\s+or public\.merchant_venue_is_verified_for_current_user\(p_venue_id\);/,
      helper,
    );
  }
});

test("only verified outlets sync profile fields onto venues", () => {
  const sync = functionBody("sync_merchant_outlet_to_venue");
  assert.match(sync, /mv\.outlet_id = new\.id\s+and mv\.status = 'verified'/);
  assert.ok(
    sync.indexOf("mv.outlet_id = new.id") < sync.indexOf("update public.venues"),
    "verification check must run before the venue update",
  );
});

test("merchant outlet venue linkage is ops/service-only", () => {
  const guard = functionBody("enforce_merchant_outlet_venue_link_guard");
  assert.match(guard, /new\.venue_id is not null/);
  assert.match(guard, /new\.venue_id is distinct from old\.venue_id/);
  assert.match(guard, /app_is_current_user_ops_admin\(\)/);
  assert.match(
    sql,
    /create trigger trg_enforce_merchant_outlet_venue_link_guard\s+before insert or update on public\.merchant_outlets/,
  );
});

test("public merchant profile only returns verified live outlets", () => {
  const profile = functionBody("get_public_merchant_profile");
  assert.match(profile, /security definer\s+set search_path = ''/);
  assert.match(profile, /join public\.merchant_verifications mv on mv\.outlet_id = mo\.id/);
  assert.match(profile, /and mo\.is_live\s+and mv\.status = 'verified'/);
  assert.doesNotMatch(profile, /left join/);
  assert.match(
    sql,
    /revoke all on function public\.get_public_merchant_profile\(text\) from public;/,
  );
});
