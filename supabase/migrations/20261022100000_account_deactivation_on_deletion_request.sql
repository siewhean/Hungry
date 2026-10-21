-- Profile and content are hidden while an account is waiting to be deleted, and a
-- merchant owner cannot queue deletion without handing the business over
-- (round-two settings mediums M1 and M2).
--
-- M1: requesting deletion only inserted a request row, so the profile, bio,
-- Lists, reviews and posts stayed public for the whole 30-day grace period.
-- A pending request ('requested' or 'processing') now deactivates the account
-- for every other viewer:
--   * app_private.can_read_author_content (profile row in public_profiles,
--     posts, comments, follower lists, profile card, profile review list) is
--     false for anyone but the owner;
--   * the review read guard hides the person's reviews from dish pages;
--   * Lists (portfolios and their items, through the portfolios RLS), the public
--     shared-list RPC and list search skip their lists.
-- The owner still sees everything, and "Keep my account" (cancel) brings it all
-- back, because nothing is deleted until the worker runs.
-- Not changed: a venue's own merchants keep read access to reviews of their venue
-- (app_private.can_read_review 3-arg), and rating aggregates are not recomputed.
--
-- M2: the deletion worker deletes the person's merchant_roles rows and renames
-- their merchant account, which left a stall with no owner. The request RPC now
-- refuses with 'merchant_owner_must_transfer' while the user owns a merchant
-- account (merchant_accounts.user_id, an 'owner' merchant_roles row or an active
-- 'owner' merchant_members row). The app checks first and shows the same message.
--
-- Redefined: app_private.can_read_author_content(uuid) (body of 0041 as moved to
-- app_private by 20260522142004, plus the deactivation check),
-- app_private.can_read_review(uuid, uuid) (20261019041100),
-- public.get_public_portfolio(uuid) (20261018050000),
-- app_private.search_portfolios(text, text, text) (20261020040000),
-- app_private.request_my_account_deletion(text) (20261020050000).
-- New: app_private.account_is_deactivated(uuid), restrictive policy
-- portfolios_select_hide_deactivated, app_private.account_deletion_blocker(uuid),
-- public.get_my_account_deletion_blocker() (invoker wrapper over a definer body;
-- returns 'merchant_owner_must_transfer' or null).

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

create or replace function app_private.account_is_deactivated(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p_user_id is not null
    and exists (
      select 1
      from public.account_deletion_requests adr
      where adr.user_id = p_user_id
        and adr.status in ('requested', 'processing')
    );
$$;

revoke all on function app_private.account_is_deactivated(uuid) from public;
grant execute on function app_private.account_is_deactivated(uuid)
  to anon, authenticated, service_role;

comment on function app_private.account_is_deactivated(uuid) is
  'True while the account has a pending deletion request; other viewers then see no profile or content.';

-- Same body as 0041 (now in app_private) with the owner check first and the
-- deactivation check on every other path.
create or replace function app_private.can_read_author_content(p_author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_author_id is not null
    and (
      auth.uid() = p_author_id
      or (
        not app_private.account_is_deactivated(p_author_id)
        and (
          (
            not public.app_user_block_exists(auth.uid(), p_author_id)
            and (
              coalesce((
                select ps.account_visibility = 'public'
                from privacy_settings ps
                where ps.user_id = p_author_id
              ), true)
              or exists (
                select 1
                from follows f
                where f.followee_id = p_author_id
                  and f.follower_id = auth.uid()
                  and f.status = 'approved'
              )
            )
          )
          or (
            auth.uid() is null
            and coalesce((
              select ps.account_visibility = 'public'
              from privacy_settings ps
              where ps.user_id = p_author_id
            ), true)
          )
        )
      )
    );
$$;

-- Reviews: the author always reads their own; otherwise a deactivated author's
-- reviews are hidden, then the block / own-report rules from 20261019041100
-- apply (signed-out readers have no block or report to check).
create or replace function app_private.can_read_review(
  p_review_id uuid,
  p_author_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(p_author_id = auth.uid(), false)
    or (
      not app_private.account_is_deactivated(p_author_id)
      and (
        auth.uid() is null
        or (
          (
            p_author_id is null
            or not app_private.app_user_block_exists(auth.uid(), p_author_id)
          )
          and not exists (
            select 1
            from public.content_reports cr
            where cr.reporter_id = auth.uid()
              and cr.target_type = 'review'
              and cr.target_id = p_review_id::text
          )
        )
      )
    );
$$;

-- Lists: hide a deactivated owner's lists from everyone else.
drop policy if exists portfolios_select_hide_deactivated on public.portfolios;
create policy portfolios_select_hide_deactivated
on public.portfolios
as restrictive
for select
to anon, authenticated
using (
  owner_id = (select auth.uid())
  or not app_private.account_is_deactivated(owner_id)
);

create or replace function public.get_public_portfolio(p_portfolio_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'type', p.type,
    'owner_display_name', up.display_name,
    'updated_at', p.updated_at,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'item_type', i.item_type,
          'dish_id', i.dish_id,
          'stall_id', coalesce(i.stall_id, d.venue_id),
          'name', coalesce(d.name, v.name),
          'stall_name', coalesce(dv.name, v.name),
          'price', d.price,
          'score', i.score,
          'public_notes', i.public_notes,
          'image_url', case when d.media_approved_for_display then d.image_url end,
          'map_query', nullif(concat_ws(', ',
            coalesce(dv.name, v.name),
            coalesce(dv.unit_number, v.unit_number),
            b.name,
            coalesce(dv.address, v.address, b.address),
            'Singapore ' || coalesce(dv.postal_code, v.postal_code, b.postal_code)
          ), '')
        )
        order by i.position, i.created_at
      )
      from public.portfolio_items i
      left join public.dishes d on d.id = i.dish_id
      left join public.venues dv on dv.id = d.venue_id
      left join public.venues v on v.id = i.stall_id
      left join public.buildings b on b.id = coalesce(dv.building_id, v.building_id)
      where i.portfolio_id = p.id
    ), '[]'::jsonb)
  )
  from public.portfolios p
  left join public.user_profiles up on up.id = p.owner_id
  where p.id = p_portfolio_id
    and p.visibility = 'public'
    and not app_private.account_is_deactivated(p.owner_id);
$$;

revoke all on function public.get_public_portfolio(uuid) from public;
grant execute on function public.get_public_portfolio(uuid) to anon, authenticated;

create or replace function app_private.search_portfolios(
  p_query text,
  p_type text default null,
  p_visibility text default 'public'
)
returns table (
  id uuid,
  owner_id uuid,
  name text,
  description text,
  type text,
  visibility text,
  published_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  item_count bigint,
  follower_count bigint
)
language plpgsql
security definer
-- extensions holds pg_trgm (similarity) on Supabase; public covers older installs.
set search_path = public, extensions, pg_temp
as $$
declare
  -- Escape LIKE metacharacters so "50%" or "a_b" match literally.
  v_pattern text := '%' || replace(replace(replace(lower(coalesce(p_query, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  return query
  select
    p.id,
    p.owner_id,
    p.name,
    p.description,
    p.type,
    p.visibility,
    p.published_at,
    p.created_at,
    p.updated_at,
    (select count(*) from public.portfolio_items where portfolio_id = p.id) as item_count,
    (select count(*) from public.portfolio_follows where portfolio_id = p.id) as follower_count
  from public.portfolios p
  where
    (p_visibility is null or p.visibility = p_visibility)
    and (p_type is null or p.type = p_type)
    and lower(p.name || ' ' || coalesce(p.description, '')) like v_pattern escape '\'
    and (p.owner_id = auth.uid() or not app_private.account_is_deactivated(p.owner_id))
    and (
      p.visibility = 'public'
      or p.owner_id = auth.uid()
      or (
        p.visibility = 'followers_only' and
        exists (
          select 1 from public.follows
          where follows.follower_id = auth.uid()
          and follows.followee_id = p.owner_id
          and follows.status = 'approved'
        )
      )
      or exists (
        select 1 from public.portfolio_collaborators
        where portfolio_collaborators.portfolio_id = p.id
        and portfolio_collaborators.user_id = auth.uid()
      )
    )
  order by
    case
      when nullif(trim(coalesce(p_query, '')), '') is null then 0
      else similarity(lower(p.name || ' ' || coalesce(p.description, '')), lower(p_query))
    end desc,
    p.created_at desc
  limit 100;
end;
$$;

revoke all on function app_private.search_portfolios(text, text, text) from public, anon;
grant execute on function app_private.search_portfolios(text, text, text) to authenticated, service_role;

-- M2: what stops a user from deleting their account, or null. Only one reason
-- today: they own a merchant account.
create or replace function app_private.account_deletion_blocker(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when p_user_id is null then null
    when exists (select 1 from public.merchant_accounts ma where ma.user_id = p_user_id)
      or exists (
        select 1 from public.merchant_roles mr
        where mr.user_id = p_user_id and mr.role = 'owner'
      )
      or exists (
        select 1 from public.merchant_members mm
        where mm.user_id = p_user_id and mm.role = 'owner' and mm.status = 'active'
      )
    then 'merchant_owner_must_transfer'
    else null
  end;
$$;

revoke all on function app_private.account_deletion_blocker(uuid) from public, anon, authenticated;
grant execute on function app_private.account_deletion_blocker(uuid) to service_role;

-- The app asks before it emails a deletion code, so nobody types a code first.
create or replace function app_private.get_my_account_deletion_blocker()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select app_private.account_deletion_blocker(auth.uid());
$$;

revoke all on function app_private.get_my_account_deletion_blocker() from public, anon, authenticated;
grant execute on function app_private.get_my_account_deletion_blocker() to authenticated, service_role;

create or replace function public.get_my_account_deletion_blocker()
returns text
language sql
stable
security invoker
set search_path = public, app_private
as $$
  select app_private.get_my_account_deletion_blocker();
$$;

revoke all on function public.get_my_account_deletion_blocker() from public, anon;
grant execute on function public.get_my_account_deletion_blocker() to authenticated, service_role;

-- Same body as 20261020050000 plus the merchant owner refusal. A repeat
-- request still returns the pending date first, so the refusal only applies to a
-- new request.
create or replace function app_private.request_my_account_deletion(p_reason text default null)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_scheduled_for timestamptz;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select adr.scheduled_for
  into v_scheduled_for
  from public.account_deletion_requests adr
  where adr.user_id = v_user_id
    and adr.status in ('requested', 'processing')
  order by adr.created_at desc
  limit 1;

  if v_scheduled_for is not null then
    return v_scheduled_for;
  end if;

  if app_private.account_deletion_blocker(v_user_id) is not null then
    raise exception 'merchant_owner_must_transfer'
      using errcode = 'P0001',
        hint = 'Transfer the business to another owner or contact support before deleting this account.';
  end if;

  -- status, scheduled_for and legal_hold come from the table defaults.
  insert into public.account_deletion_requests (user_id, reason)
  values (v_user_id, left(nullif(trim(coalesce(p_reason, '')), ''), 200))
  returning scheduled_for into v_scheduled_for;

  return v_scheduled_for;
end;
$$;
