// Source contracts for the social graph migration (20261107180000): followers and following
// back on, taste matches, people suggestions, Home network picks and Compare palates.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20261107180000_social_profiles_network_picks.sql");
const rollback = read("supabase/rollbacks/20261107180000_social_profiles_network_picks.down.sql");

const RPCS = [
  ["get_profile_relationship", "uuid"],
  ["get_taste_matches", "uuid[]"],
  ["get_people_suggestions", "integer"],
  ["get_network_stall_picks", "integer"],
  ["get_taste_comparison", "uuid"],
] as const;

function bodyOf(name: string): string {
  const start = migration.indexOf(`create or replace function app_private.${name}(`);
  assert.ok(start >= 0, `${name} body exists`);
  return migration.slice(start, migration.indexOf("$$;", migration.indexOf("as $$", start)));
}

test("each RPC is a volatile invoker wrapper over a pinned definer body, signed-in only, rate limited", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/social_profiles_network_picks\.sql/m);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im, "the runner wraps the file");
  assert.match(migration, /notify pgrst, 'reload schema';/);
  for (const [name, args] of RPCS) {
    assert.match(
      migration,
      new RegExp(
        `create or replace function public\\.${name}\\([\\s\\S]*?language sql\\s+volatile\\s+security invoker`,
      ),
      `${name} wrapper is volatile and invoker`,
    );
    assert.match(
      migration,
      new RegExp(
        `create or replace function app_private\\.${name}\\([\\s\\S]*?volatile\\s+security definer\\s+set search_path = public, pg_temp`,
      ),
      `${name} body is a pinned-search-path definer`,
    );
    const escaped = args.replace(/[[\]]/g, "\\$&");
    assert.match(
      migration,
      new RegExp(`revoke all on function public\\.${name}\\(${escaped}\\) from public, anon;`),
      `anon cannot run ${name}`,
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on function app_private\\.${name}\\(${escaped}\\) from public, anon, authenticated;`,
      ),
    );
    assert.match(migration, new RegExp(`\\('rpc/${name}', null, \\d+,`), `${name} has a rate rule`);
    assert.match(
      rollback,
      new RegExp(`drop function if exists public\\.${name}\\(`),
      `down drops ${name}`,
    );
    assert.match(rollback, new RegExp(`drop function if exists app_private\\.${name}\\(`));
  }
});

test("the rollback archives the rate rules before deleting them", () => {
  assert.match(rollback, /-- expect-row-loss: app_private\.request_rate_rules/);
  assert.match(rollback, /rollback_archive\.request_rate_rules_20261107180000/);
  assert.ok(
    rollback.indexOf("rollback_archive.request_rate_rules_20261107180000") <
      rollback.indexOf("delete from app_private.request_rate_rules"),
  );
  assert.match(rollback, /drop function if exists app_private\.taste_match_score\(/);
});

test("reads respect blocks, deactivated accounts and private profiles", () => {
  const relationship = bodyOf("get_profile_relationship");
  assert.match(relationship, /app_user_block_exists/);
  assert.match(relationship, /account_is_deactivated/);
  assert.match(relationship, /can_read_author_content\(p_user_id\)/, "mutuals only when readable");

  assert.match(bodyOf("get_taste_matches"), /can_read_author_content/);
  assert.match(bodyOf("get_taste_matches"), /<= 200/, "at most 200 people per call");
  assert.match(bodyOf("get_taste_comparison"), /can_read_author_content\(p_user_id\)/);

  const suggestions = bodyOf("get_people_suggestions");
  assert.match(suggestions, /account_is_deactivated/);
  assert.match(suggestions, /app_user_block_exists/);
  assert.match(suggestions, /least\(greatest\(coalesce\(p_limit, 20\), 1\), 50\)/);

  const picks = bodyOf("get_network_stall_picks");
  assert.match(picks, /review_moderation_states/, "hidden or removed reviews never count");
  assert.match(picks, /post_moderation_states/);
  assert.match(picks, /least\(greatest\(coalesce\(p_limit, 30\), 1\), 60\)/);
  assert.doesNotMatch(picks, /favourite|saved_dishes/i, "saves stay private: never a signal");
});
