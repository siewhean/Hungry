-- Security hardening pass for Supabase Advisor findings.
-- Idempotent and safe to re-run.

-- -------------------------------------------------------------------------
-- 1) Harden function search_path (Advisor: Function Search Path Mutable)
-- -------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.update_dish_rating()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update dishes
    set
      review_count = (select count(*)::int from reviews where dish_id = new.dish_id),
      rating_avg = coalesce(
        (select round(avg(rating)::numeric, 2) from reviews where dish_id = new.dish_id),
        0
      )
    where id = new.dish_id;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    update dishes
    set
      review_count = (select count(*)::int from reviews where dish_id = old.dish_id),
      rating_avg = coalesce(
        (select round(avg(rating)::numeric, 2) from reviews where dish_id = old.dish_id),
        0
      )
    where id = old.dish_id;

    update dishes
    set
      review_count = (select count(*)::int from reviews where dish_id = new.dish_id),
      rating_avg = coalesce(
        (select round(avg(rating)::numeric, 2) from reviews where dish_id = new.dish_id),
        0
      )
    where id = new.dish_id;

    return new;
  end if;

  update dishes
  set
    review_count = (select count(*)::int from reviews where dish_id = old.dish_id),
    rating_avg = coalesce(
      (select round(avg(rating)::numeric, 2) from reviews where dish_id = old.dish_id),
      0
    )
  where id = old.dish_id;

  return old;
end;
$$;

-- -------------------------------------------------------------------------
-- 2) RLS disabled in public.spatial_ref_sys
-- -------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.spatial_ref_sys') is not null then
    begin
      execute 'alter table public.spatial_ref_sys enable row level security';
      execute 'drop policy if exists spatial_ref_sys_read_all on public.spatial_ref_sys';
      execute 'create policy spatial_ref_sys_read_all on public.spatial_ref_sys for select using (true)';
    exception
      when insufficient_privilege then
        raise notice
          'Skipping spatial_ref_sys RLS hardening (extension-owned table; insufficient privilege).';
      when object_not_in_prerequisite_state then
        raise notice
          'Skipping spatial_ref_sys RLS hardening (table does not support requested change in current state).';
    end;
  end if;
end
$$;

-- -------------------------------------------------------------------------
-- 3) RLS enabled but no policy (keep app-unsafe tables locked to service_role)
-- -------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.guest_sessions') is not null then
    execute 'alter table public.guest_sessions enable row level security';
    execute 'drop policy if exists guest_sessions_service_role_all on public.guest_sessions';
    execute 'create policy guest_sessions_service_role_all on public.guest_sessions for all to service_role using (true) with check (true)';
  end if;

  if to_regclass('public.menu_photo_submissions') is not null then
    execute 'alter table public.menu_photo_submissions enable row level security';
    execute 'drop policy if exists menu_photo_submissions_service_role_all on public.menu_photo_submissions';
    execute 'create policy menu_photo_submissions_service_role_all on public.menu_photo_submissions for all to service_role using (true) with check (true)';
  end if;

  if to_regclass('public.dishes_draft') is not null then
    execute 'alter table public.dishes_draft enable row level security';
    execute 'drop policy if exists dishes_draft_service_role_all on public.dishes_draft';
    execute 'create policy dishes_draft_service_role_all on public.dishes_draft for all to service_role using (true) with check (true)';
  end if;

  if to_regclass('public.merchant_claim_interests') is not null then
    execute 'alter table public.merchant_claim_interests enable row level security';
    execute 'drop policy if exists merchant_claim_interests_service_role_all on public.merchant_claim_interests';
    execute 'create policy merchant_claim_interests_service_role_all on public.merchant_claim_interests for all to service_role using (true) with check (true)';
  end if;
end
$$;

-- -------------------------------------------------------------------------
-- 4) Public bucket allows listing (storage.media)
--    Harden by making bucket private + limiting SELECT to service_role.
-- -------------------------------------------------------------------------
do $$
declare
  p record;
begin
  if exists (select 1 from storage.buckets where id = 'media') then
    update storage.buckets set public = false where id = 'media';

    -- Drop existing SELECT policies that target media bucket.
    for p in
      select policyname
      from pg_policies
      where schemaname = 'storage'
        and tablename = 'objects'
        and cmd = 'SELECT'
        and (
          coalesce(qual, '') ilike '%media%'
          or policyname ilike '%media%'
        )
    loop
      execute format('drop policy if exists %I on storage.objects', p.policyname);
    end loop;

    execute 'drop policy if exists media_objects_service_role_select on storage.objects';
    execute format(
      'create policy %I on storage.objects for select to service_role using (bucket_id = %L)',
      'media_objects_service_role_select',
      'media'
    );
  end if;
end
$$;
