-- Smoke checks for 20261019100000_export_my_data.sql.
-- The export returns only the caller's own rows, lists every category it
-- includes, and refuses anonymous callers. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner:    00000000-0000-0044-b000-000000000001
--   other:    00000000-0000-0044-b000-000000000002
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0044-b000-000000000001', 'Export Owner'),
  ('00000000-0000-0044-b000-000000000002', 'Export Other')
on conflict (id) do nothing;

insert into posts (id, author_id, caption)
values
  ('00000000-0000-0044-e000-000000000001', '00000000-0000-0044-b000-000000000001', 'Export smoke owner post'),
  ('00000000-0000-0044-e000-000000000002', '00000000-0000-0044-b000-000000000002', 'Export smoke other post');

insert into post_saves (post_id, user_id)
values ('00000000-0000-0044-e000-000000000002', '00000000-0000-0044-b000-000000000001');

select set_config('request.jwt.claim.role', 'authenticated', true);
set local role authenticated;

-- Anonymous callers are refused.
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  perform public.export_my_data();
  raise exception 'export_my_data should refuse a caller without auth.uid()';
exception
  when insufficient_privilege then null;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0044-b000-000000000001', true);
do $$
declare
  v_export jsonb := public.export_my_data();
  v_categories jsonb := v_export -> 'categories';
begin
  if (v_export #>> '{data,profile,id}') <> '00000000-0000-0044-b000-000000000001' then
    raise exception 'Export should contain the caller''s own profile';
  end if;
  if jsonb_array_length(v_export #> '{data,posts}') <> 1
     or (v_export #>> '{data,posts,0,author_id}') <> '00000000-0000-0044-b000-000000000001' then
    raise exception 'Export should contain only the caller''s posts';
  end if;
  if jsonb_array_length(v_export #> '{data,savedPosts}') <> 1 then
    raise exception 'Export should contain the caller''s saved posts';
  end if;
  if not (v_categories ? 'posts' and v_categories ? 'savedPosts' and v_categories ? 'reviews') then
    raise exception 'Export categories should list the included sections';
  end if;
  if jsonb_array_length(v_categories) <> (select count(*) from jsonb_object_keys(v_export -> 'data')) then
    raise exception 'Every data key should be listed in categories';
  end if;
end $$;

rollback;
