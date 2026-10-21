-- "Something wrong?" on stall and dish pages (round-two medium detail-M11).
--
-- Catalog data is imported, so prices and hours go stale. Diners can now tell
-- us: the stall page and the dish page send a correction (closed, wrong price,
-- wrong hours, wrong dish info, other) into this ops queue.
--
--   * Signed-in diners only; the RPC is the only write path (no direct table
--     grants), so the reporter is always auth.uid().
--   * At most 10 corrections per diner per day, and the same diner repeating the
--     same open correction for the same stall/dish/kind within 24 hours is
--     ignored instead of piling up.
--   * Only ops admins can read the queue and change its status.

begin;

create table if not exists public.catalog_corrections (
  id uuid primary key default gen_random_uuid(),
  venue_id text not null references public.venues(id) on delete cascade,
  dish_id text references public.dishes(id) on delete cascade,
  reporter_id uuid not null references public.user_profiles(id) on delete cascade,
  kind text not null check (kind in ('closed', 'wrong_price', 'wrong_hours', 'wrong_dish_info', 'other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open', 'fixed', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_catalog_corrections_open
  on public.catalog_corrections (created_at desc)
  where status = 'open';
create index if not exists idx_catalog_corrections_reporter_recent
  on public.catalog_corrections (reporter_id, created_at desc);
create index if not exists idx_catalog_corrections_venue
  on public.catalog_corrections (venue_id, created_at desc);

alter table public.catalog_corrections enable row level security;

revoke all on public.catalog_corrections from anon, authenticated;
grant select, update on public.catalog_corrections to authenticated;

drop policy if exists catalog_corrections_ops_read on public.catalog_corrections;
create policy catalog_corrections_ops_read
on public.catalog_corrections for select
to authenticated
using (public.app_is_current_user_ops_admin());

drop policy if exists catalog_corrections_ops_update on public.catalog_corrections;
create policy catalog_corrections_ops_update
on public.catalog_corrections for update
to authenticated
using (public.app_is_current_user_ops_admin())
with check (public.app_is_current_user_ops_admin());

create or replace function public.submit_catalog_correction(
  p_venue_id text,
  p_kind text,
  p_dish_id text default null,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_kind text := lower(nullif(trim(coalesce(p_kind, '')), ''));
  v_note text := left(nullif(trim(coalesce(p_note, '')), ''), 500);
  v_id uuid;
begin
  if v_user is null then
    raise exception 'Sign in to report a problem.' using errcode = '42501';
  end if;

  if v_kind is null
     or v_kind not in ('closed', 'wrong_price', 'wrong_hours', 'wrong_dish_info', 'other') then
    raise exception 'Unsupported correction kind.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.venues v where v.id = p_venue_id) then
    raise exception 'Unknown stall.' using errcode = '22023';
  end if;

  if p_dish_id is not null
     and not exists (
       select 1 from public.dishes d where d.id = p_dish_id and d.venue_id = p_venue_id
     ) then
    raise exception 'That dish does not belong to this stall.' using errcode = '22023';
  end if;

  -- The same open report from the same diner is already in the queue.
  select cc.id into v_id
  from public.catalog_corrections cc
  where cc.reporter_id = v_user
    and cc.venue_id = p_venue_id
    and cc.dish_id is not distinct from p_dish_id
    and cc.kind = v_kind
    and cc.status = 'open'
    and cc.created_at > now() - interval '24 hours'
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  if (
    select count(*) from public.catalog_corrections cc
    where cc.reporter_id = v_user and cc.created_at > now() - interval '24 hours'
  ) >= 10 then
    raise exception 'You have sent a lot of reports today. Try again tomorrow.'
      using errcode = '54000';
  end if;

  insert into public.catalog_corrections (venue_id, dish_id, reporter_id, kind, note)
  values (p_venue_id, p_dish_id, v_user, v_kind, v_note)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_catalog_correction(text, text, text, text) from public, anon;
grant execute on function public.submit_catalog_correction(text, text, text, text) to authenticated;

commit;
