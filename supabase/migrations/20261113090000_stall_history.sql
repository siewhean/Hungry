-- smoke: supabase/smoke/stall_history.sql
-- Personalisation plan part 2: the app learns from stalls, not only dishes.
--
-- 1. public.user_stall_affinities: one row per (diner, stall), the same decayed, signed evidence
--    as user_dish_affinities (90-day half-life applied on write, scored E / (2 + |E|sum) in
--    src/lib/ai/stallHistory.ts). Readable and deletable by its owner only ("Clear history" in
--    Settings); written only by app_private.apply_stall_affinity_event, one INSERT .. ON
--    CONFLICT DO UPDATE, so two signals at once both count.
-- 2. Weights (keep in step with STALL_AFFINITY_WEIGHTS in stallHistory.ts):
--      view (stall page open 3 s or more)  +1
--      review_opened (a review of a dish there)  +1
--      directions  +3
--      share  +3
--      saved  +3, unsaved  -2      (trigger on user_stall_interactions)
--      tried  +3                    (trigger on user_stall_interactions)
--      not_for_me  -4 and hidden from recommendations for 30 days
-- 3. public.record_stall_signal(stall, signal): signed-in only, VOLATILE, rate limited. The app
--    does not send views while the diner has paused viewing history.
-- 4. export_my_data also exports stallHistory. Account deletion: rows cascade with the profile.
-- Private: never shown to merchants or other diners.
--
-- Rollback: supabase/rollbacks/20261113090000_stall_history.down.sql.

create schema if not exists app_private;
grant usage on schema app_private to authenticated, service_role;

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

-- 1. The table.
create table if not exists public.user_stall_affinities (
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  venue_id text not null references public.venues (id) on delete cascade,
  evidence numeric(10, 4) not null default 0,
  abs_evidence numeric(10, 4) not null default 0,
  evidence_count integer not null default 0,
  first_event_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  dismissed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, venue_id)
);

create index if not exists user_stall_affinities_user_last_idx
  on public.user_stall_affinities (user_id, last_event_at desc);
create index if not exists user_stall_affinities_venue_idx
  on public.user_stall_affinities (venue_id);

alter table public.user_stall_affinities enable row level security;
revoke all on public.user_stall_affinities from public, anon, authenticated;
grant select, delete on public.user_stall_affinities to authenticated;

drop policy if exists user_stall_affinities_select_own on public.user_stall_affinities;
create policy user_stall_affinities_select_own
on public.user_stall_affinities for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists user_stall_affinities_delete_own on public.user_stall_affinities;
create policy user_stall_affinities_delete_own
on public.user_stall_affinities for delete to authenticated
using ((select auth.uid()) = user_id);

-- 2. The one writer: decay to p_at, add the weight, in one statement.
create or replace function app_private.apply_stall_affinity_event(
  p_user uuid,
  p_venue text,
  p_weight numeric,
  p_at timestamptz default now(),
  p_dismiss boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_user is null or p_venue is null or p_weight is null or p_weight = 0 then
    return;
  end if;
  if not exists (select 1 from public.user_profiles where id = p_user)
     or not exists (select 1 from public.venues where id = p_venue) then
    return;
  end if;

  insert into public.user_stall_affinities as a (
    user_id, venue_id, evidence, abs_evidence, evidence_count,
    first_event_at, last_event_at, dismissed_until, updated_at
  )
  values (
    p_user, p_venue, p_weight, abs(p_weight), 1,
    p_at, p_at, case when p_dismiss then p_at + interval '30 days' end, now()
  )
  on conflict (user_id, venue_id) do update
  set evidence = a.evidence * power(2::numeric, -greatest(0, extract(epoch from (p_at - a.last_event_at))) / (90 * 86400)) + p_weight,
      abs_evidence = a.abs_evidence * power(2::numeric, -greatest(0, extract(epoch from (p_at - a.last_event_at))) / (90 * 86400)) + abs(p_weight),
      evidence_count = a.evidence_count + 1,
      last_event_at = greatest(a.last_event_at, p_at),
      dismissed_until = case when p_dismiss then p_at + interval '30 days' else a.dismissed_until end,
      updated_at = now();
end;
$$;

revoke all on function app_private.apply_stall_affinity_event(uuid, text, numeric, timestamptz, boolean)
  from public, anon, authenticated;

-- 3. Signals the app sends.
create or replace function app_private.record_stall_signal(p_venue_id text, p_signal text)
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_weight numeric;
begin
  if v_user is null then
    raise exception 'record_stall_signal requires a signed-in user' using errcode = '42501';
  end if;
  v_weight := case p_signal
    when 'view' then 1
    when 'review_opened' then 1
    when 'directions' then 3
    when 'share' then 3
    when 'not_for_me' then -4
  end;
  if v_weight is null then
    raise exception 'record_stall_signal: unknown signal %', p_signal using errcode = '22023';
  end if;
  perform app_private.apply_stall_affinity_event(
    v_user, p_venue_id, v_weight, now(), p_signal = 'not_for_me'
  );
end;
$$;

revoke all on function app_private.record_stall_signal(text, text) from public, anon, authenticated;
grant execute on function app_private.record_stall_signal(text, text) to authenticated;

create or replace function public.record_stall_signal(p_venue_id text, p_signal text)
returns void
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  select app_private.record_stall_signal(p_venue_id, p_signal);
$$;

revoke all on function public.record_stall_signal(text, text) from public, anon;
grant execute on function public.record_stall_signal(text, text) to authenticated;

-- Saved and tried stalls already live in user_stall_interactions; a trigger counts each change.
create or replace function app_private.user_stall_affinities_from_interaction()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_was_saved boolean := tg_op = 'UPDATE' and coalesce(old.is_saved, false);
  v_was_tried boolean := tg_op = 'UPDATE' and coalesce(old.is_tried, false);
begin
  if new.is_saved and not v_was_saved then
    perform app_private.apply_stall_affinity_event(new.user_id, new.stall_id, 3, coalesce(new.saved_at, now()));
  elsif v_was_saved and not new.is_saved then
    perform app_private.apply_stall_affinity_event(new.user_id, new.stall_id, -2, now());
  end if;
  if new.is_tried and not v_was_tried then
    perform app_private.apply_stall_affinity_event(new.user_id, new.stall_id, 3, coalesce(new.tried_at, now()));
  end if;
  return new;
end;
$$;

revoke all on function app_private.user_stall_affinities_from_interaction() from public, anon, authenticated;

drop trigger if exists user_stall_affinities_from_interaction on public.user_stall_interactions;
create trigger user_stall_affinities_from_interaction
after insert or update of is_saved, is_tried on public.user_stall_interactions
for each row execute function app_private.user_stall_affinities_from_interaction();

insert into app_private.request_rate_rules (route, anon_per_minute, user_per_minute, note) values
  ('rpc/record_stall_signal', null, 60, 'stall views, directions, shares and Not for me for recommendations')
on conflict (route) do nothing;

-- 4. The PDPA export includes stall history.
-- Skipped when the key is already there (the find text is part of its own replacement).
select pg_temp.patch_function(
  'app_private.export_my_data()'::regprocedure,
  $find$    'foodHistory',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_dish_affinities t where t.user_id = v_user), '[]'::jsonb),$find$,
  $replace$    'foodHistory',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_dish_affinities t where t.user_id = v_user), '[]'::jsonb),
    'stallHistory',
      coalesce((select jsonb_agg(to_jsonb(t)) from public.user_stall_affinities t where t.user_id = v_user), '[]'::jsonb),$replace$
)
where position('stallHistory' in (select prosrc from pg_proc where oid = 'app_private.export_my_data()'::regprocedure)) = 0;
