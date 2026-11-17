import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const sql = read("supabase/migrations/20261018030000_recommendation_impressions.sql");

test("impressions table is owner-only under RLS", () => {
  assert.match(sql, /create table if not exists public\.recommendation_impressions/i);
  assert.match(sql, /alter table public\.recommendation_impressions enable row level security/i);
  assert.match(
    sql,
    /for insert to authenticated\s*with check \(\(select auth\.uid\(\)\) = user_id\)/i,
  );
});

test("weekly tap rate is service-role only", () => {
  assert.match(sql, /create or replace function public\.recommendation_tap_rate/i);
  assert.match(
    sql,
    /revoke execute on function public\.recommendation_tap_rate\(integer\) from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.recommendation_tap_rate\(integer\) to service_role/i,
  );
});

test("Decide For Me logs each pick it shows", () => {
  const screen = read("src/app/screens/discover/DecideForMeResultScreen.tsx");
  assert.match(screen, /recommendations\.recordImpression\("decide", \[dish\.id\]\)/);
  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /from\("recommendation_impressions"\)/);
});
