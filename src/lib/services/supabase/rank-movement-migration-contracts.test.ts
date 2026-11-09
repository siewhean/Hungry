// Source contracts for the rank movement migration (20261108120000). The behaviour itself is
// checked by its smoke file on staging and by the race harness (T19, T20) on a local Postgres.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const NAME = "20261108120000_leaderboard_rank_movement";
const migration = read(`supabase/migrations/${NAME}.sql`);
const rollback = read(`supabase/rollbacks/${NAME}.down.sql`);
const previous = read("supabase/migrations/20261107120000_food_portfolio_leaderboards.sql");
const raceHarness = read("supabase/race-harness/run.sh");

function fn(source: string, name: string) {
  const start = source.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `${name} is defined`);
  return source.slice(start, source.indexOf("$$;", source.indexOf("as $$", start)) + 3);
}

test("the RPC is a volatile invoker wrapper over a signed-in-only definer body, rate limited", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/leaderboard_rank_movement\.sql/m);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im, "the runner wraps the file");
  assert.match(
    migration,
    /create or replace function public\.get_my_rank_movement\(\)[\s\S]*?language sql\s+volatile\s+security invoker/,
  );
  assert.match(
    migration,
    /create or replace function app_private\.get_my_rank_movement\(\)[\s\S]*?volatile\s+security definer\s+set search_path = public, pg_temp/,
  );
  assert.match(fn(migration, "app_private.get_my_rank_movement"), /auth\.uid\(\) is not null/);
  assert.ok(
    migration.includes("revoke all on function public.get_my_rank_movement() from public, anon;"),
  );
  assert.match(migration, /\('rpc\/get_my_rank_movement', null, \d+,/);
});

test("the snapshot and the top ten row are written once, however often the jobs overlap", () => {
  assert.match(migration, /primary key \(week_start, user_id\)/);
  assert.match(
    fn(migration, "app_private.close_leaderboard_week"),
    /leaderboard_rank_snapshots[\s\S]*on conflict do nothing/,
  );
  assert.match(
    migration,
    /create unique index if not exists uniq_activity_events_board_top_ten[\s\S]*?where event_type = 'board_top_ten'/,
  );
  assert.match(
    fn(migration, "app_private.refresh_leaderboards"),
    /on conflict \(recipient_id, event_type, target_id\) where event_type = 'board_top_ten'\s+do nothing/,
  );
  for (const name of ["refresh_leaderboards", "close_leaderboard_week"]) {
    assert.match(
      fn(migration, `app_private.${name}`),
      /pg_advisory_xact_lock\(hashtextextended\('leaderboard:refresh', 0\)\)/,
      `${name} keeps the refresh lock`,
    );
  }
  assert.match(raceHarness, /T19_top_ten_rows=2/);
  assert.match(raceHarness, /T20_snapshots=2/);
});

test("the rollback restores both jobs exactly as 20261107120000 left them", () => {
  for (const name of ["app_private.refresh_leaderboards", "app_private.close_leaderboard_week"]) {
    assert.equal(fn(rollback, name), fn(previous, name), `${name} body`);
  }
  assert.match(rollback, /drop function if exists public\.get_my_rank_movement\(\);/);
  assert.match(rollback, /delete from public\.activity_events where event_type = 'board_top_ten';/);
  assert.match(rollback, /drop table if exists public\.leaderboard_rank_snapshots;/);
  assert.match(rollback, /^-- expect-row-loss: .*public\.activity_events/m);
  const restoredCheck = rollback.slice(
    rollback.indexOf("add constraint activity_events_event_type_check"),
    rollback.indexOf("));", rollback.indexOf("add constraint activity_events_event_type_check")),
  );
  assert.match(restoredCheck, /'follow_request'/);
  assert.doesNotMatch(restoredCheck, /board_top_ten/, "the type check goes back to five types");
});
