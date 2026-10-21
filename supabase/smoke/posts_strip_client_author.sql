-- Smoke checks for 20261021165000_posts_strip_client_author.sql (H32).
-- A client-written generated_content.author is dropped on insert and update.
-- Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   author: 00000000-0000-0d32-b000-000000000001
--   post:   00000000-0000-0d32-c000-000000000001
insert into user_profiles (id, display_name)
values ('00000000-0000-0d32-b000-000000000001', 'Post Author Smoke')
on conflict (id) do nothing;

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0d32-b000-000000000001', true);
set local role authenticated;

insert into posts (id, author_id, post_type, status, visibility, caption, generated_content)
values (
  '00000000-0000-0d32-c000-000000000001',
  '00000000-0000-0d32-b000-000000000001',
  'text',
  'draft',
  'public',
  'Smoke caption',
  jsonb_build_object(
    'source', 'post_composer',
    'author', jsonb_build_object('displayName', 'Hungry Team', 'avatarUrl', 'https://evil.example/a.png'),
    'tags', jsonb_build_array('laksa')
  )
);

update posts
set generated_content = generated_content
  || jsonb_build_object('author', jsonb_build_object('displayName', 'Hungry Team'))
where id = '00000000-0000-0d32-c000-000000000001';

reset role;

do $$
declare
  v_content jsonb;
begin
  select generated_content into v_content
  from posts
  where id = '00000000-0000-0d32-c000-000000000001';

  if v_content ? 'author' then
    raise exception 'generated_content.author must be dropped, got %', v_content;
  end if;
  if v_content ->> 'source' is distinct from 'post_composer'
    or v_content -> 'tags' is distinct from '["laksa"]'::jsonb then
    raise exception 'Other generated_content keys must be kept, got %', v_content;
  end if;
end $$;

select 'posts_strip_client_author_smoke_passed' as result;

rollback;
