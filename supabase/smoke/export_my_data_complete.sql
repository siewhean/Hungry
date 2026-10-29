-- Smoke checks for 20261029090200_export_my_data_complete.sql.
-- The export includes the caller's dish taste ratings, catalog corrections and notification
-- jobs (own rows only) and lists the new categories. Rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner: 00000000-0000-0063-b000-000000000001
--   other: 00000000-0000-0063-b000-000000000002
insert into auth.users (id, email)
values
  ('00000000-0000-0063-b000-000000000001', 'export-complete-owner@example.test'),
  ('00000000-0000-0063-b000-000000000002', 'export-complete-other@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-0063-b000-000000000001', 'Export Complete Owner'),
  ('00000000-0000-0063-b000-000000000002', 'Export Complete Other')
on conflict (id) do nothing;

select set_config('smoke.dish_id', (select d.id from dishes d order by d.id limit 1), true);
select set_config('smoke.venue_id', (select v.id from venues v order by v.id limit 1), true);

insert into dish_taste_ratings (user_id, dish_id, sweet, spicy)
values
  ('00000000-0000-0063-b000-000000000001', current_setting('smoke.dish_id'), 3, 7),
  ('00000000-0000-0063-b000-000000000002', current_setting('smoke.dish_id'), 5, 5);

insert into catalog_corrections (venue_id, reporter_id, kind)
values
  (current_setting('smoke.venue_id'), '00000000-0000-0063-b000-000000000001', 'closed'),
  (current_setting('smoke.venue_id'), '00000000-0000-0063-b000-000000000002', 'closed');

insert into notification_jobs (user_id, category, change_kind, dedupe_key, title, body, deep_link)
values
  ('00000000-0000-0063-b000-000000000001', 'stall_update', 'new_dish', 'export-complete-1', 'T1', 'B1', 'hungry://x'),
  ('00000000-0000-0063-b000-000000000002', 'stall_update', 'new_dish', 'export-complete-2', 'T2', 'B2', 'hungry://x');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0063-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_export jsonb := public.export_my_data();
  v_key text;
begin
  foreach v_key in array array['tasteRatings', 'catalogCorrections', 'notificationJobs'] loop
    if not ((v_export -> 'categories') ? v_key) then
      raise exception 'Export categories should list %', v_key;
    end if;
    if jsonb_array_length(v_export #> array['data', v_key]) <> 1 then
      raise exception 'Export data % should hold exactly the caller''s row', v_key;
    end if;
  end loop;
  if (v_export #>> '{data,tasteRatings,0,user_id}') <> '00000000-0000-0063-b000-000000000001' then
    raise exception 'tasteRatings must be the caller''s own rows';
  end if;
  if jsonb_array_length(v_export -> 'categories') <> (select count(*) from jsonb_object_keys(v_export -> 'data')) then
    raise exception 'Every data key should be listed in categories';
  end if;
end $$;

select 'export_my_data_complete smoke passed' as result;

rollback;
