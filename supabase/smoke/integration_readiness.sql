-- Integration readiness smoke checks.
-- Run after applying migration 0023 to a linked or local Supabase DB.

with expected_tables(table_name) as (
  values
    ('privacy_settings'),
    ('follows'),
    ('posts'),
    ('post_media'),
    ('post_comments'),
    ('post_likes'),
    ('post_saves'),
    ('post_shares'),
    ('conversations'),
    ('conversation_participants'),
    ('messages'),
    ('read_receipts')
)
select table_name
from expected_tables
except
select tablename
from pg_tables
where schemaname = 'public';

select relname, relrowsecurity
from pg_class
where relname in (
  'privacy_settings',
  'follows',
  'posts',
  'post_media',
  'post_comments',
  'post_likes',
  'post_saves',
  'post_shares',
  'conversations',
  'conversation_participants',
  'messages',
  'read_receipts'
)
  and relrowsecurity is distinct from true;

with expected_policies(policyname) as (
  values
    ('posts_select_visible'),
    ('post_media_select_visible_post'),
    ('post_comments_insert_visible_post'),
    ('post_likes_insert_own_visible_post'),
    ('conversations_select_participant'),
    ('conversation_participants_select_participant'),
    ('messages_select_participant'),
    ('messages_insert_sender_participant'),
    ('read_receipts_upsert_reader')
)
select policyname
from expected_policies
except
select policyname
from pg_policies
where schemaname = 'public';

with expected_buckets(bucket_id) as (
  values
    ('post-media'),
    ('merchant-dish-images'),
    ('merchant-stall-images')
)
select bucket_id
from expected_buckets
except
select id
from storage.buckets;

with expected_realtime(relname) as (
  values
    ('conversations'),
    ('conversation_participants'),
    ('messages'),
    ('read_receipts')
)
select relname
from expected_realtime
except
select c.relname
from pg_publication p
join pg_publication_rel pr on pr.prpubid = p.oid
join pg_class c on c.oid = pr.prrelid
where p.pubname = 'supabase_realtime';
