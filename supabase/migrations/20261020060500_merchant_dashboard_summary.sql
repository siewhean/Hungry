-- Merchant dashboard counts in one call.
--
-- The dashboard loaded the outlet's whole menu and every review just to show
-- "Incomplete profile" and "Unreplied reviews" cards and the latest review.
-- This returns the counts and the newest review instead.
--
-- SECURITY INVOKER: merchant_outlets rows are readable by the outlet's team only
-- (20261019220000), and dishes and reviews are read under the caller's own RLS,
-- so the numbers match what the menu and inbox screens show.

create or replace function public.get_merchant_dashboard_summary(p_outlet_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_venue_id text;
begin
  select mo.venue_id into v_venue_id
  from public.merchant_outlets mo
  where mo.id = p_outlet_id;

  if not found then
    raise exception 'not authorized to read this outlet' using errcode = '42501';
  end if;

  if v_venue_id is null then
    return jsonb_build_object(
      'menuCount', 0,
      'dishesWithoutImages', 0,
      'unrepliedReviews', 0,
      'latestReview', null
    );
  end if;

  return jsonb_build_object(
    'menuCount', (
      select count(*)::integer from public.dishes d where d.venue_id = v_venue_id
    ),
    'dishesWithoutImages', (
      select count(*)::integer
      from public.dishes d
      where d.venue_id = v_venue_id
        and coalesce(trim(d.image_url), '') = ''
        and not exists (select 1 from public.dish_images di where di.dish_id = d.id)
    ),
    'unrepliedReviews', (
      select count(*)::integer
      from public.reviews r
      where r.venue_id = v_venue_id
        and r.merchant_reply_text is null
    ),
    'latestReview', (
      select jsonb_build_object(
        'id', r.id,
        'authorName', r.author_name,
        'rating', r.rating,
        'text', r.text,
        'createdAt', r.created_at
      )
      from public.reviews r
      where r.venue_id = v_venue_id
      order by r.created_at desc, r.id
      limit 1
    )
  );
end;
$$;

revoke all on function public.get_merchant_dashboard_summary(uuid) from public, anon;
grant execute on function public.get_merchant_dashboard_summary(uuid)
  to authenticated, service_role;
