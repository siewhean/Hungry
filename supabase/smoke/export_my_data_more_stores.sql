-- Smoke checks for 20261022100100_export_my_data_more_stores.sql.
-- The export lists the user data stores it used to leave out (own rows only)
-- and every data key is named in categories. Runs in a transaction and rolls back.

begin;

-- Fixed ids for this smoke only.
--   owner: 00000000-0000-0201-b000-000000000001
--   other: 00000000-0000-0201-b000-000000000002
insert into user_profiles (id, display_name)
values
  ('00000000-0000-0201-b000-000000000001', 'Export Stores Owner'),
  ('00000000-0000-0201-b000-000000000002', 'Export Stores Other')
on conflict (id) do nothing;

select set_config(
  'smoke.dish_id',
  (select d.id from dishes d order by d.id limit 1),
  true
);

insert into recommendation_impressions (user_id, surface, dish_ids)
values
  ('00000000-0000-0201-b000-000000000001', 'smoke', array[current_setting('smoke.dish_id')]),
  ('00000000-0000-0201-b000-000000000002', 'smoke', array[current_setting('smoke.dish_id')]);

insert into passport_progress_events (user_id, category_id, event_type)
values
  ('00000000-0000-0201-b000-000000000001', 'smoke', 'dish_tried'),
  ('00000000-0000-0201-b000-000000000002', 'smoke', 'dish_tried');

insert into portfolios (id, owner_id, name, type, visibility)
values
  ('00000000-0000-0201-f000-000000000001', '00000000-0000-0201-b000-000000000001',
   'Export smoke list', 'collection', 'public'),
  ('00000000-0000-0201-f000-000000000002', '00000000-0000-0201-b000-000000000002',
   'Export smoke other list', 'collection', 'public');

insert into portfolio_items (portfolio_id, item_type, dish_id)
values
  ('00000000-0000-0201-f000-000000000001', 'dish', current_setting('smoke.dish_id')),
  ('00000000-0000-0201-f000-000000000002', 'dish', current_setting('smoke.dish_id'));

insert into portfolio_follows (portfolio_id, user_id)
values ('00000000-0000-0201-f000-000000000002', '00000000-0000-0201-b000-000000000001');

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-0201-b000-000000000001', true);
set local role authenticated;

do $$
declare
  v_export jsonb := public.export_my_data();
  v_categories jsonb := v_export -> 'categories';
  v_key text;
begin
  foreach v_key in array array[
    'reviewHelpfulVotes', 'portfolioItems', 'portfolioCollaborations', 'portfolioFollows',
    'recommendationImpressions', 'passportProgressEvents', 'stallInteractions',
    'missionProgress', 'moodSearchQueries', 'merchantMemberships', 'merchantClaimInterests'
  ] loop
    if not (v_categories ? v_key) then
      raise exception 'Export categories should list %', v_key;
    end if;
    if jsonb_typeof(v_export #> array['data', v_key]) <> 'array' then
      raise exception 'Export data % should be an array', v_key;
    end if;
  end loop;

  if jsonb_array_length(v_export #> '{data,recommendationImpressions}') <> 1 then
    raise exception 'Export should hold only the caller''s impressions';
  end if;
  if jsonb_array_length(v_export #> '{data,passportProgressEvents}') <> 1 then
    raise exception 'Export should hold only the caller''s passport events';
  end if;
  if jsonb_array_length(v_export #> '{data,portfolioItems}') <> 1 then
    raise exception 'Export should hold only items from the caller''s own Lists';
  end if;
  if jsonb_array_length(v_export #> '{data,portfolioFollows}') <> 1 then
    raise exception 'Export should hold the caller''s list follows';
  end if;
  if jsonb_array_length(v_categories) <> (select count(*) from jsonb_object_keys(v_export -> 'data')) then
    raise exception 'Every data key should be listed in categories';
  end if;
  if jsonb_array_length(v_export -> 'notIncluded') < 3 then
    raise exception 'notIncluded should disclose what the export leaves out';
  end if;
end $$;

rollback;
