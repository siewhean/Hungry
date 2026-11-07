// Source contracts for the new-dishes digest migration (20261107150000). The behaviour is checked
// by its smoke file on staging.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (file: string) => readFileSync(file, "utf8");
const migration = read("supabase/migrations/20261107150000_following_new_dishes_digest.sql");
const code = migration.replace(/--.*$/gm, "");
const rollback = read("supabase/rollbacks/20261107150000_following_new_dishes_digest.down.sql");

test("the digest is a new social category, so the worker's opt-out, quiet hours and cap apply", () => {
  assert.match(migration, /^-- smoke: supabase\/smoke\/following_new_dishes_digest\.sql/m);
  assert.doesNotMatch(migration, /^\s*(begin|commit);/im, "the runner wraps the file");
  assert.match(migration, /'social_like_digest',\s*'social_new_dishes_digest'/);
  assert.match(migration, /'like_digest',\s*'new_dishes_digest'/);
  assert.doesNotMatch(rollback, /'social_new_dishes_digest'\s*\)\);/, "down restores the old list");
});

test("one grouped insert per run, deduped per follower per Singapore day", () => {
  assert.doesNotMatch(code, /\bfor\s+\w+\s+in\b|\bloop\b/i, "no per-follower loop");
  assert.match(migration, /f\.status = 'approved'/);
  assert.match(migration, /p\.visibility in \('public', 'followers'\)/);
  assert.match(migration, /app_private\.app_user_block_exists\(f\.follower_id, p\.author_id\)/);
  assert.match(migration, /app_private\.account_is_deactivated\(p\.author_id\)/);
  assert.match(migration, /'social_new_dishes_digest', v_today::text/);
  assert.match(migration, /on conflict \(dedupe_key\) do nothing/);
  assert.match(migration, /coalesce\(np\.social_activity, true\)/);
  assert.match(migration, /'https:\/\/usehungry\.com\/following'/);
});

test("only the service role runs it, on an 18:00 Singapore cron, and down undoes all of it", () => {
  assert.ok(
    migration.includes(
      "revoke all on function public.enqueue_social_new_dishes_digest_notifications()\n  from public, anon, authenticated;",
    ),
  );
  assert.match(migration, /'social-new-dishes-digest-notifications',\s+'0 10 \* \* \*'/);
  assert.match(rollback, /cron\.unschedule\('social-new-dishes-digest-notifications'\)/);
  assert.match(
    rollback,
    /drop function if exists public\.enqueue_social_new_dishes_digest_notifications\(\)/,
  );
  assert.match(rollback, /-- expect-row-loss: public\.notification_jobs/);
  assert.match(rollback, /rollback_archive\.notification_jobs_20261107150000/);
});
