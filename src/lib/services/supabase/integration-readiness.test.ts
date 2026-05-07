import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

function readRepoFile(pathFromRepoRoot: string): string {
  return readFileSync(resolve(process.cwd(), pathFromRepoRoot), "utf8");
}

const integrationMigration = "supabase/migrations/0023_integration_posts_privacy_chat.sql";

test("integration migration adds privacy and post publication primitives", () => {
  const sql = readRepoFile(integrationMigration);

  for (const tableName of [
    "privacy_settings",
    "follows",
    "posts",
    "post_media",
    "post_comments",
    "post_likes",
    "post_saves",
    "post_shares",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists ${tableName}`, "i"));
    assert.match(sql, new RegExp(`alter table ${tableName} enable row level security`, "i"));
  }

  assert.match(sql, /account_visibility text not null default 'public'/i);
  assert.match(sql, /check \(account_visibility in \('public', 'private'\)\)/i);
  assert.match(sql, /create or replace function public\.can_read_author_content/i);
  assert.match(sql, /create or replace function public\.can_read_post/i);
  assert.match(sql, /create policy "follows_insert_requester"/i);
  assert.match(
    sql,
    /with check \(auth\.uid\(\) = follower_id and status = 'pending' and approved_at is null\)/i,
  );
  assert.match(
    sql,
    /create policy "follows_update_participant"[\s\S]*using \(auth\.uid\(\) = followee_id\)/i,
  );
  assert.doesNotMatch(
    sql,
    /follows_update_participant"[\s\S]*auth\.uid\(\) = follower_id[\s\S]*status = 'approved'/i,
  );
  assert.match(sql, /status text not null default 'draft'/i);
  assert.match(sql, /check \(status in \('draft', 'published', 'deleted'\)\)/i);
  assert.match(sql, /visibility text not null default 'public'/i);
  assert.match(sql, /generated_content jsonb not null default '\{\}'::jsonb/i);
  assert.match(sql, /create policy "posts_select_visible"/i);
  assert.match(sql, /create policy "posts_insert_own"/i);
  assert.match(sql, /create policy "post_media_write_own_post"/i);
  assert.match(sql, /create policy "post_comments_insert_visible_post"/i);
  assert.match(sql, /create policy "post_likes_insert_own_visible_post"/i);
  assert.match(sql, /create policy "post_saves_insert_own_visible_post"/i);
});

test("integration migration adds participant-based chat and read receipt primitives", () => {
  const sql = readRepoFile(integrationMigration);

  for (const tableName of [
    "conversations",
    "conversation_participants",
    "messages",
    "read_receipts",
  ]) {
    assert.match(sql, new RegExp(`create table if not exists ${tableName}`, "i"));
    assert.match(sql, new RegExp(`alter table ${tableName} enable row level security`, "i"));
    assert.match(
      sql,
      new RegExp(`alter publication supabase_realtime add table ${tableName}`, "i"),
    );
  }

  assert.match(sql, /conversation_type text not null default 'user'/i);
  assert.match(sql, /check \(conversation_type in \('user', 'merchant'\)\)/i);
  assert.match(sql, /dedupe_key text not null unique/i);
  assert.match(
    sql,
    /participant_kind text not null check \(participant_kind in \('user', 'merchant'\)\)/i,
  );
  assert.match(sql, /create or replace function public\.can_access_conversation/i);
  assert.match(sql, /create policy "conversations_select_participant"/i);
  assert.match(sql, /create policy "conversation_participants_select_participant"/i);
  assert.match(sql, /create policy "conversation_participants_insert_creator_or_self"/i);
  assert.match(
    sql,
    /where c\.id = conversation_participants\.conversation_id\s+and c\.created_by_user_id = auth\.uid\(\)/i,
  );
  assert.doesNotMatch(sql, /or participant_user_id = auth\.uid\(\)/i);
  assert.match(sql, /create policy "messages_select_participant"/i);
  assert.match(sql, /create policy "messages_insert_sender_participant"/i);
  assert.match(sql, /create policy "read_receipts_upsert_reader"/i);
  assert.match(sql, /create unique index if not exists idx_messages_id_conversation/i);
  assert.match(sql, /constraint read_receipts_message_conversation_fkey/i);
  assert.match(
    sql,
    /foreign key \(message_id, conversation_id\) references messages\(id, conversation_id\)/i,
  );
  assert.match(sql, /create unique index if not exists idx_read_receipts_user_once/i);
  assert.match(sql, /create unique index if not exists idx_read_receipts_merchant_once/i);
});

test("integration migration adds media buckets for posts and merchant images", () => {
  const sql = readRepoFile(integrationMigration);

  for (const bucketName of ["post-media", "merchant-dish-images", "merchant-stall-images"]) {
    assert.match(sql, new RegExp(`'${bucketName}'`, "i"));
  }

  assert.match(sql, /\('post-media', 'post-media', false, 52428800/i);
  assert.match(sql, /'video\/mp4', 'video\/quicktime', 'video\/webm'/i);
  assert.match(sql, /create policy "post_media_select_author_prefix"/i);
  assert.match(
    sql,
    /bucket_id = 'post-media' and \(storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i,
  );
  const publicMediaPolicy =
    sql.match(/create policy "integration_media_select_public"[\s\S]*?;/i)?.[0] ?? "";
  assert.doesNotMatch(publicMediaPolicy, /'post-media'/i);
  assert.match(sql, /create policy "integration_media_insert_authenticated_own_prefix"/i);
  assert.match(sql, /create policy "integration_media_delete_authenticated_own_prefix"/i);
  assert.match(sql, /storage\.foldername\(name\)\)\[1\] = auth\.uid\(\)::text/i);
});

test("integration readiness smoke SQL checks schema, policies, buckets, and realtime", () => {
  const smoke = readRepoFile("supabase/smoke/integration_readiness.sql");

  assert.match(smoke, /expected_tables/i);
  assert.match(smoke, /privacy_settings/i);
  assert.match(smoke, /posts/i);
  assert.match(smoke, /messages/i);
  assert.match(smoke, /expected_policies/i);
  assert.match(smoke, /messages_insert_sender_participant/i);
  assert.match(smoke, /expected_storage_policies/i);
  assert.match(smoke, /post_media_select_visible_post_objects/i);
  assert.match(smoke, /expected_triggers/i);
  assert.match(smoke, /trg_post_likes_sync_counts/i);
  assert.match(smoke, /expected_buckets/i);
  assert.match(smoke, /merchant-dish-images/i);
  assert.match(smoke, /pg_publication/i);
  assert.match(smoke, /supabase_realtime/i);
});
