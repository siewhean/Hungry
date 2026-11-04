-- Down for 20261028180000_stall_visit_points_need_review.
-- Takes the visit gate back out of app_private.award_food_cred: the body returns to what the
-- race-condition migration (20261022150000) left, so a visit pays once per day again.

create or replace function pg_temp.visit_gate_unpatch() returns void
language plpgsql
as $patch$
declare
  v_oid oid;
  v_def text;
  v_start integer;
  v_end integer;
  v_marker constant text := '-- gate:stall-visit';
  v_tail constant text := 'resolved_points := coalesce(resolved_points, 0);';
begin
  for v_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = 'award_food_cred'
      and p.prokind = 'f'
  loop
    v_def := pg_get_functiondef(v_oid);
    v_start := position(v_marker in v_def);
    if v_start = 0 then
      continue;
    end if;
    v_end := position(v_tail in substr(v_def, v_start));
    if v_end = 0 then
      raise exception 'visit_gate_unpatch: gate found but its end was not';
    end if;
    execute substr(v_def, 1, v_start - 1)
      || substr(v_def, v_start + v_end - 1);
  end loop;
end;
$patch$;

select pg_temp.visit_gate_unpatch();
