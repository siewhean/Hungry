-- Integration readiness smoke checks.
-- Run after applying migration 0023 to a linked or local Supabase DB. (The chat tables and their
-- policies and realtime entries were dropped by 20261119090000_drop_direct_message_chat.sql.)

with expected_tables(table_name) as (
  values
    ('privacy_settings'),
    ('follows'),
    ('posts'),
    ('post_media'),
    ('post_comments'),
    ('post_likes'),
    ('post_saves'),
    ('post_shares')
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
  'post_shares'
)
  and relrowsecurity is distinct from true;

with expected_policies(policyname) as (
  values
    ('posts_select_visible'),
    ('post_media_select_visible_post'),
    ('post_comments_insert_visible_post'),
    ('post_likes_insert_own_visible_post')
)
select policyname
from expected_policies
except
select policyname
from pg_policies
where schemaname = 'public';

with expected_storage_policies(policyname) as (
  values
    ('post_media_select_author_prefix'),
    ('post_media_select_visible_post_objects'),
    ('integration_media_insert_authenticated_own_prefix'),
    ('integration_media_delete_authenticated_own_prefix')
)
select policyname
from expected_storage_policies
except
select policyname
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects';

with expected_triggers(trigger_name) as (
  values
    ('trg_post_likes_sync_counts'),
    ('trg_post_saves_sync_counts'),
    ('trg_post_shares_sync_counts')
)
select trigger_name
from expected_triggers
except
select tgname
from pg_trigger
where not tgisinternal;

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
