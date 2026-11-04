// Security review 2026-11-04: database fixes in 20261104120000_security_review_hardening.sql.
// The behaviour itself is checked by supabase/smoke/security_review_hardening.sql on staging;
// these keep the pieces from being dropped or weakened by a later edit.
import assert from "node:assert/strict";
import test from "node:test";

import { readRepoFile } from "@/test/sourceContracts";

const up = readRepoFile("supabase/migrations/20261104120000_security_review_hardening.sql");
const down = readRepoFile("supabase/rollbacks/20261104120000_security_review_hardening.down.sql");
const previousHook = readRepoFile("supabase/migrations/20261022120000_api_request_rate_limits.sql");

test("the request hook refuses API writes to PostGIS's tables, escaped paths included", () => {
  assert.match(up, /create or replace function app_private\.check_request_rate\(\)/);
  assert.match(up, /v_target in \('spatial_ref_sys', 'geometry_columns', 'geography_columns'\)/);
  assert.match(up, /"status":403/);
  assert.match(up, /while v_target ~ '%\[0-9a-f\]\{2\}' loop/);
  // The block runs only for writes and before the GET early return, and service_role skips it.
  const block = up.indexOf("if v_method not in ('GET', 'HEAD') then");
  assert.ok(block > up.indexOf("if v_role not in ('anon', 'authenticated') then"));
  assert.ok(block < up.indexOf("if v_method in ('GET', 'HEAD') then"));
  // Rate limiting is unchanged.
  assert.match(up, /v_over := v_hits > v_cap;/);
  assert.match(up, /exception when others then\s+-- Fail open\./);
});

test("app inserts into reviews cannot set server-owned fields", () => {
  assert.match(
    up,
    /create trigger trg_reviews_reset_server_fields\s+before insert on public\.reviews/,
  );
  for (const line of [
    "new.merchant_reply_text := null;",
    "new.merchant_replied_at := null;",
    "new.helpful_count := 0;",
    "new.created_at := now();",
    "new.edited_at := null;",
  ]) {
    assert.ok(up.includes(line), `missing ${line}`);
  }
  assert.match(up, /if current_user in \('anon', 'authenticated'\) then/);
});

test("a new profile photo must be in the caller's own avatars folder in this project", () => {
  assert.match(
    up,
    /create trigger trg_user_profiles_check_avatar_url\s+before insert or update of avatar_url on public\.user_profiles/,
  );
  assert.match(up, /'\/storage\/v1\/object\/public\/avatars\/' \|\| new\.id::text \|\| '\/'/);
  assert.match(up, /->> 'iss'/);
  assert.match(up, /hint = 'avatar_url_not_allowed'/);
});

test("the two ops functions are service_role only", () => {
  for (const fn of [
    "public.promote_staging_to_production(uuid)",
    "public.set_post_moderation_state(uuid, text, text, uuid, jsonb)",
  ]) {
    assert.ok(up.includes(`revoke execute on function ${fn} from public, anon, authenticated;`));
    assert.ok(up.includes(`grant execute on function ${fn} to service_role;`));
  }
});

test("the down migration restores the previous hook body and removes the new triggers", () => {
  const start = previousHook.indexOf("create or replace function app_private.check_request_rate()");
  const end = previousHook.indexOf("revoke all on function app_private.check_request_rate()");
  assert.ok(down.includes(previousHook.slice(start, end).trim()));
  assert.doesNotMatch(down, /spatial_ref_sys/);
  assert.match(down, /drop trigger if exists trg_reviews_reset_server_fields on public\.reviews;/);
  assert.match(
    down,
    /drop trigger if exists trg_user_profiles_check_avatar_url on public\.user_profiles;/,
  );
  assert.doesNotMatch(down, /^\s*(begin|commit);/im);
  assert.doesNotMatch(up, /^\s*(begin|commit);/im);
});
