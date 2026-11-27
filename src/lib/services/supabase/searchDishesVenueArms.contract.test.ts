import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "../../../..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const up = read("supabase/migrations/20261124120000_split_stall_detail_reads.sql");
const down = read("supabase/rollbacks/20261124120000_split_stall_detail_reads.down.sql");
const smoke = read("supabase/smoke/split_stall_detail_reads.sql");

test("search_dishes candidate arms are split so a stall menu reads only that stall", () => {
  // The old predicate sat behind the params CTE, so the planner scanned every dish.
  assert.match(up, /v_venue_or constant text := '\(params\.venue_id is null or d\.venue_id = params\.venue_id\)'/);
  assert.match(up, /d\.venue_id = nullif\(p_venue_id, ''''\)/);
  assert.match(up, /venue-scoped arms: p_venue_id is set/);
  // Arms that do not apply are gated on function arguments, so they never run.
  assert.match(up, /nullif\(p_venue_id, ''''\) is null/);
  assert.match(up, /nullif\(trim\(coalesce\(p_query, ''''\)\), ''''\) is not null/);
  assert.match(up, /exists \(select 1 from query_area_match\)/);
  // The migration refuses to patch a body whose arms it does not recognise.
  assert.match(up, /search_dishes candidate arms differ from the expected definition/);
});

test("rollback restores the original arms and still checks the known bodies", () => {
  assert.match(down, /venue-scoped arms: p_venue_id is set/);
  assert.match(down, /v_noquery_gate, 'params\.query is null'/);
  assert.match(down, /v_unscoped, v_venue_or/);
  assert.match(down, /md5\(v_original_dishes_body\) = any\(v_known_dishes_bodies\)/);
});

test("smoke proves the stall-scoped search still finds dishes", () => {
  assert.match(smoke, /p_query => 'Smoke SDR Dish 12', p_venue_id => 'smoke-sdr-menu'/);
  assert.match(smoke, /venue-scoped arms: p_venue_id is set/);
});
