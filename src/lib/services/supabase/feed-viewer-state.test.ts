import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("feed v3 adds viewer like/save state as an invoker wrapper over v2", () => {
  const sql = read("supabase/migrations/20261019120000_home_feed_viewer_state.sql");
  const smoke = read("supabase/smoke/home_feed_viewer_state.sql");
  assert.match(sql, /create or replace function public\.get_home_social_feed_v3/);
  assert.match(sql, /security invoker/);
  assert.doesNotMatch(sql, /security definer/);
  assert.match(sql, /viewer_has_liked boolean/);
  assert.match(sql, /viewer_has_saved boolean/);
  assert.match(sql, /from public\.get_home_social_feed_v2\(/);
  assert.match(sql, /revoke all on function public\.get_home_social_feed_v3[^;]+from public, anon/);
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);
});

test("get_post_by_id keeps the definer body in app_private behind an invoker wrapper", () => {
  const sql = read("supabase/migrations/20261019121000_get_post_by_id.sql");
  const smoke = read("supabase/smoke/get_post_by_id.sql");
  const privateBody = /create or replace function app_private\.get_post_by_id[\s\S]*?\$\$;/.exec(
    sql,
  )?.[0];
  const publicBody = /create or replace function public\.get_post_by_id[\s\S]*?\$\$;/.exec(
    sql,
  )?.[0];
  assert.ok(privateBody && publicBody);
  assert.match(privateBody, /security definer/);
  assert.match(publicBody, /security invoker/);
  assert.doesNotMatch(publicBody, /security definer/);
  // Visitors only read public posts by public accounts; moderation and hides apply.
  assert.match(privateBody, /auth\.uid\(\) is null\s+and p\.visibility = 'public'/);
  assert.match(privateBody, /app_private\.can_read_author_content\(p\.author_id\)/);
  assert.match(privateBody, /app_private\.can_read_post\(p\.id\)/);
  assert.match(privateBody, /pms\.state in \('hidden', 'removed'\)/);
  assert.match(privateBody, /from public\.hidden_posts hp/);
  assert.match(
    sql,
    /grant execute on function public\.get_post_by_id\(uuid\) to anon, authenticated/,
  );
  assert.match(smoke, /set local role anon/);
  assert.match(smoke, /^rollback;/m);
});

test("post share channels accept WhatsApp and Telegram", () => {
  const sql = read("supabase/migrations/20261019122000_post_share_messaging_channels.sql");
  assert.match(sql, /'whatsapp', 'telegram'/);
  assert.match(read("supabase/smoke/post_share_messaging_channels.sql"), /^rollback;/m);
});

test("services expose getPostById and an idempotent reactToBite in mock and Supabase", () => {
  const types = read("src/lib/services/types.ts");
  const supabase = read("src/lib/services/supabase/supabaseService.ts");
  const mock = read("src/lib/services/mock/mockService.ts");
  assert.match(types, /getPostById\(postId: string\): Promise<Bite \| null>/);
  assert.match(
    types,
    /reactToBite\(biteId: string, reaction: "craving" \| "save", active: boolean\)/,
  );
  assert.match(supabase, /client\.rpc\("get_post_by_id", \{ p_post_id: postId \}\)/);
  assert.match(mock, /async getPostById\(postId: string\)/);
  assert.match(mock, /async reactToBite\(biteId, reaction, active\)/);
  assert.match(mock, /withMockViewerReactions/);
});

test("a feed read that started before a like/save write settled does not overwrite it", () => {
  const store = read("src/store/useSocialStore.ts");
  const home = read("src/app/screens/home/HomeFeedScreen.tsx");
  assert.match(store, /lastReactionSettledAt\.set\(postId, Date\.now\(\)\)/);
  assert.match(store, /settledAt >= readStartedAt/);
  assert.match(store, /!pendingReactionCounts\.has\(item\.id\) &&\s*!readPredatesWrite/);
  // The feed passes the time its read started.
  assert.match(home, /section\.items\)\],\s*now,\s*\)/);
});
