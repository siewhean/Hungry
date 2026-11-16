-- Undo 20261114090000_photo_optional: submit_review and publish_post refuse a review or a post
-- with no photo again, exactly as 20261110120000 left them. Reviews and posts saved without a
-- photo while it was live are kept (nothing is deleted); only new ones are refused.

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

select pg_temp.patch_function(
  'public.submit_review(jsonb, jsonb, jsonb)'::regprocedure,
  $find$    -- A photo is optional (20261114090000): with none sent, nothing below inserts a row.
$find$,
  $repl$    -- No photo, no review: raising here rolls back the review insert above too.
    if jsonb_array_length(v_photos) = 0 then
      raise exception 'Add a photo to publish your review.' using errcode = '23514';
    end if;
$repl$
);

select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)'::regprocedure,
  $find$  -- A photo is optional (20261114090000): a post with no media is a text post.
$find$,
  $repl$  if v_count = 0 then
    raise exception 'Add a photo to post.' using errcode = '23514';
  end if;
$repl$
);

select pg_temp.patch_function(
  'app_private.publish_post_core(jsonb, jsonb, uuid)'::regprocedure,
  $find$  v_post_type := case
    when v_count = 0 then 'text'
    when exists$find$,
  $repl$  v_post_type := case
    when exists$repl$
);

notify pgrst, 'reload schema';
