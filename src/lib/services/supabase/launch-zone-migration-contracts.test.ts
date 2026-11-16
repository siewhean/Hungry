// Source contracts for the launch zone migration (20261116130000). Its behaviour is checked by
// supabase/smoke/launch_zone.sql on staging and by the rehearsal's down and re-up round trip.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20261116130000_launch_zone.sql");
const rollback = read("supabase/rollbacks/20261116130000_launch_zone.down.sql");
const smoke = read("supabase/smoke/launch_zone.sql");
const allowlist = JSON.parse(read("supabase/rate-limit-allowlist.json")) as {
  userRpcs: Record<string, string>;
};

test("the migration is rehearsable: smoke header, no transaction control, a matching smoke", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/launch_zone\.sql/m);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im, "the runner wraps the file");
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);
});

test("the zone is the three places sh named, with the block 651 name still a placeholder", () => {
  assert.match(migration, /'jurong-west-hawker-centre', 'Jurong West Hawker Centre', 'hawker_centre'/);
  assert.match(migration, /'pioneer-mall', 'Pioneer Mall', 'mall'/);
  assert.match(migration, /array\['638A Jurong West Street 61', '638 Jurong West Street 61'\]/);
  assert.match(migration, /'block-651', 'Block 651'/);
  assert.match(migration, /array\['50 Jurong West Street 61'\]/);
  assert.match(migration, /array\['651 Jurong West Street 61'\]/);
});

test("nothing is deleted: rows move, every move and old name is backed up first", () => {
  assert.doesNotMatch(migration, /^\s*delete\s+from/im);
  assert.doesNotMatch(migration, /\bdrop\s+(table|column)/i);
  assert.match(migration, /launch_zone_building_backup/);
  assert.match(migration, /launch_zone_move_backup/);
  for (const table of ["venues", "dishes", "posts", "stall_posts", "merchant_outlets"]) {
    assert.match(migration, new RegExp(`update public\\.${table} t set building_id = m\\.survivor_id`));
  }
});

test("updated_at triggers are switched off for the move and back on, and the run is serialised", () => {
  for (const trigger of ["trg_buildings_updated_at", "trg_venues_updated_at", "trg_dishes_updated_at"]) {
    assert.match(migration, new RegExp(`disable trigger ${trigger}`));
    assert.match(migration, new RegExp(`enable trigger ${trigger}`));
    assert.match(rollback, new RegExp(`disable trigger ${trigger}`));
    assert.match(rollback, new RegExp(`enable trigger ${trigger}`));
  }
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\('launch_zone', 0\)\)/);
  assert.match(migration, /-- race-ok:/);
});

test("the zone list is for signed-in callers only, and the report is closed to the app", () => {
  assert.match(migration, /revoke all on function public\.get_launch_zone_places\(\) from public, anon;/);
  assert.match(migration, /grant execute on function public\.get_launch_zone_places\(\) to authenticated;/);
  assert.match(migration, /catalog_raw_require_authenticated\(\)/);
  assert.match(migration, /revoke all on function app_private\.launch_zone_report\(\) from public, anon, authenticated;/);
  assert.match(migration, /revoke all on function app_private\.apply_launch_zone\(\) from public, anon, authenticated;/);
  assert.match(migration, /alter table public\.launch_zone_places enable row level security;/);
  assert.ok(allowlist.userRpcs.get_launch_zone_places, "rate-limit allowlist entry with a reason");
});

test("the catalog cards take the new names at once, for live and unexpired releases only", () => {
  assert.match(migration, /update public\.catalog_raw_venue_cards c/);
  assert.match(migration, /update public\.catalog_raw_dish_cards c/);
  assert.match(migration, /r\.status = 'active' or \(r\.status = 'retired' and r\.expires_at > now\(\)\)/);
});

test("the down migration puts rows back and drops everything the up created", () => {
  assert.match(
    rollback,
    /^-- expect-row-loss: public\.launch_zone_places, app_private\.launch_zone_building_backup, app_private\.launch_zone_move_backup/m,
  );
  assert.match(rollback, /set name = k\.old_name, building_type = k\.old_type, venue_count = k\.old_venue_count/);
  for (const object of [
    "function if exists public.get_launch_zone_places()",
    "function if exists app_private.launch_zone_report()",
    "function if exists app_private.apply_launch_zone()",
    "function if exists app_private.launch_zone_sync_cards()",
    "function if exists app_private.launch_zone_members()",
    "function if exists app_private.launch_zone_definition()",
    "table if exists public.launch_zone_places",
    "table if exists app_private.launch_zone_move_backup",
    "table if exists app_private.launch_zone_building_backup",
  ]) {
    assert.ok(rollback.includes(`drop ${object};`), `down drops ${object}`);
  }
  for (const table of ["launch_zone_places", "launch_zone_building_backup", "launch_zone_move_backup"]) {
    assert.match(rollback, new RegExp(`create table rollback_archive\\.${table}_20261116130000 as`));
  }
  // The cards are refreshed from the restored rows before the backups they need are dropped.
  assert.ok(
    rollback.indexOf("launch_zone_sync_cards();") < rollback.indexOf("drop table if exists public.launch_zone_places"),
  );
});
