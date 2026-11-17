import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

test("raw catalog publication hold migration defines hold table with constraints and RLS", () => {
  const migration = read("supabase/migrations/20261110150000_raw_catalog_publication_hold_guards.sql");
  assert.match(migration, /create table if not exists public\.catalog_item_publication_holds/);
  assert.match(migration, /hold_scope text not null check \(hold_scope in \('whole_item', 'price_only', 'media_only', 'dietary_only'\)\)/);
  assert.match(migration, /unique \(dish_id, hold_scope\)/);
  assert.match(migration, /idx_catalog_item_publication_holds_dish/);
  assert.match(migration, /alter table public\.catalog_item_publication_holds enable row level security/);
});

test("raw catalog publisher suppresses held items and nullifies disputed prices", () => {
  const migration = read("supabase/migrations/20261110150000_raw_catalog_publication_hold_guards.sql");
  assert.match(migration, /create or replace function public\.catalog_raw_publish_release/);
  // Whole-item hold exclusion
  assert.match(migration, /where whole_hold\.dish_id is null/);
  assert.match(migration, /do not publish as a confirmed outlet menu/);
  assert.match(migration, /\[quarantined:/);
  // Price-only hold nullification
  assert.match(migration, /case when price_hold\.dish_id is not null then null else d\.price end as effective_price/);
  assert.match(migration, /case when price_hold\.dish_id is not null then null else d\.price_range end as effective_price_range/);
  // Media-only hold and unapproved media suppression
  assert.match(migration, /case when media_hold\.dish_id is not null or not coalesce\(d\.media_approved_for_display, false\) then null/);
  // Dietary-only hold suppression
  assert.match(migration, /dietary_hold\.dish_id is not null as has_dietary_hold/);
  assert.match(migration, /where not dd\.has_dietary_hold/);
  assert.match(migration, /case when dd\.has_dietary_hold then '\{\}' else coalesce\(flags\.slugs, '\{\}'\) end/);
  // Venue aggregate isolation
  assert.match(migration, /from _catalog_displayable_dishes dd/);
  assert.match(migration, /min\(dd\.effective_price\) as min_price/);
  // Retained older release hold scrubbing and legacy expiration
  assert.match(migration, /delete from public\.catalog_raw_dish_cards\s+where release_id <> v_release_id/);
  assert.match(migration, /update public\.catalog_raw_dish_cards\s+set price = null/);
  assert.match(migration, /update public\.catalog_raw_dish_cards\s+set dietary_flags = '\{\}'/);
  assert.match(migration, /update public\.catalog_releases\s+set status = 'retired', expires_at = now\(\)/);
});
