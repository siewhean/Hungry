-- H32: posts showed an author name and avatar written by the client.
--
-- postBite stored generated_content.author.{displayName, avatarUrl} from the
-- client draft and some read paths showed it as the post's author, so anyone
-- could insert a post through PostgREST as "Hungry Team" with an avatar on any
-- host. The app now reads every post author from public_profiles by
-- author_id. This BEFORE INSERT / UPDATE trigger also drops the author key
-- from generated_content, so the JSON can never carry a spoofed author again
-- (older app builds that still read it show the default name for new posts).
--
-- Existing rows are not rewritten here: no read path uses the key any more,
-- and a bulk update would fire the posts triggers for every row. sh may run
--   update public.posts set generated_content = generated_content - 'author'
--   where generated_content ? 'author';
-- as the service role later to clean old rows.
--
-- New: app_private.posts_strip_client_author() (trigger only).

create schema if not exists app_private;

create or replace function app_private.posts_strip_client_author()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.generated_content is not null
    and jsonb_typeof(new.generated_content) = 'object'
    and new.generated_content ? 'author' then
    new.generated_content := new.generated_content - 'author';
  end if;
  return new;
end;
$$;

revoke all on function app_private.posts_strip_client_author() from public, anon, authenticated;

drop trigger if exists trg_posts_strip_client_author on public.posts;
create trigger trg_posts_strip_client_author
  before insert or update of generated_content on public.posts
  for each row
  execute function app_private.posts_strip_client_author();
