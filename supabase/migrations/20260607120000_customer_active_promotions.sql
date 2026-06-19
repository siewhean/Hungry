-- Customer-visible promotion read path.
-- Returns only active, available, in-window merchant promotions for live outlet venue/dish surfaces.

create or replace function public.list_customer_active_promotions(
  p_venue_id text,
  p_dish_id text default null
)
returns table (
  id uuid,
  outlet_id uuid,
  title text,
  description text,
  target_dish_id text,
  promotion_item_type text,
  start_date timestamptz,
  end_date timestamptz,
  original_price numeric,
  promotional_price numeric,
  final_price numeric,
  discount_percentage numeric,
  is_available boolean,
  target_audience text[],
  status text,
  created_at timestamptz
)
language sql
security definer
set search_path = public, extensions
as $$
  select
    mp.id,
    mp.outlet_id,
    mp.title,
    mp.description,
    mp.target_dish_id,
    mp.promotion_item_type,
    mp.start_date,
    mp.end_date,
    mp.original_price,
    mp.promotional_price,
    mp.final_price,
    mp.discount_percentage,
    mp.is_available,
    mp.target_audience,
    mp.status,
    mp.created_at
  from merchant_promotions mp
  join merchant_outlets mo on mo.id = mp.outlet_id
  where mo.venue_id = p_venue_id
    and mo.is_live = true
    and mp.status = 'active'
    and coalesce(mp.is_available, true) = true
    and now() >= mp.start_date
    and now() <= mp.end_date
    and (
      mp.target_dish_id is null
      or nullif(p_dish_id, '') is null
      or mp.target_dish_id = p_dish_id
    )
  order by
    case when mp.target_dish_id is not null then 0 else 1 end,
    mp.created_at desc;
$$;

revoke all on function public.list_customer_active_promotions(text, text) from public;
grant execute on function public.list_customer_active_promotions(text, text) to anon, authenticated;
