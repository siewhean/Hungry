-- Follow-up to 20261019080000_review_report_auto_hide.sql.
--
-- 1. Merchants can unpin and reorder a popular-visitor pin whose review was
--    hidden by reports. The pin UPDATE check looked the review up through
--    reviews RLS, and the venue merchant cannot read a hidden review, so every
--    update to that pin (unpin, sort_order) failed. The review/venue match now
--    uses a SECURITY DEFINER helper. Pinning (INSERT) still reads the review
--    through RLS, so a hidden review cannot be newly pinned.
-- 2. get_merchant_analytics leaves hidden and removed reviews out of the review
--    count, average rating and review tags, like dishes.review_count/rating_avg.
-- 3. The SECURITY DEFINER bodies from 20261019080000 pin pg_temp last on their
--    search_path, like the other helpers in that migration.

create schema if not exists app_private;
grant usage on schema app_private to anon, authenticated, service_role;

-- 1. Pin updates ignore review moderation ----------------------------------
create or replace function app_private.review_belongs_to_venue(
  p_review_id uuid,
  p_venue_id text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.reviews r
    where r.id = p_review_id
      and r.venue_id = p_venue_id
  );
$$;

revoke all on function app_private.review_belongs_to_venue(uuid, text)
  from public, anon, authenticated;
grant execute on function app_private.review_belongs_to_venue(uuid, text)
  to authenticated, service_role;

drop policy if exists popular_visitor_pins_merchant_update
  on public.merchant_popular_visitor_pins;
create policy popular_visitor_pins_merchant_update
on public.merchant_popular_visitor_pins for update
to authenticated
using (public.merchant_can_manage_outlet_v2(outlet_id))
with check (
  public.merchant_can_manage_outlet_v2(outlet_id)
  and exists (
    select 1
    from public.merchant_outlets mo
    where mo.id = merchant_popular_visitor_pins.outlet_id
      and mo.venue_id = merchant_popular_visitor_pins.venue_id
  )
  and app_private.review_belongs_to_venue(
    merchant_popular_visitor_pins.review_id,
    merchant_popular_visitor_pins.venue_id
  )
);

-- 2. Merchant analytics skip hidden reviews ---------------------------------
create or replace function public.get_merchant_analytics(
  p_outlet_id uuid,
  p_since timestamptz default null,
  p_until timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_outlet record;
  v_since timestamptz := coalesce(p_since, now() - interval '7 days');
  v_until timestamptz := coalesce(p_until, now());
  v_previous_since timestamptz;
  v_previous_until timestamptz;
  v_profile_visits integer := 0;
  v_menu_views integer := 0;
  v_direction_taps integer := 0;
  v_saves integer := 0;
  v_shares integer := 0;
  v_contact_taps integer := 0;
  v_social_link_taps integer := 0;
  v_dish_views integer := 0;
  v_post_interactions integer := 0;
  v_review_count integer := 0;
  v_average_rating numeric := 0;
  v_previous_profile_visits integer := 0;
  v_previous_menu_views integer := 0;
  v_previous_review_count integer := 0;
  v_previous_average_rating numeric := 0;
  v_top_dishes jsonb := '[]'::jsonb;
  v_keywords jsonb := '[]'::jsonb;
  v_peak_hours jsonb := '[]'::jsonb;
  v_taste_tags jsonb := '[]'::jsonb;
begin
  select id, merchant_account_id, venue_id
  into v_outlet
  from merchant_outlets
  where id = p_outlet_id;

  if not found or not public.merchant_can_manage_outlet_v2(p_outlet_id) then
    raise exception 'not authorized to read merchant analytics' using errcode = '42501';
  end if;

  v_previous_until := v_since;
  v_previous_since := v_since - (v_until - v_since);

  select
    coalesce(count(*) filter (where event_type in ('stall_profile_view', 'promotion_profile_visit')), 0)::integer,
    coalesce(count(*) filter (where event_type = 'menu_view'), 0)::integer,
    coalesce(count(*) filter (where event_type = 'direction_tap'), 0)::integer,
    coalesce(count(*) filter (where event_type in ('save', 'promotion_save')), 0)::integer,
    coalesce(count(*) filter (where event_type = 'share'), 0)::integer,
    coalesce(count(*) filter (where event_type = 'contact_tap'), 0)::integer,
    coalesce(count(*) filter (where event_type = 'social_link_tap'), 0)::integer
  into
    v_profile_visits,
    v_menu_views,
    v_direction_taps,
    v_saves,
    v_shares,
    v_contact_taps,
    v_social_link_taps
  from merchant_analytics_events
  where outlet_id = p_outlet_id
    and occurred_at >= v_since
    and occurred_at < v_until;

  select
    coalesce(count(*), 0)::integer
  into v_dish_views
  from merchant_dish_view_events
  where outlet_id = p_outlet_id
    and viewed_at >= v_since
    and viewed_at < v_until;

  v_dish_views := v_dish_views + (
    select coalesce(count(*), 0)::integer
    from merchant_promotion_events
    where outlet_id = p_outlet_id
      and event_type = 'dish_view'
      and occurred_at >= v_since
      and occurred_at < v_until
  );

  select
    coalesce(count(*), 0)::integer,
    coalesce(avg(r.rating), 0)::numeric
  into v_review_count, v_average_rating
  from reviews r
  join dishes d on d.id = r.dish_id
  where d.venue_id = v_outlet.venue_id
    and r.created_at >= v_since
    and r.created_at < v_until
    and not app_private.review_is_moderation_hidden(r.id);

  v_post_interactions := v_review_count;

  select
    coalesce(count(*) filter (where event_type in ('stall_profile_view', 'promotion_profile_visit')), 0)::integer,
    coalesce(count(*) filter (where event_type = 'menu_view'), 0)::integer
  into v_previous_profile_visits, v_previous_menu_views
  from merchant_analytics_events
  where outlet_id = p_outlet_id
    and occurred_at >= v_previous_since
    and occurred_at < v_previous_until;

  select
    coalesce(count(*), 0)::integer,
    coalesce(avg(r.rating), 0)::numeric
  into v_previous_review_count, v_previous_average_rating
  from reviews r
  join dishes d on d.id = r.dish_id
  where d.venue_id = v_outlet.venue_id
    and r.created_at >= v_previous_since
    and r.created_at < v_previous_until
    and not app_private.review_is_moderation_hidden(r.id);

  with dish_rows as (
    select
      d.id,
      d.name,
      coalesce(view_counts.view_count, 0)::integer as views,
      coalesce(save_counts.save_count, 0)::integer as saves
    from dishes d
    left join (
      select dish_id, count(*)::integer as view_count
      from merchant_dish_view_events
      where outlet_id = p_outlet_id
        and viewed_at >= v_since
        and viewed_at < v_until
      group by dish_id
    ) view_counts on view_counts.dish_id = d.id
    left join (
      select dish_id, count(*)::integer as save_count
      from merchant_analytics_events
      where outlet_id = p_outlet_id
        and event_type in ('save', 'promotion_save')
        and dish_id is not null
        and occurred_at >= v_since
        and occurred_at < v_until
      group by dish_id
    ) save_counts on save_counts.dish_id = d.id
    where d.venue_id = v_outlet.venue_id
  ),
  ranked as (
    select *
    from dish_rows
    where views > 0 or saves > 0
    order by views desc, saves desc, name asc
    limit 5
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'dishId', id,
          'name', name,
          'views', views,
          'saves', saves
        )
        order by views desc, saves desc, name asc
      ),
      '[]'::jsonb
    ),
    coalesce(jsonb_agg(to_jsonb(lower(name)) order by views desc, saves desc, name asc), '[]'::jsonb)
  into v_top_dishes, v_keywords
  from ranked;

  with discovery_events as (
    select viewed_at as occurred_at
    from merchant_dish_view_events
    where outlet_id = p_outlet_id
      and viewed_at >= v_since
      and viewed_at < v_until
    union all
    select occurred_at
    from merchant_analytics_events
    where outlet_id = p_outlet_id
      and occurred_at >= v_since
      and occurred_at < v_until
  ),
  ranked_hours as (
    select extract(hour from occurred_at)::integer as hour, count(*) as event_count
    from discovery_events
    group by extract(hour from occurred_at)::integer
    order by event_count desc, hour asc
    limit 6
  )
  select coalesce(jsonb_agg(to_jsonb(hour) order by event_count desc, hour asc), '[]'::jsonb)
  into v_peak_hours
  from ranked_hours;

  with tag_rows as (
    select unnest(r.tags) as tag
    from reviews r
    join dishes d on d.id = r.dish_id
    where d.venue_id = v_outlet.venue_id
      and r.created_at >= v_since
      and r.created_at < v_until
      and not app_private.review_is_moderation_hidden(r.id)
    union all
    select unnest(d.taste_tags) as tag
    from dishes d
    join merchant_dish_view_events mdve on mdve.dish_id = d.id
    where d.venue_id = v_outlet.venue_id
      and mdve.outlet_id = p_outlet_id
      and mdve.viewed_at >= v_since
      and mdve.viewed_at < v_until
    union all
    select dft.tag_slug as tag
    from dish_flavor_tags dft
    join dishes d on d.id = dft.dish_id
    where d.venue_id = v_outlet.venue_id
      and dft.status in ('pending', 'applied')
  ),
  ranked_tags as (
    select trim(lower(tag)) as tag, count(*)::integer as tag_count
    from tag_rows
    where trim(coalesce(tag, '')) <> ''
    group by trim(lower(tag))
    order by tag_count desc, tag asc
    limit 8
  )
  select coalesce(
    jsonb_agg(jsonb_build_object('tag', tag, 'count', tag_count) order by tag_count desc, tag asc),
    '[]'::jsonb
  )
  into v_taste_tags
  from ranked_tags;

  return jsonb_build_object(
    'outletId', p_outlet_id,
    'profileVisits', v_profile_visits,
    'menuViews', v_menu_views,
    'dishViews', v_dish_views,
    'directionTaps', v_direction_taps,
    'saves', v_saves,
    'shares', v_shares,
    'contactTaps', v_contact_taps,
    'socialLinkTaps', v_social_link_taps,
    'postInteractions', v_post_interactions,
    'reviewCount', v_review_count,
    'averageRating', round(v_average_rating, 2),
    'topDishes', v_top_dishes,
    'mostSearchedKeywords', v_keywords,
    'peakDiscoveryHours', v_peak_hours,
    'customerTasteTags', v_taste_tags,
    'previousPeriodComparison', jsonb_build_object(
      'profileVisits', v_previous_profile_visits,
      'menuViews', v_previous_menu_views,
      'reviewCount', v_previous_review_count,
      'averageRating', round(v_previous_average_rating, 2)
    )
  );
end;
$function$;

revoke all on function public.get_merchant_analytics(uuid, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_merchant_analytics(uuid, timestamptz, timestamptz)
  to authenticated;


-- 3. pg_temp last on the new SECURITY DEFINER bodies ------------------------
alter function app_private.report_content(text, text, text, text)
  set search_path = public, pg_temp;
alter function app_private.set_review_moderation_state(uuid, text, text, jsonb)
  set search_path = public, pg_temp;
