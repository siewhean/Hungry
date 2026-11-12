-- Undo 20261113090000_stall_history: drops stall history, its writers, trigger and rate rule, and
-- takes stallHistory back out of the data export.
-- expect-row-loss: app_private.request_rate_rules, public.user_stall_affinities
-- down-loses-data: user_stall_affinities only (learned stall history; saved and tried stalls stay in user_stall_interactions).

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
  'app_private.export_my_data()'::regprocedure,
  $find$
    'stallHistory',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_affinities t where t.user_id = v_user), '[]'::jsonb),$find$,
  ''
);

delete from app_private.request_rate_rules where route = 'rpc/record_stall_signal';

drop trigger if exists user_stall_affinities_from_interaction on public.user_stall_interactions;
drop function if exists app_private.user_stall_affinities_from_interaction();
drop function if exists public.record_stall_signal(text, text);
drop function if exists app_private.record_stall_signal(text, text);
drop function if exists app_private.apply_stall_affinity_event(uuid, text, numeric, timestamptz, boolean);
drop table if exists public.user_stall_affinities;
