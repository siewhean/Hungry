// Round-two merchant critical: removing a dish must not cascade-delete diner reviews and saves.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = read("supabase/migrations/20261021090000_merchant_dish_archive.sql");
const service = read("src/lib/services/supabase/supabaseService.ts");

test("merchant deleteDish archives through merchant_remove_dish instead of a hard DELETE", () => {
  const deleteDish = service.slice(
    service.indexOf("async deleteDish("),
    service.indexOf("async toggleSoldOut("),
  );
  assert.match(deleteDish, /rpc\("merchant_remove_dish"/);
  assert.doesNotMatch(deleteDish, /\.delete\(\)/);
  assert.match(service, /\.eq\("venue_id", venueId\)\s*\.is\("archived_at", null\)/);
});

test("merchants can hard-delete drafts only, and archived dishes leave the catalog and search", () => {
  assert.match(migration, /add column if not exists archived_at timestamptz/);
  assert.match(migration, /if tg_op = 'DELETE' and not old\.merchant_draft then\s+raise exception/);
  assert.match(migration, /set archived_at = coalesce\(d\.archived_at, now\(\)\)/);
  assert.match(migration, /d\.merchant_draft or d\.archived_at is not null/);
  assert.match(migration, /not d\.merchant_draft and d\.archived_at is null/);
  assert.match(
    migration,
    /create or replace function public\.search_dishes\([\s\S]*and d\.archived_at is null/,
  );
});
