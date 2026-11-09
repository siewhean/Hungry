// Source contracts for the portfolio ranking migration (20261109150000): a ranking of any length,
// one atomic UPDATE per ranked dish, and a rank label on reviews only for a top-three dish in a
// portfolio of at least five dishes.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20261109150000_portfolio_ranking.sql");
const rollback = read("supabase/rollbacks/20261109150000_portfolio_ranking.down.sql");
const smoke = read("supabase/smoke/portfolio_ranking.sql");

const RPCS = [
  ["rank_portfolio_post", "uuid, integer"],
  ["get_my_portfolio_ranking", ""],
  ["get_review_portfolio_ranks", "uuid\\[\\]"],
] as const;

test("each new RPC is a volatile invoker wrapper over a pinned definer body, signed-in only, rate limited", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/portfolio_ranking\.sql/m);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im, "the runner wraps the file");
  for (const [name, args] of RPCS) {
    assert.match(
      migration,
      new RegExp(
        `create or replace function public\\.${name}\\([\\s\\S]*?language sql\\s+volatile\\s+security invoker`,
      ),
      `${name} wrapper`,
    );
    assert.match(
      migration,
      new RegExp(
        `create or replace function app_private\\.${name}\\([\\s\\S]*?volatile\\s+security definer\\s+set search_path = public, pg_temp`,
      ),
      `${name} body`,
    );
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${name}\\(${args}\\) from public, anon;`),
    );
    assert.match(migration, new RegExp(`'rpc/${name}', null, \\d+,`), `${name} rate rule`);
  }
  assert.match(migration, /notify pgrst, 'reload schema';/);
});

test("ranking one dish is one UPDATE from the committed row, capped at 200, own published posts only", () => {
  const body = migration.slice(migration.indexOf("function app_private.rank_portfolio_post"));
  assert.match(body, /update public\.user_profiles up\s+set pinned_post_ids = \(/);
  assert.match(body, /cardinality\(array_remove\(up\.pinned_post_ids, p_post_id\)\) < 200/);
  assert.match(body, /p\.author_id = v_user/);
  assert.match(body, /p\.status = 'published'/);
  assert.match(migration, /check \(cardinality\(pinned_post_ids\) <= 200\)/);
  assert.match(migration, /drop constraint if exists user_profiles_pinned_post_ids_max_three/);
});

test("set_pinned_posts still sets only the top three and keeps what is ranked below", () => {
  const body = migration.slice(
    migration.indexOf("function app_private.set_pinned_posts"),
    migration.indexOf("function app_private.rank_portfolio_post"),
  );
  assert.match(body, /> 3 then\s+raise exception 'Pin up to three dishes\.'/);
  assert.match(body, /t\.ord > 3/, "the old fourth place onwards is kept");
});

test("the review label needs a top-three place, five dishes, and a post the viewer can read", () => {
  const body = migration.slice(
    migration.indexOf("function app_private.get_review_portfolio_ranks"),
  );
  assert.match(body, /ranked\.place <= 3/);
  assert.match(body, /counts\.dish_count >= 5/);
  assert.match(body, /count\(distinct p\.dish_id\)/, "dishes, not posts");
  assert.match(body, /app_private\.can_read_post\(ranked\.post_id\)/);
  assert.match(body, /post_moderation_states/);
  assert.match(body, /p_review_ids\[1:50\]/, "one batch of at most 50 reviews");
  assert.match(body, /auth\.uid\(\) is not null/);
});

test("the rollback cuts rankings back to three after archiving them, and archives the rate rules", () => {
  assert.match(rollback, /-- expect-row-loss: app_private\.request_rate_rules/);
  assert.ok(
    rollback.indexOf("rollback_archive.user_profiles_pinned_post_ids_20261109150000") <
      rollback.indexOf("pinned_post_ids[1:3]"),
    "archived before it is cut",
  );
  assert.ok(
    rollback.indexOf("rollback_archive.request_rate_rules_20261109150000") <
      rollback.indexOf("delete from app_private.request_rate_rules"),
  );
  assert.match(rollback, /user_profiles_pinned_post_ids_max_three/);
  for (const [name] of RPCS)
    assert.match(rollback, new RegExp(`drop function if exists public\\.${name}\\(`));
});

test("the smoke covers ranking, the five-dish rule, the top-three rule, grants and rate rules", () => {
  assert.match(smoke, /rank_portfolio_post/);
  assert.match(smoke, /expected only 1:1:6/);
  assert.match(smoke, /has_function_privilege\('anon'/);
  assert.match(smoke, /request_rate_rules/);
  assert.match(smoke, /^rollback;/m);
});
