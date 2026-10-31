-- smoke: supabase/smoke/stall_visit_points_need_review.sql
-- Food Cred for "visited" needs a review, once per stall (round-four stall page, R4-STALL-3).
--
-- Marking a stall visited is one tap in the app and no longer asks for a review first (sh's
-- decision, 2026-10-28). The points for it are decided here, not in the app: a signed-in client
-- can call award_food_cred('stall_marked_tried', <stall id>) directly, so a client that "forgets"
-- to skip the request must still earn nothing without a review.
--
-- stall_marked_tried now pays only when
--   1. the diner has a review at that stall (reviews.venue_id, or through the reviewed dish), and
--   2. it has not already paid for that stall: once per stall, ever, not once per day.
-- Otherwise it records a 0-point event and returns the current totals, like any other capped award.
--
-- The body is patched in place from its live definition (the race-condition fix in
-- 20261022150000 already patched it), so the grants, the lock and the caps stay as they are.
-- The patch is idempotent and fails loudly if the text it expects is not there.
-- Down: supabase/rollbacks/20261028180000_stall_visit_points_need_review.down.sql.

create or replace function pg_temp.visit_gate_patch(
  p_find text,
  p_replace text,
  p_tag text
) returns void
language plpgsql
as $patch$
declare
  v_oid oid;
  v_patched integer := 0;
begin
  for v_oid in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = 'award_food_cred'
      and p.prokind = 'f'
  loop
    if (select position(p_tag in prosrc) > 0 from pg_proc where oid = v_oid) then
      v_patched := v_patched + 1;
      continue;
    end if;
    if (select (length(prosrc) - length(replace(prosrc, p_find, ''))) = length(p_find)
        from pg_proc where oid = v_oid) then
      execute replace(pg_get_functiondef(v_oid), p_find, p_replace);
      v_patched := v_patched + 1;
    end if;
  end loop;
  if v_patched = 0 then
    raise exception 'visit_gate_patch: app_private.award_food_cred does not contain the expected text (%)', p_tag;
  end if;
end;
$patch$;

select pg_temp.visit_gate_patch(
$f$resolved_points := coalesce(resolved_points, 0);$f$,
$f$-- gate:stall-visit (a visit pays once per stall, and only after a review there)
  if normalized_action = 'stall_marked_tried' and coalesce(auth.role(), '') <> 'service_role' then
    if normalized_entity_id is null
       or exists (
         select 1
         from food_cred_events fce
         where fce.user_id = current_user_id
           and fce.source_action = 'stall_marked_tried'
           and fce.related_entity_id = normalized_entity_id
           and fce.points > 0
       )
       or not (
         exists (
           select 1 from reviews r
           where r.user_id = current_user_id and r.venue_id = normalized_entity_id
         )
         or exists (
           select 1 from reviews r
           join dishes d on d.id = r.dish_id
           where r.user_id = current_user_id and d.venue_id = normalized_entity_id
         )
       ) then
      resolved_points := 0;
    end if;
  end if;

  resolved_points := coalesce(resolved_points, 0);$f$,
'gate:stall-visit');
