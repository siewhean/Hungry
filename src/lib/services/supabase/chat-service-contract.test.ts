import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function read(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

test("HungryService exposes participant chat methods", () => {
  const types = read("src/lib/services/types.ts");

  assert.match(types, /export interface ChatConversation/);
  assert.match(types, /export interface ChatMessage/);
  assert.match(types, /export interface ChatParticipant/);
  assert.match(types, /chat: \{/);
  assert.match(types, /listConversations\(\): Promise<ChatConversation\[\]>/);
  assert.match(types, /openConversation\(input: OpenChatConversationInput\)/);
  assert.match(types, /listMessages\(conversationId: string\): Promise<ChatMessage\[\]>/);
  assert.match(types, /sendMessage\(input: SendChatMessageInput\): Promise<ChatMessage>/);
  assert.match(types, /markConversationRead\(conversationId: string\): Promise<void>/);
  assert.match(types, /subscribeToConversation/);
});

test("Supabase chat service uses shared conversation tables and realtime", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const markReadBlock =
    service.match(
      /async markConversationRead\(conversationId\)[\s\S]*?subscribeToConversation/,
    )?.[0] ?? "";

  assert.match(service, /chat: \{/);
  assert.match(service, /\.from\("conversation_participants"\)/);
  assert.match(service, /\.from\("conversations"\)/);
  assert.match(service, /\.from\("messages"\)/);
  assert.match(service, /\.from\("read_receipts"\)/);
  assert.match(service, /buildConversationDedupeKey/);
  assert.match(service, /markConversationRead\(conversationId\)/);
  assert.match(service, /listReadReceiptsForMessages/);
  assert.match(markReadBlock, /\.from\("read_receipts"\)\.insert\(missingReceiptRows\)/);
  assert.match(service, /\.channel\(`conversation:\$\{conversationId\}`\)/);
  assert.match(service, /table: "messages"/);
  assert.match(service, /table: "read_receipts"/);
  assert.doesNotMatch(service, /chat_messages/);
  assert.doesNotMatch(markReadBlock, /\.upsert/);
});

test("Mock service keeps chat in the service layer, not UI-only state", () => {
  const mockService = read("src/lib/services/mock/mockService.ts");
  const mockData = read("src/lib/services/mock/data.ts");

  assert.match(mockData, /export const chatConversations: ChatConversation\[\]/);
  assert.match(mockData, /export const chatMessages: Record<string, ChatMessage\[\]>/);
  assert.match(mockService, /chat: \{/);
  assert.match(mockService, /listConversations\(\)/);
  assert.match(mockService, /sendMessage\(input\)/);
  assert.match(mockService, /subscribeToConversation\(conversationId, handlers/);
});

test("Supabase chat smoke script is explicit, cleanup-safe, and service-role gated", () => {
  const script = read("scripts/supabase-chat-smoke.mjs");
  const packageJson = read("package.json");

  assert.match(packageJson, /"smoke:supabase-chat": "node scripts\/supabase-chat-smoke\.mjs"/);
  assert.match(script, /HUNGRY_SUPABASE_SMOKE_URL/);
  assert.match(script, /HUNGRY_SUPABASE_SMOKE_ANON_KEY/);
  assert.match(script, /HUNGRY_SUPABASE_SMOKE_SERVICE_ROLE_KEY/);
  assert.match(script, /HUNGRY_SUPABASE_SMOKE_PROJECT_REF/);
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

test("Supabase chat opens conversations through checked RPC and Realtime-safe receipts", () => {
  const service = read("src/lib/services/supabase/supabaseService.ts");
  const migration = read("supabase/migrations/20260524023000_chat_conversation_open_rpc.sql");
  const wrapperMigration = read(
    "supabase/migrations/20260524024500_chat_open_conversation_private_wrapper.sql",
  );
  const openConversationBlock =
    service.match(/async openConversation\(input\)[\s\S]*?async listMessages/)?.[0] ?? "";

  assert.match(openConversationBlock, /\.rpc\("open_chat_conversation"/);
  assert.doesNotMatch(openConversationBlock, /\.from\("conversations"\)\s*\.insert/);
  assert.doesNotMatch(openConversationBlock, /\.from\("conversation_participants"\)\s*\.insert/);
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
