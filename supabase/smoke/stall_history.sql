-- Smoke checks for 20261113090000_stall_history.sql.
-- 1. record_stall_signal adds a view, directions and a share to the caller's own stall history;
--    Not for me subtracts and hides the stall for 30 days; an unknown signal is refused.
-- 2. Saving, unsaving and marking a stall tried (user_stall_interactions) are counted by trigger.
-- 3. A diner reads and deletes only their own rows and cannot write the table; anon cannot run
--    the RPC; the RPC has a rate rule; the data export includes stallHistory.
-- Runs in a transaction and rolls back. Brings its own building and stalls.
--   diner: 00000000-0000-1113-b000-000000000001
--   other: 00000000-0000-1113-b000-000000000002

begin;

insert into auth.users (id, email)
values
  ('00000000-0000-1113-b000-000000000001', 'stall-history-smoke-1@example.test'),
  ('00000000-0000-1113-b000-000000000002', 'stall-history-smoke-2@example.test')
on conflict (id) do nothing;

insert into user_profiles (id, display_name)
values
  ('00000000-0000-1113-b000-000000000001', 'Stall History Diner'),
  ('00000000-0000-1113-b000-000000000002', 'Stall History Other')
on conflict (id) do nothing;

insert into buildings (id, name, building_type, latitude, longitude)
values ('smoke-1113-building', 'Smoke 1113 Building', 'hawker_centre', 1.2803, 103.8448);

insert into venues (id, building_id, name, unit_number, floor)
values
  ('smoke-1113-a', 'smoke-1113-building', 'Smoke 1113 Stall A', '#01-01', '1'),
  ('smoke-1113-b', 'smoke-1113-building', 'Smoke 1113 Stall B', '#01-02', '1');

do $$
begin
  if not exists (
    select 1 from app_private.request_rate_rules where route = 'rpc/record_stall_signal'
  ) then
    raise exception 'record_stall_signal has no rate rule';
  end if;
  if has_function_privilege('anon', 'public.record_stall_signal(text, text)', 'execute') then
    raise exception 'anon can run record_stall_signal';
  end if;
  if has_table_privilege('authenticated', 'public.user_stall_affinities', 'insert')
     or has_table_privilege('authenticated', 'public.user_stall_affinities', 'update') then
    raise exception 'diners can write user_stall_affinities directly';
  end if;
end;
$$;

-- The other diner's row, written as the system would.
select app_private.apply_stall_affinity_event('00000000-0000-1113-b000-000000000002', 'smoke-1113-a', 3);

select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '00000000-0000-1113-b000-000000000001', true);
set local role authenticated;

select public.record_stall_signal('smoke-1113-a', 'view');
select public.record_stall_signal('smoke-1113-a', 'directions');
select public.record_stall_signal('smoke-1113-a', 'share');
select public.record_stall_signal('smoke-1113-b', 'not_for_me');

do $$
declare
  v_a record;
  v_b record;
begin
  select evidence, evidence_count into v_a from public.user_stall_affinities where venue_id = 'smoke-1113-a';
  if v_a.evidence_count <> 3 or round(v_a.evidence) <> 7 then
    raise exception 'stall A should have 3 signals worth 7, got % worth %', v_a.evidence_count, v_a.evidence;
  end if;
  select evidence, dismissed_until into v_b from public.user_stall_affinities where venue_id = 'smoke-1113-b';
  if round(v_b.evidence) <> -4 or v_b.dismissed_until is null or v_b.dismissed_until < now() + interval '29 days' then
    raise exception 'Not for me should subtract 4 and hide stall B for 30 days';
  end if;
  if (select count(*) from public.user_stall_affinities) <> 2 then
    raise exception 'a diner should see only their own two rows';
  end if;
  begin
    perform public.record_stall_signal('smoke-1113-a', 'stare');
    raise exception 'an unknown signal was accepted';
  exception when invalid_parameter_value then
    null;
  end;
  if not ((public.export_my_data() -> 'categories') ? 'stallHistory') then
    raise exception 'the export has no stallHistory';
  end if;
  if jsonb_array_length(public.export_my_data() -> 'stallHistory') <> 2 then
    raise exception 'the export should hold the diner''s two stall rows';
  end if;
end;
$$;

reset role;

-- Saving, unsaving and trying a stall are counted.
insert into user_stall_interactions (user_id, stall_id, is_saved, saved_at)
values ('00000000-0000-1113-b000-000000000001', 'smoke-1113-b', true, now());
update user_stall_interactions set is_saved = false
where user_id = '00000000-0000-1113-b000-000000000001' and stall_id = 'smoke-1113-b';
update user_stall_interactions set is_tried = true, tried_at = now()
where user_id = '00000000-0000-1113-b000-000000000001' and stall_id = 'smoke-1113-b';

do $$
declare
  v_b record;
begin
  select evidence, evidence_count into v_b from public.user_stall_affinities
  where user_id = '00000000-0000-1113-b000-000000000001' and venue_id = 'smoke-1113-b';
  if v_b.evidence_count <> 4 or round(v_b.evidence) <> 0 then
    raise exception 'save +3, unsave -2 and tried +3 after Not for me -4 should total 0 over 4 signals, got % over %', v_b.evidence, v_b.evidence_count;
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-1113-b000-000000000001', true);
set local role authenticated;
delete from public.user_stall_affinities;
reset role;

do $$
begin
  if exists (select 1 from public.user_stall_affinities where user_id = '00000000-0000-1113-b000-000000000001') then
    raise exception 'Clear history did not delete the diner''s rows';
  end if;
  if not exists (select 1 from public.user_stall_affinities where user_id = '00000000-0000-1113-b000-000000000002') then
    raise exception 'Clear history deleted another diner''s row';
  end if;
end;
$$;

rollback;
