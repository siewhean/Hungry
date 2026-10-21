-- Lists, round-two medium and low fixes (lists-extras M1, M8, M10, L7).
--
-- M1  Republishing after Unpublish did nothing: Unpublish only sets visibility to
--     private, so published_at stayed set and the publish RPC's
--     `published_at is null` filter matched zero rows. Publish now always makes the
--     list public and keeps the first published_at; the passport award still
--     happens on the first publish only.
-- M8  portfolio_collaborators: an owner could add anyone (including someone who
--     blocked them) with no way for that person to leave, and anyone who could see
--     a public list could read its collaborator ids and roles straight from the
--     table, bypassing the block filter in list_portfolio_collaborators.
--       * insert: owner only, not yourself, not across a block, and only people the
--         owner follows (approved) - the same people the app's picker offers;
--       * delete: the owner, or the collaborator removing their own row (leave);
--       * select: the owner and the collaborator's own row only. Everyone else reads
--         collaborators through list_portfolio_collaborators.
--     Table SELECT is not revoked: getSharedPortfolioIds and the definer helpers
--     read the caller's own rows, which the policy still allows.
-- L12 the owner can change a collaborator's role in place (role column only).
-- M10 description and notes had no length limit. 500 characters, existing longer
--     values are trimmed first so the constraint can be validated.
-- M14 get_portfolio_item_details returns a whole list's item names, photos and prices
--     in one call (the app asked once per item).
-- L7  get_public_portfolio and add_portfolio_item_with_passport read public.dishes
--     as definer without the displayability rule that public_select_dishes applies,
--     so a draft or unapproved dish id could show its name and price on a share
--     page. Both now use public.catalog_menu_is_displayable.

begin;

create schema if not exists app_private;

-- ---------------------------------------------------------------------------
-- M1: publish_portfolio_with_passport (definer body lives in app_private; the
-- public function is an invoker wrapper from 20260527144633).
-- ---------------------------------------------------------------------------
create or replace function app_private.publish_portfolio_with_passport(
  p_portfolio_id uuid,
  p_expected_portfolio_updated_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_portfolio_type text;
  v_first_publish boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_portfolio_expected_updated_at(
    p_portfolio_id,
    p_expected_portfolio_updated_at
  );

  select type, published_at is null
    into v_portfolio_type, v_first_publish
  from public.portfolios
  where id = p_portfolio_id
  and owner_id = auth.uid();

  if v_portfolio_type is null then
    raise exception 'Portfolio not found or not editable';
  end if;

  -- Always public afterwards, so publishing again after Unpublish works. The first
  -- published_at is kept. A list taken down by moderators is still refused by the
  -- portfolios_moderation_lock trigger.
  update public.portfolios
  set published_at = coalesce(published_at, now()),
      visibility = 'public',
      updated_at = now()
  where id = p_portfolio_id
  and owner_id = auth.uid();

  if v_first_publish then
    perform public.record_passport_progress('contributor', 'public_portfolio_published', p_portfolio_id::text);
    if v_portfolio_type = 'trail' then
      perform public.record_passport_progress('contributor', 'trail_completed', p_portfolio_id::text);
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- M10: length limits (existing longer values are trimmed so the checks validate).
-- ---------------------------------------------------------------------------
update public.portfolios
set description = left(description, 500)
where char_length(description) > 500;

update public.portfolio_items
set public_notes = left(public_notes, 500)
where char_length(public_notes) > 500;

update public.portfolio_items
set private_notes = left(private_notes, 500)
where char_length(private_notes) > 500;

alter table public.portfolios
  drop constraint if exists portfolios_description_length;
alter table public.portfolios
  add constraint portfolios_description_length
  check (description is null or char_length(description) <= 500);

alter table public.portfolio_items
  drop constraint if exists portfolio_items_public_notes_length;
alter table public.portfolio_items
  add constraint portfolio_items_public_notes_length
  check (public_notes is null or char_length(public_notes) <= 500);

alter table public.portfolio_items
  drop constraint if exists portfolio_items_private_notes_length;
alter table public.portfolio_items
  add constraint portfolio_items_private_notes_length
  check (private_notes is null or char_length(private_notes) <= 500);

-- ---------------------------------------------------------------------------
-- M8: collaborator policies. is_portfolio_owner is a definer helper that reads
-- portfolios without RLS, so these policies cannot join an RLS cycle.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view collaborators if can view portfolio"
  on public.portfolio_collaborators;
drop policy if exists "Owners and collaborators can view their collaborator rows"
  on public.portfolio_collaborators;
create policy "Owners and collaborators can view their collaborator rows"
  on public.portfolio_collaborators for select
  using (
    user_id = (select auth.uid())
    or app_private.is_portfolio_owner(portfolio_id)
  );

drop policy if exists "Owners can add collaborators" on public.portfolio_collaborators;
create policy "Owners can add collaborators"
  on public.portfolio_collaborators for insert
  with check (
    app_private.is_portfolio_owner(portfolio_id)
    and user_id <> (select auth.uid())
    and not app_private.app_user_block_exists((select auth.uid()), user_id)
    and exists (
      select 1
      from public.follows
      where follows.follower_id = (select auth.uid())
        and follows.followee_id = portfolio_collaborators.user_id
        and follows.status = 'approved'
    )
  );

drop policy if exists "Owners can remove collaborators" on public.portfolio_collaborators;
drop policy if exists "Owners can remove collaborators or collaborators can leave"
  on public.portfolio_collaborators;
create policy "Owners can remove collaborators or collaborators can leave"
  on public.portfolio_collaborators for delete
  using (
    user_id = (select auth.uid())
    or app_private.is_portfolio_owner(portfolio_id)
  );

-- L12: the owner changes a collaborator's role in place (only the role column),
-- instead of removing and re-adding the person.
drop policy if exists "Owners can change collaborator roles" on public.portfolio_collaborators;
create policy "Owners can change collaborator roles"
  on public.portfolio_collaborators for update
  using (app_private.is_portfolio_owner(portfolio_id))
  with check (app_private.is_portfolio_owner(portfolio_id));

revoke update on table public.portfolio_collaborators from public, anon, authenticated;
grant update (role) on table public.portfolio_collaborators to authenticated;

-- ---------------------------------------------------------------------------
-- L7: get_public_portfolio (base: 20261018050000_public_portfolio_photos_maps).
-- A dish that does not pass the public displayability rule is left out.
-- ---------------------------------------------------------------------------
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
      left join public.dishes d
        on d.id = i.dish_id
        and public.catalog_menu_is_displayable(
          d.menu_approved_for_display,
          d.menu_rights_status,
          d.menu_source_url
        )
      left join public.venues dv on dv.id = d.venue_id
      left join public.venues v on v.id = i.stall_id
      left join public.buildings b on b.id = coalesce(dv.building_id, v.building_id)
      where i.portfolio_id = p.id
        and (i.dish_id is null or d.id is not null)
    ), '[]'::jsonb)
  )
  from public.portfolios p
  left join public.user_profiles up on up.id = p.owner_id
  where p.id = p_portfolio_id and p.visibility = 'public';
$$;

revoke all on function public.get_public_portfolio(uuid) from public;
grant execute on function public.get_public_portfolio(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- L7: add_portfolio_item_with_passport (definer body in app_private; base:
-- 20260527103000_checklist_portfolio_passport). A dish the public cannot see
-- cannot be added to a list.
-- ---------------------------------------------------------------------------
create or replace function app_private.add_portfolio_item_with_passport(
  p_portfolio_id uuid,
  p_item_type text,
  p_dish_id text default null,
  p_stall_id text default null,
  p_score integer default null,
  p_public_notes text default null,
  p_private_notes text default null,
  p_expected_portfolio_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
  v_category_id text := 'contributor';
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform public.assert_portfolio_expected_updated_at(
    p_portfolio_id,
    p_expected_portfolio_updated_at
  );

  if p_item_type not in ('dish', 'stall') then
    raise exception 'Invalid portfolio item type';
  end if;

  if p_item_type = 'dish' and (p_dish_id is null or p_stall_id is not null) then
    raise exception 'Dish portfolio items require only dish_id';
  end if;

  if p_item_type = 'stall' and (p_stall_id is null or p_dish_id is not null) then
    raise exception 'Stall portfolio items require only stall_id';
  end if;

  if p_score is not null and (p_score < 1 or p_score > 10) then
    raise exception 'Portfolio item score must be between 1 and 10';
  end if;

  if not exists (
    select 1
    from public.portfolios p
    where p.id = p_portfolio_id
    and (
      p.owner_id = auth.uid()
      or exists (
        select 1
        from public.portfolio_collaborators pc
        where pc.portfolio_id = p.id
        and pc.user_id = auth.uid()
        and pc.role = 'editor'
      )
    )
  ) then
    raise exception 'Portfolio not found or not editable';
  end if;

  if p_item_type = 'dish' and not exists (
    select 1
    from public.dishes d
    where d.id = p_dish_id
    and public.catalog_menu_is_displayable(
      d.menu_approved_for_display,
      d.menu_rights_status,
      d.menu_source_url
    )
  ) then
    raise exception 'This dish is not available to add to a list';
  end if;

  if exists (
    select 1
    from public.portfolio_items pi
    where pi.portfolio_id = p_portfolio_id
    and pi.item_type = p_item_type
    and coalesce(pi.dish_id, '') = coalesce(p_dish_id, '')
    and coalesce(pi.stall_id, '') = coalesce(p_stall_id, '')
  ) then
    raise exception 'This item is already in the portfolio';
  end if;

  -- Insert portfolio item
  insert into public.portfolio_items (
    portfolio_id, item_type, dish_id, stall_id, score, public_notes, private_notes, position
  )
  values (
    p_portfolio_id, p_item_type, p_dish_id, p_stall_id, p_score, p_public_notes, p_private_notes,
    coalesce((select max(position) + 1 from public.portfolio_items where portfolio_id = p_portfolio_id), 0)
  )
  returning id into v_item_id;

  update public.portfolios
  set updated_at = now()
  where id = p_portfolio_id;

  perform public.record_passport_progress(v_category_id, 'portfolio_item_added', v_item_id::text);

  return v_item_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- M14: names, photos and prices for a whole list in one call (the app used to ask
-- once per item). SECURITY INVOKER: portfolio_items RLS limits it to lists the
-- caller can see, and dishes/venues RLS leaves out dishes the public cannot see,
-- so those rows come back with a null name.
-- ---------------------------------------------------------------------------
create or replace function public.get_portfolio_item_details(p_portfolio_id uuid)
returns table (
  item_id uuid,
  dish_id text,
  stall_id text,
  name text,
  stall_name text,
  price numeric,
  image_url text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    i.id,
    i.dish_id,
    i.stall_id,
    coalesce(d.name, v.name),
    coalesce(dv.name, v.name),
    d.price,
    case
      when d.id is not null then public.catalog_display_image_url(
        d.image_url, d.media_approved_for_display, d.media_rights_status, d.media_source_url
      )
      else public.catalog_display_image_url(
        v.image_url, v.media_approved_for_display, v.media_rights_status, v.media_source_url
      )
    end
  from public.portfolio_items i
  left join public.dishes d on d.id = i.dish_id
  left join public.venues dv on dv.id = d.venue_id
  left join public.venues v on v.id = i.stall_id
  where i.portfolio_id = p_portfolio_id
  order by i.position, i.created_at;
$$;

revoke all on function public.get_portfolio_item_details(uuid) from public, anon;
grant execute on function public.get_portfolio_item_details(uuid) to authenticated, service_role;

commit;
