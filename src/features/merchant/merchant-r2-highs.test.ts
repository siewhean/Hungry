import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const MIGRATIONS = path.join(process.cwd(), "supabase/migrations");

function read(file: string): string {
  return readFileSync(path.join(process.cwd(), file), "utf8");
}

/** The newest migration's definition of a SQL function (what the database ends up with). */
function latestDefinition(qualifiedName: string): { file: string; body: string } {
  const marker = `create or replace function ${qualifiedName}(`;
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  let found: { file: string; body: string } | undefined;
  for (const file of files) {
    const sql = readFileSync(path.join(MIGRATIONS, file), "utf8");
    const start = sql.lastIndexOf(marker);
    if (start >= 0) found = { file, body: sql.slice(start, sql.indexOf("$$;", start)) };
  }
  assert.ok(found, `${qualifiedName} should be defined`);
  return found;
}

test("H46: promotions need a verified outlet to publish and to reach diners", () => {
  const migration = read(
    "supabase/migrations/20261021180000_merchant_promotions_require_verification.sql",
  );
  assert.match(
    migration,
    /create trigger trg_enforce_merchant_promotion_verified\s+before insert or update on public\.merchant_promotions/,
  );
  const guard = latestDefinition("app_private.enforce_merchant_promotion_verified").body;
  assert.match(guard, /security invoker/);
  assert.match(guard, /new\.status in \('active', 'scheduled'\)/);
  assert.match(guard, /merchant_outlet_is_verified_for_caller\(new\.outlet_id\)/);

  const shows = latestDefinition("app_private.merchant_outlet_shows_promotions").body;
  assert.match(shows, /mo\.is_live/);
  assert.match(shows, /public\.merchant_outlet_is_verified\(p_outlet_id\)/);
  for (const policy of [
    "merchant_promotions_anon_active_select",
    "merchant_promotions_authenticated_select",
  ]) {
    const block = migration.slice(migration.indexOf(`create policy "${policy}"`));
    assert.match(block.slice(0, 600), /app_private\.merchant_outlet_shows_promotions\(outlet_id\)/);
  }

  const rpc = latestDefinition("app_private.list_customer_active_promotions");
  assert.match(rpc.body, /public\.merchant_outlet_is_verified\(mo\.id\)/, rpc.file);
  assert.match(rpc.body, /security definer/);
  // The public RPC stays an invoker wrapper.
  assert.match(latestDefinition("public.list_customer_active_promotions").body, /security invoker/);
});

test("H47: merchant review replies need a verified outlet at the venue", () => {
  const guard = latestDefinition("public.enforce_merchant_review_reply_update");
  assert.equal(guard.file, "20261021180100_merchant_review_reply_requires_verification.sql");
  assert.match(guard.body, /security invoker/);
  assert.match(
    guard.body,
    /if merchant_can_manage_venue\(old\.venue_id\) then[\s\S]*merchant_reply_text is distinct from old\.merchant_reply_text[\s\S]*not public\.merchant_venue_is_verified\(old\.venue_id\)/,
  );
  // The helpful_count bypass and author branch are kept.
  assert.match(guard.body, /pg_trigger_depth\(\) > 1/);
  assert.match(guard.body, /review authors cannot change identity or merchant reply fields/);
});

test("H48: merchants cannot write any venue column directly", () => {
  const guard = latestDefinition("public.enforce_merchant_venue_update_guard");
  assert.equal(guard.file, "20261021180200_merchant_venue_direct_writes_ops_only.sql");
  assert.match(guard.body, /security invoker/);
  assert.match(guard.body, /app_is_current_user_ops_admin\(\)/);
  // An allow-list with nothing on it: no per-column deny list left to fall out of date.
  assert.doesNotMatch(guard.body, /is distinct from old\./);
  assert.match(
    guard.body,
    /merchant_can_manage_venue\(old\.id\)[\s\S]*end if;\s*(--[^\n]*\n\s*)*raise exception 'update the merchant profile instead/,
  );
});

test("H49: verification applies profile edits saved while pending", () => {
  const publish = latestDefinition("app_private.publish_merchant_menu_drafts_on_verify");
  assert.equal(publish.file, "20261021180300_merchant_profile_publish_on_verify.sql");
  const syncAt = publish.body.indexOf(
    "app_private.sync_merchant_outlet_to_venue_full(new.outlet_id)",
  );
  const draftsAt = publish.body.indexOf("d.merchant_draft) then");
  assert.ok(syncAt > 0, "publish-on-verify runs the full profile sync");
  assert.ok(draftsAt > syncAt, "the profile sync does not depend on there being drafts");
  assert.match(publish.body, /perform public\.catalog_raw_refresh_venue\(v_venue_id\)/);

  const full = latestDefinition("app_private.sync_merchant_outlet_to_venue_full").body;
  assert.match(full, /security definer/);
  assert.match(full, /not public\.merchant_outlet_is_verified\(o\.id\)/);
  assert.match(full, /\^https:\/\//);
  assert.match(full, /unit_number = case when v_home_based then ''/);
  assert.match(full, /address = case when v_hidden then null/);
  assert.match(full, /name = coalesce\(v_name, v\.name\)/);
});

test("H50: the merchant tab bar is not shown on editors", () => {
  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  const editors = tabs.match(/const EDITOR_ROUTES = new Set<string>\(\[([^\]]*)\]\)/);
  assert.ok(editors, "EDITOR_ROUTES is defined");
  for (const route of ["BusinessProfileEditor", "DishEditor", "PromotionBuilder"]) {
    assert.match(editors[1], new RegExp(`"${route}"`));
  }
  assert.match(
    tabs,
    /function MerchantTabBar[\s\S]*?if \(EDITOR_ROUTES\.has\(state\.routes\[state\.index\]\?\.name \?\? ""\)\) \{\s*return null;/,
  );
});

test("H51: each guarded merchant screen is built once", () => {
  const tabs = read("src/app/navigation/MerchantTabs.tsx");
  const loaders = [...tabs.matchAll(/const (load\w+Screen) = /g)].map((match) => match[1]);
  assert.ok(loaders.length >= 15);
  for (const loader of loaders) {
    assert.match(tabs, new RegExp(`const ${loader} = memoizeLoader\\(\\(\\) =>`), loader);
  }
  assert.match(tabs, /loaded \?\?= \{ value: load\(\) \}/);
});
