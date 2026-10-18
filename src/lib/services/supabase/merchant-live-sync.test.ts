import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261018150000_merchant_live_sync.sql"),
  "utf8",
);

function functionBody(name: string): string {
  const start = sql.indexOf(`create or replace function public.${name}(`);
  assert.ok(start >= 0, `${name} should be defined`);
  return sql.slice(start, sql.indexOf("$$;", start));
}

test("merchant write guards block self-approval of provenance fields again", () => {
  for (const guard of [
    "enforce_merchant_venue_update_guard",
    "enforce_merchant_dish_write_guard",
  ]) {
    const body = functionBody(guard);
    for (const column of [
      "menu_approved_for_display",
      "menu_rights_status",
      "media_approved_for_display",
      "media_rights_status",
    ]) {
      assert.match(body, new RegExp(`new\\.${column} is distinct from old\\.${column}`), guard);
    }
  }
});

test("verified merchants' dishes and new photos become merchant_owned and displayable", () => {
  const dishGuard = functionBody("enforce_merchant_dish_write_guard");
  assert.match(dishGuard, /merchant_venue_is_verified\(new\.venue_id\)/);
  assert.match(dishGuard, /new\.menu_rights_status := 'merchant_owned'/);
  assert.match(dishGuard, /new\.menu_rights_status is distinct from 'rejected'/);
  assert.match(dishGuard, /if v_image_changed and/);
  assert.match(
    functionBody("enforce_merchant_dish_image_write_guard"),
    /merchant_venue_is_verified/,
  );
  assert.match(functionBody("merchant_venue_is_verified"), /mv\.status = 'verified'/);
});

test("merchant profile syncs to venues and is exposed to diners only when live", () => {
  assert.match(
    sql,
    /create trigger trg_sync_merchant_outlet_to_venue\s+after update on public\.merchant_outlets/,
  );
  const sync = functionBody("sync_merchant_outlet_to_venue");
  assert.match(sync, /closure_notice = case/);
  assert.match(sync, /logo_url = case\s+when v_verified/);
  const profile = functionBody("get_public_merchant_profile");
  assert.match(profile, /and mo\.is_live/);
  assert.match(profile, /case when verified\.ok then mo\.profile_photo_url end/);
  assert.match(
    sql,
    /grant execute on function public\.get_public_merchant_profile\(text\) to anon, authenticated/,
  );
});

test("raw catalog refresh runs per venue, only for app-user writes, and is not client callable", () => {
  const trigger = functionBody("catalog_raw_refresh_venue_trigger");
  assert.match(trigger, /auth\.role\(\), ''\) <> 'authenticated'/);
  assert.match(functionBody("catalog_raw_refresh_venue"), /where status = 'active'/);
  assert.match(
    sql,
    /revoke all on function public\.catalog_raw_refresh_venue\(text\) from public, anon, authenticated/,
  );
  for (const table of ["venues", "dishes", "dish_images", "dish_dietary_flags"]) {
    assert.match(
      sql,
      new RegExp(
        `on public\\.${table}\\s+for each row execute function public\\.catalog_raw_refresh_venue_trigger`,
      ),
    );
  }
});
