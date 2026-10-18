-- Shared list pages show each pick's photo and a map link (retention plan,
-- flow B). Same contract as before plus image_url (approved media only) and
-- map_query (stall, unit, centre, address) for a Google Maps search link.

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
  where p.id = p_portfolio_id and p.visibility = 'public';
$$;

revoke all on function public.get_public_portfolio(uuid) from public;
grant execute on function public.get_public_portfolio(uuid) to anon, authenticated;
