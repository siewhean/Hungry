-- smoke: supabase/smoke/photo_optional.sql
-- smoke: supabase/smoke/reviews_server_side.sql
-- smoke: supabase/smoke/post_publish_gate.sql
-- Build plan package 0.1 (sh, 2026-11-14: a photo is optional on a review and on a post).
-- 20261110120000_post_publish_gate refused both with no photo; the app has let diners leave the
-- photo out since 4 Nov, so those reviews were refused on the server.
--
-- 1. submit_review saves a review with no photo. Photos sent are still checked as before (path is
--    the caller's, photo check clear), and a retry of a photo-less review can still add photos.
-- 2. publish_post_core (publish_post, and the portfolio entry of submit_review) publishes a post
--    with no media as post_type 'text'. Media sent are still checked as before. The board already
--    pays a post without a photo 2 points off the board (20261107120000).
-- Nothing else changes: the per-id locks, the 10-photo cap and the rate rule stay.
-- Rollback: supabase/rollbacks/20261114090000_photo_optional.down.sql.

-- Replaces one exact piece of a live function body. Already patched (p_replace present and
-- p_find gone) is a no-op; anything else that does not find exactly one copy stops the migration.
create or replace function pg_temp.patch_function(p_oid regprocedure, p_find text, p_replace text)
returns void
language plpgsql
as $patch$
declare
  v_src text := (select prosrc from pg_proc where oid = p_oid);
  v_count integer := (length(v_src) - length(replace(v_src, p_find, ''))) / length(p_find);
begin
  if v_count = 0 and position(p_replace in v_src) > 0 then
    return;
  end if;
  if v_count <> 1 then
    raise exception 'patch_function: % has % copies of the expected text', p_oid, v_count;
  end if;
  execute replace(pg_get_functiondef(p_oid), p_find, p_replace);
end;
$patch$;

-- 1. A review without a photo.
select pg_temp.patch_function(
  'public.submit_review(jsonb, jsonb, jsonb)'::regprocedure,
  $find$    -- No photo, no review: raising here rolls back the review insert above too.
    if jsonb_array_length(v_photos) = 0 then
      raise exception 'Add a photo to publish your review.' using errcode = '23514';
    end if;
$find$,
  $repl$    -- A photo is optional (20261114090000): with none sent, nothing below inserts a row.
$repl$
);

-- 2. A post without media.
select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)'::regprocedure,
  $find$  if v_count = 0 then
    raise exception 'Add a photo to post.' using errcode = '23514';
  end if;
$find$,
  $repl$  -- A photo is optional (20261114090000): a post with no media is a text post.
$repl$
);

select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)'::regprocedure,
  $find$  v_post_type := case
    when exists$find$,
  $repl$  v_post_type := case
    when v_count = 0 then 'text'
    when exists$repl$
);

notify pgrst, 'reload schema';
