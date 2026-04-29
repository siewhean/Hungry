-- Mobile storage security smoke checks.
-- Run after applying migrations to a linked or local Supabase DB.

-- 1) Buckets exist with deliberate public/read posture and 10MB limits.
select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('menu-photos', 'review-media', 'avatars', 'bites-media')
order by id;

-- 2) Authenticated own-prefix storage policies exist for every mobile bucket.
select
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'menu_photos_insert_authenticated_own_prefix',
    'menu_photos_update_authenticated_own_prefix',
    'menu_photos_delete_authenticated_own_prefix',
    'menu_photos_select_authenticated_own_prefix',
    'review_media_insert_authenticated_own_prefix',
    'review_media_update_authenticated_own_prefix',
    'review_media_delete_authenticated_own_prefix',
    'review_media_select_authenticated_own_prefix',
    'avatars_insert_authenticated_own_prefix',
    'avatars_update_authenticated_own_prefix',
    'avatars_delete_authenticated_own_prefix',
    'avatars_select_authenticated_own_prefix',
    'bites_media_insert_authenticated_own_prefix',
    'bites_media_update_authenticated_own_prefix',
    'bites_media_delete_authenticated_own_prefix',
    'bites_media_select_authenticated_own_prefix',
    'mobile_media_select_service_role'
  )
order by policyname;

-- 3) submit_menu_photo has the hardened path-prefix guard.
select
  proname,
  prosecdef as security_definer,
  proconfig,
  pg_get_functiondef(oid) ilike '%p_storage_path not like v_user_id::text || ''/%''%'
    as validates_user_prefix
from pg_proc
where proname = 'submit_menu_photo';
