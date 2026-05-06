import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("Supabase merchant service is wired to linked consumer venue and dish tables", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");

  assert.doesNotMatch(service, /merchantUnavailable/);
  assert.doesNotMatch(service, /Merchant Centre is not available in Supabase mode yet/);
  assert.match(service, /from\("merchant_outlets"\)/);
  assert.match(service, /from\("venues"\)/);
  assert.match(service, /from\("dishes"\)/);
  assert.match(service, /invalidateSupabaseRepositoryCache/);
  assert.match(service, /requireLinkedMerchantOutlet/);
  assert.match(service, /UUID_PATTERN/);
  assert.match(service, /merchant_account_id/);
});

test("Supabase migration links merchant writes to non-merchant read surfaces", () => {
  const migration = read("supabase/migrations/0019_merchant_consumer_linkage.sql");

  assert.match(migration, /mo\.venue_id = venues\.id/);
  assert.match(migration, /mo\.venue_id = dishes\.venue_id/);
  assert.match(migration, /mo\.venue_id = reviews\.venue_id/);
  assert.match(migration, /merchant_promotions/);
  assert.match(migration, /merchant_notification_preferences/);
});

test("Supabase merchant RLS hardening limits review replies and settings writes", () => {
  const migration = read("supabase/migrations/0020_merchant_rls_hardening.sql");
  const authorGuard = read("supabase/migrations/0021_review_author_update_guard.sql");
  const catalogGuard = read("supabase/migrations/0022_merchant_catalog_column_guards.sql");
  const smoke = read("supabase/smoke/merchant_rls_policies.sql");

  assert.match(migration, /merchant_can_manage_venue/);
  assert.match(migration, /enforce_merchant_review_reply_update/);
  assert.match(migration, /merchant review updates are limited to reply fields/);
  assert.match(migration, /interaction_reports_insert_merchant_owner_or_manager/);
  assert.match(migration, /notification_prefs_update_owner_or_manager/);
  assert.match(migration, /security invoker/);
  assert.match(authorGuard, /review authors cannot change identity or merchant reply fields/);
  assert.match(authorGuard, /new\.merchant_reply_text is distinct from old\.merchant_reply_text/);
  assert.match(catalogGuard, /merchant venue updates are limited to profile fields/);
  assert.match(catalogGuard, /new\.hygiene_grade is distinct from old\.hygiene_grade/);
  assert.match(
    catalogGuard,
    /merchant dish updates cannot change identity, aggregate, or live fields/,
  );
  assert.match(catalogGuard, /new\.rating_avg is distinct from old\.rating_avg/);
  assert.match(catalogGuard, /dish insert must match a managed merchant outlet/);
  assert.match(smoke, /trg_enforce_merchant_review_reply_update/);
  assert.match(smoke, /trg_enforce_merchant_venue_update_guard/);
  assert.match(smoke, /trg_enforce_merchant_dish_write_guard/);
  assert.match(smoke, /security_definer/);
});
