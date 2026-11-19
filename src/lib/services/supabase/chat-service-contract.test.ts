import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("Supabase chat smoke script is explicit, cleanup-safe, and service-role gated", () => {
  const script = read("scripts/supabase-chat-smoke.mjs");
  const packageJson = read("package.json");

  assert.match(packageJson, /"smoke:supabase-chat": "node scripts\/supabase-chat-smoke\.mjs"/);
  assert.match(script, /HUNGRY_SUPABASE_SMOKE_URL/);
  assert.match(script, /HUNGRY_SUPABASE_SMOKE_ANON_KEY/);
  assert.match(script, /HUNGRY_SUPABASE_SMOKE_SERVICE_ROLE_KEY/);
  assert.match(script, /HUNGRY_SUPABASE_SMOKE_PROJECT_REF/);
  assert.match(script, /HUNGRY_SUPABASE_ALLOWED_HOSTS/);
  assert.match(script, /is not in \$\{ALLOWED_HOSTS_ENV\}/);
  assert.match(script, /HUNGRY_ALLOW_SERVICE_ROLE_SMOKE/);
  assert.match(script, /assertSmokeTargetIsAllowed/);
  assert.match(script, /hostname\.split\("\."\)\[0\]/);
  assert.match(script, /auth\.admin\.createUser/);
  assert.match(script, /auth\.admin\.deleteUser/);
  assert.match(script, /cleanup failed/);
  assert.match(script, /users\.push\(userA\)/);
  assert.match(script, /\.rpc\("open_chat_conversation"/);
  assert.match(script, /\.rpc\("send_chat_message"/);
  assert.match(script, /\.from\("conversations"\)/);
  assert.match(script, /\.from\("conversation_participants"\)/);
  assert.match(script, /\.from\("messages"\)/);
  assert.match(script, /\.from\("read_receipts"\)/);
  assert.match(script, /clientC[\s\S]*user C could read a conversation/);
  assert.match(script, /user C non-participant message RPC/);
  assert.match(script, /participant direct message insert/);
  assert.match(script, /user C non-participant read receipt insert/);
  assert.match(script, /removeChannel/);
  assert.doesNotMatch(script, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(script, /EXPO_PUBLIC_SUPABASE_URL/);
  assert.doesNotMatch(script, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
});

test("Supabase chat backend keeps its checked open-conversation RPC and Realtime-safe receipts", () => {
  const migration = read("supabase/migrations/20260524023000_chat_conversation_open_rpc.sql");
  const wrapperMigration = read(
    "supabase/migrations/20260524024500_chat_open_conversation_private_wrapper.sql",
  );

  assert.match(migration, /alter table if exists public\.read_receipts replica identity full/i);
  assert.match(migration, /create or replace function public\.open_chat_conversation/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = public/i);
  assert.match(migration, /public\.app_user_block_exists/i);
  assert.match(migration, /on conflict \(dedupe_key\)/i);
  assert.match(wrapperMigration, /alter function public\.open_chat_conversation/i);
  assert.match(
    wrapperMigration,
    /grant usage on schema app_private to authenticated, service_role/i,
  );
  assert.match(wrapperMigration, /set schema app_private/i);
  assert.match(wrapperMigration, /create or replace function public\.open_chat_conversation/i);
  assert.match(wrapperMigration, /security invoker/i);
  assert.match(wrapperMigration, /from app_private\.open_chat_conversation/i);
  assert.match(wrapperMigration, /grant execute[\s\S]*to authenticated, service_role/i);
  assert.match(wrapperMigration, /revoke all[\s\S]*from public, anon, authenticated/i);
});
