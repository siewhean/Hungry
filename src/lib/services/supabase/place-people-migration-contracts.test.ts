// Source contracts for the People here migration (20261109090000): get_place_people is a
// signed-in, rate-limited read of who reviewed or posted at one stall or one dish, followed first,
// that never shows the viewer, blocked or deactivated people, or hidden reviews and posts.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20261109090000_place_people.sql");
const rollback = read("supabase/rollbacks/20261109090000_place_people.down.sql");
const smoke = read("supabase/smoke/place_people.sql");
const ARGS = "text, text, integer";

test("get_place_people is a volatile invoker wrapper over a pinned definer body, signed-in only", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/place_people\.sql/m);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im, "the runner wraps the file");
  assert.match(
    migration,
    /create or replace function public\.get_place_people\([\s\S]*?language sql\s+volatile\s+security invoker/,
  );
  assert.match(
    migration,
    /create or replace function app_private\.get_place_people\([\s\S]*?volatile\s+security definer\s+set search_path = public, pg_temp/,
  );
  assert.match(
    migration,
    new RegExp(
      `revoke all on function public\\.get_place_people\\(${ARGS}\\)\\s+from public, anon;`,
    ),
  );
  assert.match(
    migration,
    new RegExp(
      `revoke all on function app_private\\.get_place_people\\(${ARGS}\\)\\s+from public, anon, authenticated;`,
    ),
  );
  assert.match(
    migration,
    /\('rpc\/get_place_people', null, 60,/,
    "60 a minute for a signed-in user",
  );
  assert.match(migration, /notify pgrst, 'reload schema';/);
});

test("the read leaves out the viewer, blocks, deactivated accounts and hidden content", () => {
  assert.match(migration, /s\.person_id <> v\.id/);
  assert.match(migration, /app_user_block_exists\(v\.id, s\.person_id\)/);
  assert.match(migration, /account_is_deactivated\(s\.person_id\)/);
  assert.match(migration, /review_moderation_states/);
  assert.match(migration, /post_moderation_states/);
  assert.match(
    migration,
    /app_private\.can_read_post\(p\.id\)/,
    "private authors' posts stay private",
  );
  assert.match(migration, /p\.status = 'published'/);
  assert.match(migration, /order by rk\.is_followed desc, rk\.contributions desc/);
  assert.match(migration, /least\(coalesce\(p_limit, 5\), 10\)/, "at most ten people");
  assert.doesNotMatch(
    migration,
    /favourite|saved_dishes|email|phone/i,
    "no private signals or details",
  );
});

test("the rollback archives the rate rule before deleting it, and the smoke covers the rules", () => {
  assert.match(rollback, /-- expect-row-loss: app_private\.request_rate_rules/);
  assert.ok(
    rollback.indexOf("rollback_archive.request_rate_rules_20261109090000") <
      rollback.indexOf("delete from app_private.request_rate_rules"),
  );
  assert.match(
    rollback,
    new RegExp(`drop function if exists public\\.get_place_people\\(${ARGS}\\)`),
  );
  assert.match(
    rollback,
    new RegExp(`drop function if exists app_private\\.get_place_people\\(${ARGS}\\)`),
  );
  assert.match(smoke, /insufficient_privilege/, "anon is refused");
  assert.match(smoke, /rpc\/get_place_people/, "the rate rule exists");
  assert.match(smoke, /^rollback;/m);
});
