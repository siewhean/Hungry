-- Read-only count audit for the source-count validation gate.
select jsonb_build_object(
  'totals', (
    select jsonb_build_object(
      'rows', count(*),
      'distinct_ids', count(distinct id),
      'with_venue', count(*) filter (where venue_id is not null),
      'with_name', count(*) filter (where nullif(trim(name), '') is not null),
      'with_price', count(*) filter (where price is not null),
      'approved_menu', count(*) filter (where menu_approved_for_display),
      'approved_media', count(*) filter (where media_approved_for_display)
    )
    from public.dishes
  ),
  'source_types', (
    select jsonb_agg(jsonb_build_object('source_type', coalesce(source_type, 'null'), 'dishes', dishes) order by dishes desc, source_type)
    from (
      select coalesce(source_type, 'null') as source_type, count(*) as dishes
      from public.dishes
      group by source_type
    ) source_counts
  ),
  'recent_updates', (
    select jsonb_agg(jsonb_build_object('updated_day', updated_day, 'dishes', dishes) order by updated_day desc nulls last)
    from (
      select date_trunc('day', updated_at)::date as updated_day, count(*) as dishes
      from public.dishes
      group by updated_day
      order by updated_day desc nulls last
      limit 20
    ) update_counts
  )
) as audit;
