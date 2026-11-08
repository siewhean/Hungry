// Source contracts for the leaderboard migration (20261107120000). The behaviour itself is
// checked by its smoke file on staging and by the race harness (T15 to T18) on a local Postgres.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20261107120000_food_portfolio_leaderboards.sql");
const rollback = read("supabase/rollbacks/20261107120000_food_portfolio_leaderboards.down.sql");
const raceHarness = read("supabase/race-harness/run.sh");

function body(name: string) {
  const start = migration.indexOf(`create or replace function ${name}(`);
  assert.ok(start >= 0, `${name} is defined`);
  return migration.slice(start, migration.indexOf("$$;", migration.indexOf("as $$", start)));
}

const RPCS = [
  ["get_leaderboard", "text, text, text, integer"],
  ["get_my_leaderboard_summary", ""],
  ["get_my_portfolio_points", "integer"],
] as const;

test("each RPC is a volatile invoker wrapper over a definer body, signed-in only, rate limited", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/food_portfolio_leaderboards\.sql/m);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im, "the runner wraps the file");
  for (const [name, args] of RPCS) {
    assert.match(
      migration,
      new RegExp(
        `create or replace function public\\.${name}\\([\\s\\S]*?language sql\\s+volatile\\s+security invoker`,
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `create or replace function app_private\\.${name}\\([\\s\\S]*?volatile\\s+security definer\\s+set search_path = public, pg_temp`,
      ),
    );
    assert.match(
      body(`app_private.${name}`),
      /auth\.uid\(\) is not null/,
      `${name}: signed-in only`,
    );
    assert.ok(
      migration.includes(`revoke all on function public.${name}(${args}) from public, anon;`),
      `anon cannot run ${name}`,
    );
    assert.match(migration, new RegExp(`\\('rpc/${name}', null, \\d+,`), `${name} has a rate rule`);
    assert.match(rollback, new RegExp(`drop function if exists public\\.${name}\\(`));
  }
  assert.ok(
    migration.includes(
      "revoke all on function public.exclude_from_leaderboards(uuid, text, timestamptz) from public, anon, authenticated;",
    ),
    "only the service role can exclude someone",
  );
});

test("the ledger tables are closed to the app: RLS on, no grants to anon or authenticated", () => {
  for (const table of [
    "leaderboard_events",
    "leaderboard_standings",
    "leaderboard_exclusions",
    "leaderboard_week_results",
    "achievement_unlocks",
  ]) {
    assert.ok(migration.includes(`alter table public.${table} enable row level security;`), table);
    assert.match(rollback, new RegExp(`drop table if exists public\\.${table};`));
    assert.match(rollback, new RegExp(`-- expect-row-loss: public\\.${table}`));
  }
  assert.match(
    migration,
    /from public, anon, authenticated;\ngrant all on table public\.leaderboard_events/,
  );
});

test("post credit holds the daily cap and stall cooldown under a per-author lock", () => {
  const credit = body("app_private.credit_post_board_points");
  assert.match(
    credit,
    /pg_advisory_xact_lock\(hashtextextended\('board:' \|\| new\.author_id::text, 0\)\)/,
  );
  assert.match(
    credit,
    /pg_advisory_xact_lock\(hashtextextended\('board-dish:' \|\| new\.dish_id, 0\)\)/,
  );
  assert.ok(
    credit.indexOf("pg_advisory_xact_lock") <
      credit.indexOf("select count(*) into v_credited_today"),
    "the lock comes before the cap is counted",
  );
  assert.match(credit, /v_credited_today >= 6 or v_on_cooldown/);
  assert.match(credit, /interval '30 minutes'/);
  assert.match(credit, /media_type = 'image'/, "no photo, no board credit");
  assert.match(credit, /'off_board_post', 2/);
});

test("engagement is one row a day per actor, never your own, and locks the post against a delete", () => {
  assert.match(
    migration,
    /create unique index if not exists uniq_leaderboard_events_engagement_daily\s+on public\.leaderboard_events \(user_id, kind, actor_id, event_day\)/,
  );
  const engagement = body("app_private.credit_engagement_board_points");
  assert.match(engagement, /for no key update of p/);
  assert.match(engagement, /v_actor = v_target/);
  assert.match(engagement, /app_user_block_exists\(v_actor, v_target\)/);
  assert.match(engagement, /leaderboard_actor_is_eligible\(v_actor\)/);
  assert.match(engagement, /on conflict \(user_id, kind, actor_id, event_day\)/);
});

test("refresh and the weekly close are serialised, idempotent and scheduled", () => {
  assert.match(
    body("app_private.refresh_leaderboards"),
    /hashtextextended\('leaderboard:refresh', 0\)/,
  );
  assert.match(
    body("app_private.close_leaderboard_week"),
    /hashtextextended\('leaderboard:refresh', 0\)/,
  );
  assert.match(body("app_private.close_leaderboard_week"), /on conflict do nothing/);
  assert.match(
    body("app_private.unlock_board_achievements"),
    /on conflict do nothing\s+returning user_id, achievement_id, tier/,
  );
  assert.match(migration, /cron\.schedule\(\s+'refresh-leaderboards',\s+'\*\/10 \* \* \* \*'/);
  assert.match(migration, /cron\.schedule\(\s+'close-leaderboard-week',\s+'5 16 \* \* 0'/);
  assert.match(rollback, /cron\.unschedule\('refresh-leaderboards'\)/);
  assert.match(rollback, /cron\.unschedule\('close-leaderboard-week'\)/);
});

test("the race harness replays the four leaderboard races", () => {
  for (const key of [
    "T15_credited=6",
    "T16_like_rows=1",
    "T17_live_rows=0",
    "T18_achievement_rows=2",
  ]) {
    assert.ok(raceHarness.includes(key), key);
  }
});
