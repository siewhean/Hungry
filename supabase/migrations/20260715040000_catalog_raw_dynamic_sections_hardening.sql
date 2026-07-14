-- Keep the release publisher as the sole caller of the destructive rebuild
-- helper. The section RPC remains authenticated and read-only.
revoke all on function public.catalog_raw_rebuild_dish_section_tags(uuid) from public, anon, authenticated;
drop function if exists public.catalog_raw_discover_sections(double precision, double precision, integer, text, uuid, integer);

create or replace function public.catalog_raw_discover_sections(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_meters integer default 3000,
  p_rotation_seed text default '',
  p_release_id uuid default null,
  p_limit_per_section integer default 8,
  p_cuisine_tags text[] default '{}',
  p_dietary_flags text[] default '{}',
  p_max_price numeric default null
) returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_release uuid;
  v_limit integer := least(greatest(coalesce(p_limit_per_section, 8), 1), 12);
  v_bucket integer := mod(abs(hashtext(coalesce(p_rotation_seed, ''))::bigint), 97);
  v_sections jsonb;
begin
  perform public.catalog_raw_require_authenticated();
  v_release := public.catalog_raw_release_for_read(p_release_id);

  with requested(section_id) as (
    values ('nearby'::text), ('budget'::text), ('late_night'::text), ('editors_choice'::text)
  )
  select jsonb_object_agg(requested.section_id, section_rows.items) into v_sections
  from requested
  cross join lateral (
    select coalesce(jsonb_agg(row.card order by row.bucket_distance, row.rank desc, row.id), '[]'::jsonb) as items
    from (
      select *
      from (
      (
        select c.id, tags.rank, tags.rotation_bucket - v_bucket as bucket_distance,
          to_jsonb(c) - 'listing_location' || jsonb_build_object('section_tags', coalesce((
            select jsonb_agg(all_tags.section_id order by all_tags.section_id)
            from public.catalog_raw_dish_section_tags all_tags
            where all_tags.release_id = c.release_id and all_tags.dish_id = c.id
          ), '[]'::jsonb)) as card
        from public.catalog_raw_dish_section_tags tags
        join public.catalog_raw_dish_cards c on c.release_id = tags.release_id and c.id = tags.dish_id
        where tags.release_id = v_release and tags.section_id = requested.section_id
          and tags.rotation_bucket >= v_bucket
          and not exists (select 1 from public.catalog_raw_excluded_venues excluded where excluded.venue_id = c.venue_id)
          and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
          and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
          and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags && p_dietary_flags)
          and (p_max_price is null or c.price <= p_max_price)
        order by tags.rotation_bucket, tags.rank desc, tags.dish_id
        limit v_limit
      )
      union all
      (
        select c.id, tags.rank, tags.rotation_bucket - v_bucket + 97 as bucket_distance,
          to_jsonb(c) - 'listing_location' || jsonb_build_object('section_tags', coalesce((
            select jsonb_agg(all_tags.section_id order by all_tags.section_id)
            from public.catalog_raw_dish_section_tags all_tags
            where all_tags.release_id = c.release_id and all_tags.dish_id = c.id
          ), '[]'::jsonb)) as card
        from public.catalog_raw_dish_section_tags tags
        join public.catalog_raw_dish_cards c on c.release_id = tags.release_id and c.id = tags.dish_id
        where tags.release_id = v_release and tags.section_id = requested.section_id
          and tags.rotation_bucket < v_bucket
          and not exists (select 1 from public.catalog_raw_excluded_venues excluded where excluded.venue_id = c.venue_id)
          and (p_lat is null or p_lng is null or p_radius_meters is null or st_dwithin(c.listing_location, st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography, p_radius_meters))
          and (cardinality(coalesce(p_cuisine_tags, '{}')) = 0 or c.cuisine_tags && p_cuisine_tags)
          and (cardinality(coalesce(p_dietary_flags, '{}')) = 0 or c.dietary_flags && p_dietary_flags)
          and (p_max_price is null or c.price <= p_max_price)
        order by tags.rotation_bucket, tags.rank desc, tags.dish_id
        limit v_limit
      )
      ) candidates
      order by bucket_distance, rank desc, id
      limit v_limit
    ) row
  ) section_rows;
  return jsonb_build_object('release_id', v_release, 'sections', coalesce(v_sections, '{}'::jsonb));
end;
$$;

revoke all on function public.catalog_raw_discover_sections(double precision, double precision, integer, text, uuid, integer, text[], text[], numeric) from public, anon;
grant execute on function public.catalog_raw_discover_sections(double precision, double precision, integer, text, uuid, integer, text[], text[], numeric) to authenticated;
