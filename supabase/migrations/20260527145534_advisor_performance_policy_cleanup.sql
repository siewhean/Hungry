-- Resolve app-owned Supabase Performance Advisor policy findings:
-- - auth_rls_initplan: wrap auth/current_setting calls in scalar initplans.
-- - multiple_permissive_policies: split broad write policies away from SELECT
--   and merge same-action policies where they overlap for the same role.

begin;

create or replace function pg_temp.hungry_advisor_fix_policy_expr(p_expr text)
returns text
language plpgsql
as $fn$
declare
  v_result text := p_expr;
begin
  if v_result is null then
    return null;
  end if;

  if v_result ~ 'auth\.uid\(\)' and v_result !~* 'select\s+auth\.uid\(\)' then
    v_result := replace(v_result, 'auth.uid()', '(select auth.uid())');
  end if;

  if v_result ~ 'auth\.role\(\)' and v_result !~* 'select\s+auth\.role\(\)' then
    v_result := replace(v_result, 'auth.role()', '(select auth.role())');
  end if;

  if v_result ~ 'auth\.jwt\(\)' and v_result !~* 'select\s+auth\.jwt\(\)' then
    v_result := replace(v_result, 'auth.jwt()', '(select auth.jwt())');
  end if;

  if v_result ~ 'current_setting\(' and v_result !~* 'select\s+current_setting\(' then
    v_result := replace(
      v_result,
      'current_setting(''request.jwt.claims''::text, true)',
      '(select current_setting(''request.jwt.claims''::text, true))'
    );
    v_result := replace(
      v_result,
      'current_setting(''request.jwt.claim.sub''::text, true)',
      '(select current_setting(''request.jwt.claim.sub''::text, true))'
    );
    v_result := replace(
      v_result,
      'current_setting(''request.jwt.claim.role''::text, true)',
      '(select current_setting(''request.jwt.claim.role''::text, true))'
    );
  end if;

  return v_result;
end;
$fn$;

do $$
declare
  rec record;
  v_qual text;
  v_check text;
  v_sql text;
begin
  for rec in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~ '(auth\.|current_setting\()'
        or coalesce(with_check, '') ~ '(auth\.|current_setting\()'
      )
  loop
    v_qual := pg_temp.hungry_advisor_fix_policy_expr(rec.qual);
    v_check := pg_temp.hungry_advisor_fix_policy_expr(rec.with_check);

    if v_qual is distinct from rec.qual
      or v_check is distinct from rec.with_check
    then
      v_sql := format(
        'alter policy %I on %I.%I',
        rec.policyname,
        rec.schemaname,
        rec.tablename
      );

      if v_qual is not null then
        v_sql := v_sql || format(' using (%s)', v_qual);
      end if;

      if v_check is not null then
        v_sql := v_sql || format(' with check (%s)', v_check);
      end if;

      execute v_sql;
    end if;
  end loop;
end;
$$;

do $$
declare
  rec record;
  v_roles text;
  v_qual text;
  v_check text;
begin
  for rec in
    select *
    from pg_policies
    where schemaname = 'public'
      and cmd = 'ALL'
      and policyname = any(array[
        'dishes_write_merchant_owner_or_manager',
        'merchant_notifications_owner_manager_write',
        'merchant_outlets_write_owner_or_manager',
        'merchant_promotions_write_owner_or_manager',
        'merchant_verification_evidence_write_owner_or_manager',
        'merchant_verifications_write_owner_or_manager',
        'post_media_write_own_post',
        'privacy_settings_write_own',
        'read_receipts_upsert_reader'
      ])
  loop
    select string_agg(format('%I', role_name), ', ' order by role_name)
      into v_roles
    from unnest(rec.roles) as role_name;

    v_qual := pg_temp.hungry_advisor_fix_policy_expr(rec.qual);
    v_check := pg_temp.hungry_advisor_fix_policy_expr(coalesce(rec.with_check, rec.qual));

    execute format('drop policy if exists %I on %I.%I', rec.policyname, rec.schemaname, rec.tablename);

    if rec.with_check is not null then
      execute format(
        'drop policy if exists %I on %I.%I',
        rec.policyname || '_insert',
        rec.schemaname,
        rec.tablename
      );
      execute format(
        'create policy %I on %I.%I for insert to %s with check (%s)',
        rec.policyname || '_insert',
        rec.schemaname,
        rec.tablename,
        v_roles,
        pg_temp.hungry_advisor_fix_policy_expr(rec.with_check)
      );
    end if;

    if rec.qual is not null then
      execute format(
        'drop policy if exists %I on %I.%I',
        rec.policyname || '_update',
        rec.schemaname,
        rec.tablename
      );
      execute format(
        'create policy %I on %I.%I for update to %s using (%s) with check (%s)',
        rec.policyname || '_update',
        rec.schemaname,
        rec.tablename,
        v_roles,
        v_qual,
        v_check
      );

      execute format(
        'drop policy if exists %I on %I.%I',
        rec.policyname || '_delete',
        rec.schemaname,
        rec.tablename
      );
      execute format(
        'create policy %I on %I.%I for delete to %s using (%s)',
        rec.policyname || '_delete',
        rec.schemaname,
        rec.tablename,
        v_roles,
        v_qual
      );
    end if;
  end loop;
end;
$$;

drop policy if exists "Admins can view all flags" on public.portfolio_flags;
drop policy if exists "Users can view own flags" on public.portfolio_flags;
drop policy if exists portfolio_flags_select_own_or_admin on public.portfolio_flags;
create policy portfolio_flags_select_own_or_admin
on public.portfolio_flags
for select
to public
using (
  app_is_current_user_ops_admin()
  or reporter_id = (select auth.uid())
);

drop policy if exists "Collaborators can view portfolios" on public.portfolios;
drop policy if exists "Users can view followers_only portfolios if following owner" on public.portfolios;
drop policy if exists "Users can view own portfolios" on public.portfolios;
drop policy if exists "Users can view public portfolios" on public.portfolios;
drop policy if exists portfolios_select_visible on public.portfolios;
create policy portfolios_select_visible
on public.portfolios
for select
to public
using (
  visibility = 'public'
  or owner_id = (select auth.uid())
  or (
    visibility = 'followers_only'
    and exists (
      select 1
      from public.follows
      where follows.follower_id = (select auth.uid())
        and follows.followee_id = portfolios.owner_id
        and follows.status = 'approved'
    )
  )
  or exists (
    select 1
    from public.portfolio_collaborators
    where portfolio_collaborators.portfolio_id = portfolios.id
      and portfolio_collaborators.user_id = (select auth.uid())
  )
);

drop policy if exists popular_visitor_pins_merchant_read on public.merchant_popular_visitor_pins;
drop policy if exists popular_visitor_pins_public_active_read on public.merchant_popular_visitor_pins;
drop policy if exists popular_visitor_pins_anon_active_read on public.merchant_popular_visitor_pins;
drop policy if exists popular_visitor_pins_authenticated_read on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_anon_active_read
on public.merchant_popular_visitor_pins
for select
to anon
using (is_active = true);
create policy popular_visitor_pins_authenticated_read
on public.merchant_popular_visitor_pins
for select
to authenticated
using (
  is_active = true
  or merchant_can_manage_outlet_v2(outlet_id)
);

drop policy if exists reviews_update_authenticated on public.reviews;
drop policy if exists reviews_update_merchant_reply_owner_or_manager on public.reviews;
drop policy if exists reviews_update_author_or_merchant on public.reviews;
create policy reviews_update_author_or_merchant
on public.reviews
for update
to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.merchant_outlets mo
    left join public.merchant_accounts ma
      on ma.id = mo.merchant_account_id
    left join public.merchant_roles mr
      on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = reviews.venue_id
      and (
        ma.user_id = (select auth.uid())
        or (
          mr.user_id = (select auth.uid())
          and mr.role = any(array['owner'::text, 'manager'::text])
        )
      )
  )
)
with check (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.merchant_outlets mo
    left join public.merchant_accounts ma
      on ma.id = mo.merchant_account_id
    left join public.merchant_roles mr
      on mr.merchant_account_id = mo.merchant_account_id
    where mo.venue_id = reviews.venue_id
      and (
        ma.user_id = (select auth.uid())
        or (
          mr.user_id = (select auth.uid())
          and mr.role = any(array['owner'::text, 'manager'::text])
        )
      )
  )
);

commit;
