import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("H38: profile counters are maintained by triggers and not client-writable", () => {
  const sql = read("supabase/migrations/20261021131000_profile_public_counters.sql");
  const smoke = read("supabase/smoke/profile_public_counters.sql");
  assert.match(sql, /create or replace function app_private\.refresh_user_profile_counters/);
  assert.match(sql, /count\(distinct r\.dish_id\)/);
  assert.match(sql, /usi\.is_tried/);
  assert.match(
    sql,
    /after insert or delete or update of user_id, dish_id, venue_id on public\.reviews/,
  );
  assert.match(
    sql,
    /after insert or delete or update of is_tried on public\.user_stall_interactions/,
  );
  // Client roles cannot forge the published counters.
  assert.match(sql, /before insert or update on public\.user_profiles/);
  assert.match(sql, /if current_user in \('anon', 'authenticated'\) then/);
  assert.match(sql, /new\.dishes_reviewed := old\.dishes_reviewed;/);
  // Backfill.
  assert.match(sql, /for v_user_id in select id from public\.user_profiles loop/);
  assert.match(smoke, /^begin;/m);
  assert.match(smoke, /^rollback;/m);
  assert.match(smoke, /set dishes_reviewed = 999/);
});

test("H39: private profiles hide their review list and say they are private", () => {
  const sql = read("supabase/migrations/20261021132000_private_profile_card_and_reviews.sql");
  const reviewsFn = /create or replace function public\.get_user_profile_reviews[\s\S]*?\$\$;/.exec(
    sql,
  )?.[0];
  assert.ok(reviewsFn);
  assert.match(reviewsFn, /security invoker/);
  assert.match(reviewsFn, /app_private\.can_read_author_content\(p_user_id\)/);
  const cardBody = /create or replace function app_private\.get_profile_card[\s\S]*?\$\$;/.exec(
    sql,
  )?.[0];
  const cardWrapper = /create or replace function public\.get_profile_card[\s\S]*?\$\$;/.exec(
    sql,
  )?.[0];
  assert.ok(cardBody && cardWrapper);
  assert.match(cardBody, /security definer/);
  assert.match(cardWrapper, /security invoker/);
  assert.match(cardBody, /not app_private\.app_user_block_exists\(auth\.uid\(\), up\.id\)/);
  // Dish pages are untouched: no change to the reviews select policies.
  assert.doesNotMatch(sql, /create policy|drop policy/i);

  const service = read("src/lib/services/supabase/supabaseService.ts");
  assert.match(service, /\.rpc\("get_user_profile_reviews", \{ p_user_id: userId \}\)/);
  assert.match(service, /client\.rpc\("get_profile_card", \{ p_user_id: userId \}\)/);

  const content = read("src/app/screens/profile/UserProfileContent.tsx");
  assert.match(content, /publicProfile\?\.isPrivate === true/);
  assert.match(content, /title="This account is private"/);

  const settings = read("src/app/screens/profile/SettingsScreen.tsx");
  assert.match(settings, /Your reviews still show on dish pages\./);
});
